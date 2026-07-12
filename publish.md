# Publishing on hutlab.dev

Everything you need to go from an idea to a live post. The short version: **add one
Markdown file, push to `master`, done.** GitHub Actions builds and deploys the site
automatically — live at [hutlab.dev](https://hutlab.dev) in about a minute.

---

## 1. Create the post file

**Fastest path: duplicate [`drafts/template.md`](drafts/template.md)** — it carries
the front matter pre-filled and a working example of every element the site can
render (headings, images at every size, code, tables, embeds, cards). Rename it,
fill it in, delete what you don't need, and move it to `src/posts/` when ready.

Or start from scratch: posts live in `src/posts/`, named after the URL slug you want:

```
src/posts/hardening-ssh.md   →   https://hutlab.dev/hardening-ssh/
```

Start the file with front matter, then write Markdown below it:

````markdown
---
title: "Hardening SSH Servers"
date: 2026-07-06
layout: layouts/post.njk
permalink: /hardening-ssh/
tags: [posts, tutorials]
description: "Lock down sshd like you mean it — keys, configs, and the settings everyone forgets."
feature_image: "/images/2026-07-06-hardening-ssh/cover.jpg"
---

Your post starts here...
````

### Front matter reference

| Field | Required | What it does |
|---|---|---|
| `title` | yes | Post title (shown in the pixel font, the feed, RSS, and search) |
| `date` | yes | Publish date (`YYYY-MM-DD`); controls feed order |
| `layout` | yes | Always `layouts/post.njk` for posts |
| `permalink` | yes | The URL, as `/your-slug/` (leading and trailing slash) |
| `tags` | yes | Always start with `posts`, then add topic tags (see §2) |
| `description` | recommended | Excerpt for the homepage list, search results, RSS, and SEO |
| `feature_image` | optional | Cover image path — shown atop the post, as the thumbnail on the homepage and tag lists, and in link previews |
| `feature_image_caption` | optional | Small caption under the cover image |
| `meta_title` | optional | Overrides `title` in the browser tab / search engines only |

---

## 2. Tagging

- **Always keep `posts` as the first tag** — it's the internal tag that puts the entry
  on the homepage and in the RSS feed. It's never displayed.
- Everything after it is a topic tag: `tags: [posts, tutorials]`,
  `tags: [posts, writeups]`, or several: `tags: [posts, tutorials, cloud]`.
- Each topic tag automatically gets an archive page at `/tags/<tag>/` — a brand-new
  tag needs no setup, just use it. Tag chips on posts and the homepage link there.
- Every tag and post also appears automatically on the interactive tag graph at
  [`/tags/`](https://hutlab.dev/tags/), including dashed edges for posts that link
  to each other — nothing to maintain.
- Use lowercase single words (`tutorials`, `writeups`, `redteam`) so URLs stay clean.

---

## 3. Images

Every post gets **one image folder** under `src/images/`, named after the publish
date plus a short blog name (1-2 words, independent of the permalink):

```
src/images/2026-07-06-hardening-ssh/
```

Drop all of the post's images in there — the cover included — and give each file a
**1-2 word kebab-case description** (the folder already carries the date):

```
src/images/2026-07-06-hardening-ssh/cover.jpg
src/images/2026-07-06-hardening-ssh/sshd-config.png
src/images/2026-07-06-hardening-ssh/scan-results.png
```

Then reference them with an absolute path:

```markdown
![Nmap scan results](/images/2026-07-06-hardening-ssh/scan-results.png)
```

### Choosing an image size

Use a figure block with one of five size classes — this also centers the image and
gives you a styled caption:

```html
<figure class="img-l">
  <img src="/images/2026-07-06-hardening-ssh/scan-results.png" alt="Nmap scan results" loading="lazy">
  <figcaption>Figure — full TCP scan of the target</figcaption>
</figure>
```

| Class | Width | Use for |
|---|---|---|
| `img-xs` | 25% (~200px) | Inline thumbnails, icons, QR codes, tiny crops |
| `img-s` | 45% (~360px) | Terminal snippets, tall/narrow screenshots, memes |
| `img-m` | 65% (~520px) | Medium screenshots and diagrams |
| `img-l` | 85% (~680px) | Most screenshots and wide diagrams |
| `img-feat` | 100% (800px), same as the cover | Hero shots, panoramas, anything that deserves the full column |

The five widths step evenly (25 → 45 → 65 → 85 → 100%) so every size is clearly
distinct at a glance. All are centered in the text column; `img-feat` renders at
exactly the same width as the post's cover image. Plain `<figure>`, the legacy
`class="figure"`, and bare Markdown images all render at full width (`img-feat`
size). On phones the ladder compresses but keeps its hierarchy: `img-xs` → 55%,
`img-s` → 70%, `img-m` → 85%, `img-l` and `img-feat` → full width.

### Side-by-side pairs & quadrants

Tag consecutive figures and the build groups them into a grid automatically —
`img-h1` + `img-h2` for two images side by side, `img-q1`…`img-q4` for a 2×2
quadrant. Each image keeps its own caption:

```html
<figure class="img-h1">
  <img src="/images/2026-07-06-hardening-ssh/before.png" alt="Before" loading="lazy">
  <figcaption>before hardening</figcaption>
</figure>

<figure class="img-h2">
  <img src="/images/2026-07-06-hardening-ssh/after.png" alt="After" loading="lazy">
  <figcaption>after hardening</figcaption>
</figure>
```

Rules of thumb:

- The tagged figures must sit **directly after one another** (blank lines between
  them are fine, other content is not — text between figures ends the group).
- Order doesn't matter: `q2` written before `q1` still renders in 1→4 order.
- Incomplete groups are fine: `q1`–`q3` renders a 2×2 grid with three tiles; a
  lone `img-h1` with no partner renders as a normal full-width figure.
- Images keep their natural aspect ratio (no cropping); tops align.
- On phones, pairs stack full-width; quadrants stay 2×2.
- RSS readers see the images as normal sequential figures.

**Images are served as-is — no auto-resizing.** You must provide properly-sized
images before uploading. CSS scales them responsively, but won't crop — and a
small source will upscale and look soft at 800px. Recommended dimensions:

- **Cover / in-body images**: ≥1000px wide (~2:1 ratio is crisp on social previews)

For the post's cover, set `feature_image` (and optionally `feature_image_caption`)
in the front matter instead of putting the image in the body — name the file
`cover.jpg`/`cover.png` in the post's image folder.

Tips: compress screenshots before committing (the repo serves them as-is), always
write `alt` text, and `loading="lazy"` on in-body images keeps pages fast.

---

## 4. Code blocks

Fenced code blocks get build-time syntax highlighting (Prism — zero JavaScript
shipped to readers). Name the language after the opening fence:

````markdown
```bash
sudo systemctl restart sshd
```
````

Works with `bash`, `python`, `c`, `cpp`, `powershell`, `yaml`, `json`, `js`, `go`,
`rust`, and [many more](https://prismjs.com/#supported-languages). No language =
plain monospace block. Inline code uses single backticks: `` `ssh-keygen` ``.

Code blocks render terminal-dark in both light and dark site themes — by design.

---

## 5. Links

```markdown
[All Things SSH - Part 1](/ssh-part-1/)          ← internal: absolute path, both slashes
[OpenSSH release notes](https://www.openssh.com/) ← external: full URL
```

Internal links use the permalink path (never the full `https://hutlab.dev` origin —
keeps local preview working).

### Bookmark cards

Paste a URL **alone in its own paragraph** (blank line above and below) and the build
turns it into a rich bookmark card automatically — favicon, page title, description,
site · domain, and a preview thumbnail when the site provides one:

```markdown
Check out this repo:

https://github.com/hutgrabber/hutlab.dev

More text continues here.
```

Links from **YouTube, X/Twitter, Bluesky, GitHub, Reddit, Threads, Instagram, and
LinkedIn get special hand-crafted cards** instead — see §7 Embeds. Everything else
gets this default bookmark card. Metadata is fetched once at build time and cached
in `bookmark-cache.json` (commit it along with the post so builds stay fast and
reproducible); sites that block bots fall back to a clean domain + URL card.
URLs written inline in a sentence are never upgraded — only bare-URL paragraphs.
In RSS readers every card degrades to a plain link.

### Section links & table of contents

Every heading (h1–h6) automatically gets a stable anchor id, and every post
gets a `$ toc` table of contents — a sticky rail in the right margin on wide
screens, and a collapsible box between the post meta and the body on tablets
and phones. Clicking an entry smooth-scrolls to the section;
the small `⧉` icon next to each entry copies a shareable link. Anyone opening
a shared `…#section` link gets an animated scroll to that exact heading with a
brief highlight. Nothing to set up — it's all derived from your headings.

You can still hand-write a card when you want full control over the text:

```html
<a class="bookmark" href="https://example.com" target="_blank" rel="noopener">
  <span class="bookmark-title">Example Site Title</span>
  <span class="bookmark-desc">One-line description of what's behind the link.</span>
  <span class="bookmark-meta">Author · Publisher</span>
</a>
```

And a button-style link:

```html
<p class="btn-row"><a class="btn" href="https://example.com">Grab the tool →</a></p>
```

---

## 6. Callouts

Obsidian-style callouts work out of the box — paste them straight from your vault:

```markdown
> [!tip] Optional custom title
> Body text. All markdown works in here: **bold**, `code`, [links](/tags/),
> lists, even nested callouts.
```

All 13 Obsidian types are supported, in three visual weights:

| Weight | Types | Look |
|---|---|---|
| **Pop** | `danger` (`error`), `warning` (`caution`, `attention`), `failure` (`fail`, `missing`), `bug` | Strong tinted background + bright border — for things the reader must not miss |
| **Mid** | `tip` (`hint`, `important`), `success` (`check`, `done`), `question` (`help`, `faq`) | Subtle tint + colored border |
| **Blend** | `note`, `info`, `todo`, `abstract` (`summary`, `tldr`), `example`, `quote` (`cite`) | Quiet, blockquote-like — colored accent bar and title only |

Notes:

- Type names are case-insensitive; the aliases in parentheses map to the same style.
- No title text → the type name is used (`> [!note]` shows "Note").
- Each type has a terminal glyph in the title: `[*]` note, `[i]` info, `[!]` warning,
  `[!!]` danger, `[x]` failure, `[✓]` success, `[+]` tip, `[?]` question, `[ ]` todo,
  `[≡]` abstract, `[>]` example, `["]` quote, `[#]` bug.
- Obsidian's foldable markers (`> [!tip]-` / `> [!tip]+`) are accepted but render
  expanded — callouts never collapse on the site.
- Unknown types (`> [!whatever]`) render with the note look.
- A plain `>` blockquote without `[!...]` is untouched (italic, purple bar).

---

## 7. Embeds

**Just paste the link.** A bare URL alone in its own paragraph (blank line above and
below) renders as a native, theme-synced card — no embed codes, no third-party
scripts, no widgets. Eight platforms get hand-crafted treatments:

| Platform | Paste | What renders |
|---|---|---|
| **YouTube** | `youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…` | Click-to-play video card: thumbnail, title, channel; the player (youtube-nocookie) loads only when clicked |
| **X / Twitter** | `x.com/USER/status/…` | Tweet text, author, date |
| **Bluesky** | `bsky.app/profile/…/post/…` | Post text, author + avatar, like/repost/reply counts, image thumbnails |
| **GitHub** | `github.com/owner/repo` or `github.com/user` | Repo card (description, language, ★ stars, ⑂ forks) or profile card (bio, followers) |
| **Reddit** | `reddit.com/r/…/comments/…` (share links work too) | Post title, subreddit, ▲ score, comment count, text preview |
| **Threads** | `threads.net/@user/post/…` | Branded card with the author handle |
| **Instagram** | `instagram.com/p/…` or `/reel/…` | Branded card linking the post |
| **LinkedIn** | `linkedin.com/posts/…`, `/in/…`, `/company/…` | Branded card with the author/company name |

Everything else renders as the default rich bookmark card (§5). All cards match
the site theme in dark and light mode — this is why the old Twitter/Bluesky embed
widgets (with their unfixable white corners in dark mode) are gone.

Details worth knowing:

- Card data is fetched **once at build time** and cached in `bookmark-cache.json` —
  commit it with the post. A deleted post/tweet/repo falls back to a clean default
  card and is retried on the next build.
- Threads, Instagram, and LinkedIn block anonymous scraping, so their cards carry
  the platform branding + whatever the URL reveals (handle, post type) rather than
  the post text itself.
- In RSS readers every card degrades to a plain clickable link.

### Anything else (Asciinema, CodePen, Google Maps, …)

Most services offer an iframe embed. Wrap video-shaped ones in `.video-embed` for
responsive sizing; paste others as-is:

```html
<iframe src="https://..." title="What this embed is" loading="lazy" width="100%" height="400" frameborder="0"></iframe>
```

---

## 8. Preview locally, then publish

```bash
npm install        # first time only
npm start          # live-reloading preview at http://localhost:8080
```

Check your post, then ship it:

```bash
git add .
git commit -m "New post: Hardening SSH Servers"
git push origin master
```

The **Deploy to GitHub Pages** workflow runs on every push to `master` — watch it
under the repo's *Actions* tab if you're curious. Green check = live. The homepage,
tag pages, feeds (`/feed.xml` and `/feed.json` — subscribers get new posts on their
readers' next poll, no extra steps), and search index all update automatically.

---

## 9. Other workflows

**Edit a published post** — edit the file, push. The URL stays stable as long as you
don't touch `permalink`.

**Unpublish a post** — delete the file (or move it out of `src/posts/`), push.
It disappears from the site, feed, tags, and search on the next deploy.

**Draft privately** — keep the file outside `src/posts/` (e.g. a local `drafts/`
folder — it's gitignored territory, or just don't commit it) until it's ready.

**Add a static page** (like About) — create `src/pages/my-page.md` with
`layout: layouts/page.njk` and a `permalink`; no `tags` needed. Pages don't appear
in the post feed.

**Change the navigation** — edit `src/_data/site.json` → `nav` array
(label + url). Same file holds the site title, description, and author info.

**Search** — nothing to maintain. The index (`/search.json`) is rebuilt from all
posts on every deploy; the homepage search box covers titles, tags, descriptions,
and full post text.
