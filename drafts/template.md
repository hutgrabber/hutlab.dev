---
title: "Your Post Title Here"
date: 2026-01-01
layout: layouts/post.njk
permalink: /your-url-slug/
tags: [posts, updates]
description: "One or two sentences shown on the homepage, in search results, in RSS readers, and on social link previews."
feature_image: "/images/2026-01-01-short-name/cover.jpg"
feature_image_caption: "Optional caption shown under the cover image — delete this line if unused"
# feature_image also becomes the post's thumbnail on the homepage and tag lists
# meta_title: "Optional — overrides title in the browser tab & search engines only"
---

<!-- ============================================================
HOW TO USE THIS TEMPLATE
1. Duplicate this file, rename it after your URL slug (my-post.md).
2. Fill in the front matter above:
   - date: publish date, YYYY-MM-DD (controls feed order)
   - permalink: /your-slug/ — leading AND trailing slash
   - tags: keep `posts` first (required, never displayed), then topic
     tags: updates, tutorials, writeups... new tags need no setup.
3. Create this post's image folder: src/images/<date>-<short-name>/
   (e.g. src/images/2026-01-01-short-name/) and drop images there,
   named as 1-2 word descriptions: cover.jpg, scan-results.png ...
4. Write, deleting every example section below that you don't need.
5. Move the file to src/posts/, preview with `npm start`, then
   commit + push to master. Live in about a minute.
Full instructions: publish.md at the repo root.
HTML comments like this one never appear on the site.
============================================================= -->

Your opening paragraph. Body text is justified on both edges automatically. All the
usual inline styles work: **bold** (renders in the cursor green), *italic*,
***bold italic***, ~~strikethrough~~, <u>underline</u>, and `inline code`. Links can be
[internal](/the-hacker-mindset/) — absolute path with both slashes — or
[external](https://www.openssh.com/) with the full URL.

---

# Heading 1

The `#` / `##` / `###` prefixes are added by the site's styling automatically —
don't type them in the heading text. h4–h6 render as plain bold text, no prefix.
A dashed horizontal rule (the `---` above) separates sections. Every heading
also gets an anchor id and appears in the table of contents (a side rail on
desktop, a collapsible `$ toc` box on phones), where readers can copy a
shareable link straight to that section.

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

> Blockquote — for quotes, callouts, or asides. Renders italic with an accent
> bar on the left.

Unordered list:

- First item
- Second item with `inline code`
  - Nested item
- Third item

Ordered list:

1. **Enumerate** — numbered lists work the same way.
2. Second step.
3. Third step.

---

## Code Blocks

Name the language after the opening fence for syntax highlighting (bash, python,
c, cpp, powershell, yaml, json, js, go, rust, and more):

```bash
# Comments render dimmed, keywords get colors
sudo systemctl restart sshd
ssh -i ~/.ssh/id_ed25519 user@10.10.10.10
```

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

```
No language = plain monospace block. Good for terminal output or file trees.
```

---

## Images

Five sizes, chosen with a class on the figure tag — an even ladder from a tiny
centered thumbnail up to the cover-image width. Replace the src paths with
your post's images (`/images/<date>-<short-name>/<description>.png`).

<figure class="img-xs">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image for screen readers" loading="lazy">
  <figcaption>img-xs — 25% width; thumbnails, icons, QR codes</figcaption>
</figure>

<figure class="img-s">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image" loading="lazy">
  <figcaption>img-s — 45% width; terminal snippets, tall screenshots, memes</figcaption>
</figure>

<figure class="img-m">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image" loading="lazy">
  <figcaption>img-m — 65% width; medium screenshots and diagrams</figcaption>
</figure>

<figure class="img-l">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image" loading="lazy">
  <figcaption>img-l — 85% width; most screenshots and wide diagrams</figcaption>
</figure>

<figure class="img-feat">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image" loading="lazy">
  <figcaption>img-feat — full text width, same as the cover; hero shots</figcaption>
</figure>

A bare Markdown image also works (renders at full width, no caption):

![Describe the image](/images/2026-01-01-short-name/example.png)

**Side-by-side pair** — tag two consecutive figures img-h1 / img-h2 and the
build grids them automatically (each keeps its own caption; stacks on phones):

<figure class="img-h1">
  <img src="/images/2026-01-01-short-name/example.png" alt="Left image" loading="lazy">
  <figcaption>left — img-h1</figcaption>
</figure>

<figure class="img-h2">
  <img src="/images/2026-01-01-short-name/example.png" alt="Right image" loading="lazy">
  <figcaption>right — img-h2</figcaption>
</figure>

**Quadrant** — four consecutive figures tagged img-q1..img-q4 become a 2×2
grid (order self-corrects, three tiles also works, stays 2×2 on phones):

<figure class="img-q1">
  <img src="/images/2026-01-01-short-name/example.png" alt="Quadrant 1" loading="lazy">
  <figcaption>img-q1</figcaption>
</figure>

<figure class="img-q2">
  <img src="/images/2026-01-01-short-name/example.png" alt="Quadrant 2" loading="lazy">
  <figcaption>img-q2</figcaption>
</figure>

<figure class="img-q3">
  <img src="/images/2026-01-01-short-name/example.png" alt="Quadrant 3" loading="lazy">
  <figcaption>img-q3</figcaption>
</figure>

<figure class="img-q4">
  <img src="/images/2026-01-01-short-name/example.png" alt="Quadrant 4" loading="lazy">
  <figcaption>img-q4</figcaption>
</figure>

---

## Callouts

Obsidian callouts paste straight from your vault. All 13 types (+ aliases like
`tldr`, `hint`, `caution`) work; custom titles are optional; `[!type]-` fold
markers are accepted but always render expanded.

> [!note]
> Quiet types (note, info, todo, abstract, example, quote) blend in like blockquotes.

> [!tip] Custom title here
> Mid types (tip, success, question) get a subtle tint and colored border.

> [!warning]
> Alert types (warning, danger, failure, bug) pop with a strong tint —
> save these for things the reader must not miss.

> [!example]
> Callouts nest, and all markdown works inside:
>
> > [!success] It renders `code`, **bold**, and [links](/tags/)

---

## Bookmark Cards

Paste a URL alone in its own paragraph and it becomes a rich bookmark card at
build time (title, description, favicon, thumbnail). Inline links in sentences
are never converted. The fetched metadata is cached in `bookmark-cache.json` —
commit it together with the post.

https://github.com/hutgrabber/hutlab.dev

---

## Tables

| Flag | Meaning | Default |
|---|---|---|
| `-p` | Port range to scan | top 1000 |
| `-sV` | Probe service versions | off |
| `-oA` | Output in all formats | — |

---

## Link Cards & Buttons

A hand-written bookmark card, for when you want full control over the text
(otherwise just paste the bare URL — see Bookmark Cards above):

<a class="bookmark" href="https://github.com/hutgrabber" target="_blank" rel="noopener">
  <span class="bookmark-title">Title of the Linked Page</span>
  <span class="bookmark-desc">One-line description of what's behind the link.</span>
  <span class="bookmark-meta">Author · Site name</span>
</a>

A button-style link:

<p class="btn-row"><a class="btn" href="https://example.com">Grab the tool →</a></p>

---

## Embeds

**Just paste the link** — a bare URL alone in its own paragraph becomes a native
theme-synced card at build time. YouTube (click-to-play player), X/Twitter,
Bluesky, GitHub, Reddit, Threads, Instagram, and LinkedIn get hand-crafted
treatments; anything else gets the default bookmark card. No embed codes, no
third-party scripts. Examples:

https://www.youtube.com/watch?v=VIDEO_ID

https://x.com/USER/status/TWEET_ID

https://bsky.app/profile/HANDLE/post/POST_ID

https://github.com/OWNER/REPO

https://www.reddit.com/r/SUBREDDIT/comments/POST_ID/slug/

**Anything else** (Asciinema, CodePen, maps...) — paste the service's iframe;
wrap video-shaped ones in `<div class="video-embed">` for responsive sizing.

---

Closing paragraph. Delete everything you didn't use — shorter posts read better.
