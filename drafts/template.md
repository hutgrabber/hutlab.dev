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

> [!danger] Custom

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

## Carousel

A sideways-scrolling row of cards with previous/next buttons, a clickable
rail underneath, and arrow-key and swipe support. No front matter and no
setup: a page loads the carousel's CSS and JS on its own when it contains
one. With JavaScript off, and in RSS readers, it falls back to a plain
numbered list, so nothing is ever lost.

It is made of three named blocks:

| Block | What it is | How you write it |
|---|---|---|
| **carousel** | the whole thing | a `::: carousel` line, closed by a bare `:::` |
| **card** | one slide | a `::: card` line, then that card's text |
| **rail** | the strip under the cards, one stop per card | the `rail=` option on the carousel |

The rules: `::: carousel` opens the block, every `::: card` line starts a
new card (cards have no closing line of their own), and one bare `:::`
closes the carousel. Options are `key=value`; put quotes around values with
spaces, like `title="Two words"`. Text between the opening line and the
first card becomes a lead-in shown above the cards.

**Carousel options** (all optional)

| Option | Values | Default | What it does |
|---|---|---|---|
| `rail` | `labels`, `numbers`, `dots`, `none` | `labels` | What the rail shows for each card: its `label`, its number, a dot, or nothing. |
| `view` | `peek`, `single` | `peek` | `peek` shows one card with the next one peeking in. `single` shows one full-width card at a time, good for image galleries. |
| `cardlabels` | `on`, `off` | `on` | `on` prints each card's `label` as the big line on the card too. `off` keeps labels on the rail only. |
| `counter` | `on`, `off` | `on` | The "label · 3 of 14" line under the rail. |
| `title` | text | none | A name for the carousel, read out by screen readers. |
| `id` | a-slug | none | An anchor, so you can link straight to it with `#a-slug`. |

**Card options** (all optional, but give a card at least a title, some text or an image)

| Option | What it does |
|---|---|
| `label` | Short text for this card's stop on the rail: a year, "Step 2", "Recon". Also printed large on the card, unless the carousel has `cardlabels=off` or the card is an image card. A card with no label shows its number on the rail. |
| `title` | The card's heading. Inline markdown works, so `` title="Meet `runc`" `` is fine. |
| `tag` | A small uppercase line under the title. |
| `tone` | Colour of the card's top border, label, tag and rail stop: `purple` (default), `blue`, `teal`, `green`, `pink`, `amber`, `yellow`, `red`. |
| `image` | Image path, absolute like every other image: `/images/<date>-<short-name>/<file>`. |
| `alt` | Alt text for the image. Always set it with `image`; the build warns if it is missing. |
| `caption` | A small caption under the image. Inline markdown works. |

**Card layouts.** There is nothing to choose: the layout follows from what
you give the card.

1. **Text card**: `title` and text, no `image`.
2. **Image card**: `image` only (plus `alt`, and a `caption` if you like). A `label` still names it on the rail, but nothing is printed over or under the image.
3. **Combo card**: `image` on top, `title` and text underneath.

All three in one carousel, with labels on the rail:

::: carousel rail=labels title="Example carousel: the three card layouts"
An optional lead-in line. Delete it if you don't need one.
::: card label="Text" title="A text card" tag="title + text" tone=teal
Any markdown works in here: **bold**, `inline code`, [links](/tags/), even
lists and code blocks.
::: card label="Image" image="/images/2026-01-01-short-name/example.png" alt="Describe the image for screen readers" caption="An image card: no title, no text, just this caption"
::: card label="Both" title="A combo card" tag="image + title + text" tone=pink image="/images/2026-01-01-short-name/example.png" alt="Describe the image for screen readers"
The image sits on top, the title and this text below it.
:::

**Changing the rail.** The rail shows whatever you put in each card's
`label`, so a timeline uses years, a walkthrough can use step names, and a
gallery can skip text entirely:

::: carousel rail=numbers cardlabels=off title="Example carousel: numbered steps"
::: card title="Enumerate" tone=blue
`rail=numbers` prints 1, 2, 3 on the rail, whatever the labels are.
::: card title="Exploit" tone=amber
`cardlabels=off` hides the big label line, so the title leads the card.
::: card title="Escalate" tone=red
Each card's `tone` also colours its stop on the rail.
:::

::: carousel rail=dots view=single counter=off title="Example carousel: image gallery"
::: card image="/images/2026-01-01-short-name/example.png" alt="First screenshot" caption="rail=dots, view=single, counter=off"
::: card image="/images/2026-01-01-short-name/example.png" alt="Second screenshot" caption="One full-width image at a time"
:::

Good to know:

- Keep labels short (a year, a word or two). If the labels can't fit on one
  line, on a phone for instance, the rail switches itself to dots.
- Don't use headings (`##`) inside a card, they would leak into the table of
  contents. That is what `title=` is for.
- Every card in a carousel is as tall as its tallest card. Images scale to
  the card's width and are capped in height, so one carousel looks best
  with images of a similar shape and cards of a similar length.
- Mistakes show up in the terminal when you build, with the file and line:
  `[carousel] ./src/posts/my-post.md:42 unknown card option "titel" (ignored)`.
  A carousel with no closing `:::`, or with no cards, is left as plain text
  and reported the same way.
- The class name of every block is listed at the top of
  `src/assets/css/carousel.css`, for when you want to restyle one.

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

Pixel buttons, for a row of chunky retro links (the About page uses them for
socials). Wrap the buttons in `pixel-btns`; they share the row in equal
widths and wrap on small screens. Give each one a colour class: `px-green`,
`px-yellow`, `px-blue`, `px-red` or `px-teal` (Catppuccin Mocha in dark
mode, Latte in light mode). The small `pixel-btn-tag` chip and the
`pixel-panel` frame with its title line are both optional.

<div class="pixel-panel">
<p class="pixel-panel-title"><span class="prompt-glyph">$</span> ls ~/links</p>
<div class="pixel-btns">
<a class="pixel-btn px-green" href="https://example.com"><span class="pixel-btn-tag">&lt;/&gt;</span>Source</a>
<a class="pixel-btn px-blue" href="https://example.com">Docs</a>
<a class="pixel-btn px-red" href="https://example.com"><span class="pixel-btn-tag">!</span>Report a bug</a>
</div>
</div>

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
