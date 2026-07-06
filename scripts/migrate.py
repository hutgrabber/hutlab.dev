#!/usr/bin/env python3
"""One-off migration from a Ghost export JSON to Eleventy markdown files.

Usage: python3 scripts/migrate.py <ghost-export.json>

- Converts published posts and kept pages to src/posts/*.md and src/pages/*.md
- Strips Ghost membership artifacts (signup cards, #/portal links)
- Rewrites __GHOST_URL__ image/link URLs to local paths
- Downloads every referenced image from the still-live hutgrabber.com
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup
from markdownify import MarkdownConverter

REPO = Path(__file__).resolve().parent.parent
POSTS_DIR = REPO / "src" / "posts"
PAGES_DIR = REPO / "src" / "pages"
IMAGES_DIR = REPO / "src" / "assets" / "images"

LIVE_ORIGIN = "https://hutgrabber.com"
KEEP_PAGES = {"author", "about-me"}
DROP_PAGES = {"support-the-mission"}

# extra site assets not referenced from post bodies
EXTRA_IMAGES = [
    "2024/09/hut-3.png",           # logo
    "2024/09/hut-9.png",           # icon / favicon source
    "2024/09/HutgrabberSquare-4.jpg",  # author profile photo
]

SIZE_VARIANT = re.compile(r"/content/images/size/w\d+/")


def local_image_path(ghost_url: str) -> str:
    """__GHOST_URL__/content/images[/size/wNNN]/2024/09/x.png -> /assets/images/2024/09/x.png"""
    url = SIZE_VARIANT.sub("/content/images/", ghost_url)
    url = url.replace("__GHOST_URL__/content/images/", "/assets/images/")
    return url


class Converter(MarkdownConverter):
    def convert_u(self, el, text, parent_tags=None):
        return f"<u>{text}</u>" if text else ""

    def convert_pre(self, el, text, parent_tags=None):
        code = el.find("code")
        lang = ""
        if code:
            for cls in code.get("class") or []:
                if cls.startswith("language-"):
                    lang = cls.removeprefix("language-")
        content = el.get_text()
        return f"\n\n```{lang}\n{content.rstrip()}\n```\n\n"


def clean_html(html: str, images: set) -> BeautifulSoup:
    soup = BeautifulSoup(html, "html.parser")

    # 1. remove membership signup cards entirely
    for card in soup.select("div.kg-signup-card, form.kg-signup-card-form"):
        card.decompose()

    # 2. remove buttons/links pointing at Ghost's member portal; unwrap
    #    inline mentions so surrounding prose survives
    for a in list(soup.find_all("a", href=True)):
        if "#/portal" not in a["href"]:
            continue
        container = a.find_parent("div", class_="kg-button-card")
        if container:
            container.decompose()
            continue
        parent = a.find_parent("p")
        if parent and parent.get_text(" ", strip=True) == a.get_text(" ", strip=True):
            parent.decompose()  # paragraph is just the link
        else:
            a.unwrap()  # keep the text, drop the dead link

    # 3. bookmark cards -> simple styled link card
    for fig in soup.select("figure.kg-bookmark-card"):
        a = fig.select_one("a.kg-bookmark-container")
        if not a:
            fig.decompose()
            continue
        title = fig.select_one(".kg-bookmark-title")
        desc = fig.select_one(".kg-bookmark-description")
        publisher = fig.select_one(".kg-bookmark-publisher")
        author = fig.select_one(".kg-bookmark-author")
        card = soup.new_tag("a", href=a["href"], attrs={"class": "bookmark",
                            "target": "_blank", "rel": "noopener"})
        for cls, node in [("bookmark-title", title), ("bookmark-desc", desc)]:
            if node and node.get_text(strip=True):
                span = soup.new_tag("span", attrs={"class": cls})
                span.string = node.get_text(" ", strip=True)
                card.append(span)
        meta_bits = [n.get_text(" ", strip=True) for n in (author, publisher)
                     if n and n.get_text(strip=True)]
        if meta_bits:
            span = soup.new_tag("span", attrs={"class": "bookmark-meta"})
            span.string = " · ".join(dict.fromkeys(meta_bits))
            card.append(span)
        fig.replace_with(card)

    # 4. embed cards (YouTube) -> responsive wrapper
    for fig in soup.select("figure.kg-embed-card"):
        iframe = fig.find("iframe")
        if not iframe:
            fig.decompose()
            continue
        wrapper = soup.new_tag("div", attrs={"class": "video-embed"})
        clean = soup.new_tag("iframe", src=iframe["src"], attrs={
            "title": iframe.get("title", "Embedded video"),
            "loading": "lazy",
            "allowfullscreen": "",
            "frameborder": "0",
            "allow": "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        })
        wrapper.append(clean)
        fig.replace_with(wrapper)

    # 5. button cards with real links -> simple button link
    for div in soup.select("div.kg-button-card"):
        a = div.find("a", href=True)
        if not a:
            div.decompose()
            continue
        btn = soup.new_tag("a", href=a["href"], attrs={"class": "btn"})
        btn.string = a.get_text(" ", strip=True)
        p = soup.new_tag("p", attrs={"class": "btn-row"})
        p.append(btn)
        div.replace_with(p)

    # 6. image cards -> clean <figure><img><figcaption>
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if "__GHOST_URL__" in src:
            img["src"] = local_image_path(src)
            images.add(img["src"])
        for attr in ("srcset", "sizes", "width", "height"):
            if img.has_attr(attr):
                del img[attr]
        img["loading"] = "lazy"

    for fig in soup.select("figure.kg-image-card"):
        fig.attrs = {"class": "figure"}
        if (cap := fig.find("figcaption")) is not None:
            for span in cap.find_all("span"):
                span.unwrap()

    # 7. rewrite remaining internal links
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("__GHOST_URL__"):
            a["href"] = a["href"].replace("__GHOST_URL__", "") or "/"

    return soup


def to_markdown(soup: BeautifulSoup) -> str:
    # protect complex blocks from markdown conversion: keep them as raw HTML
    keep_selectors = "figure, div.video-embed, a.bookmark, table, p.btn-row"
    blocks = []
    for node in soup.select(keep_selectors):
        if node.find_parent(["figure", "table"]):
            continue  # nested inside an already-kept block
        token = f"HTMLBLOCK{len(blocks)}TOKEN"
        blocks.append((token, str(node)))
        placeholder = soup.new_tag("p")
        placeholder.string = token
        node.replace_with(placeholder)

    md = Converter(heading_style="ATX", bullets="-").convert_soup(soup)
    md = re.sub(r"\n{3,}", "\n\n", md).strip()

    for token, html in blocks:
        md = md.replace(token, html)
    return md


def yaml_str(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def front_matter(post, meta, tags, is_page) -> str:
    lines = ["---"]
    lines.append(f"title: {yaml_str(post['title'])}")
    lines.append(f"date: {post['published_at']}")
    lines.append(f"layout: layouts/{'page' if is_page else 'post'}.njk")
    lines.append(f"permalink: /{post['slug']}/")
    if not is_page:
        tag_items = ["posts"] + tags
        lines.append(f"tags: [{', '.join(tag_items)}]")
    desc = post.get("custom_excerpt") or (meta.get("meta_description") if meta else "")
    if desc:
        lines.append(f"description: {yaml_str(desc)}")
    if meta and meta.get("meta_title"):
        lines.append(f"meta_title: {yaml_str(meta['meta_title'])}")
    if post.get("feature_image"):
        lines.append(f"feature_image: {yaml_str(local_image_path(post['feature_image']))}")
    if meta and meta.get("feature_image_caption"):
        cap = BeautifulSoup(meta["feature_image_caption"], "html.parser").get_text(" ", strip=True)
        lines.append(f"feature_image_caption: {yaml_str(cap)}")
    lines.append("templateEngineOverride: md")
    lines.append("---")
    return "\n".join(lines)


def download_images(images: set) -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for path in sorted(images):
        rel = path.removeprefix("/assets/images/")
        dest = IMAGES_DIR / rel
        if dest.exists():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        url = f"{LIVE_ORIGIN}/content/images/{rel}"
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "hutlab-migration/1.0"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    dest.write_bytes(resp.read())
                print(f"  downloaded {rel}")
                break
            except Exception as exc:
                if attempt == 2:
                    failed.append((rel, str(exc)))
                else:
                    time.sleep(2 * (attempt + 1))
    if failed:
        print("\nFAILED DOWNLOADS:")
        for rel, err in failed:
            print(f"  {rel}: {err}")
        sys.exit(1)


def main() -> None:
    export_path = Path(sys.argv[1])
    raw = json.loads(export_path.read_text())
    data = raw["db"][0]["data"] if "db" in raw else raw["data"]

    tags_by_id = {t["id"]: t["slug"] for t in data["tags"]}
    post_tags = {}
    for pt in data["posts_tags"]:
        post_tags.setdefault(pt["post_id"], []).append(tags_by_id[pt["tag_id"]])
    meta_by_id = {m["post_id"]: m for m in data["posts_meta"]}

    images = set(f"/assets/images/{p}" for p in EXTRA_IMAGES)
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    PAGES_DIR.mkdir(parents=True, exist_ok=True)

    for post in data["posts"]:
        is_page = post["type"] == "page"
        if post["status"] != "published":
            print(f"skip (draft): {post['slug']}")
            continue
        if is_page and post["slug"] in DROP_PAGES:
            print(f"skip (dropped page): {post['slug']}")
            continue
        if is_page and post["slug"] not in KEEP_PAGES:
            print(f"skip (unknown page): {post['slug']}")
            continue

        soup = clean_html(post["html"] or "", images)
        body = to_markdown(soup)
        meta = meta_by_id.get(post["id"])
        if post.get("feature_image"):
            images.add(local_image_path(post["feature_image"]))
        fm = front_matter(post, meta, post_tags.get(post["id"], []), is_page)
        out_dir = PAGES_DIR if is_page else POSTS_DIR
        out = out_dir / f"{post['slug']}.md"
        out.write_text(fm + "\n\n" + body + "\n")
        print(f"wrote {out.relative_to(REPO)}")

    print(f"\ndownloading {len(images)} images...")
    download_images(images)
    print("done")


if __name__ == "__main__":
    main()
