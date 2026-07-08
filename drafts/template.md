---
title: "Your Post Title Here"
date: 2026-01-01
layout: layouts/post.njk
permalink: /your-url-slug/
tags: [posts, updates]
description: "One or two sentences shown on the homepage, in search results, in RSS readers, and on social link previews."
feature_image: "/images/2026-01-01-short-name/cover.jpg"
feature_image_caption: "Optional caption shown under the cover image — delete this line if unused"
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
A dashed horizontal rule (the `---` above) separates sections.

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

Four sizes, chosen with a class on the figure tag. Replace the src paths with
your post's images (`/images/<date>-<short-name>/<description>.png`).

<figure class="img-small">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image for screen readers" loading="lazy">
  <figcaption>img-small — ~60% width; terminal snippets, tall screenshots</figcaption>
</figure>

<figure class="img-regular">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image" loading="lazy">
  <figcaption>img-regular — full text width; the default for most screenshots</figcaption>
</figure>

<figure class="img-big">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image" loading="lazy">
  <figcaption>img-big — currently same as regular; reserved for future tuning</figcaption>
</figure>

<figure class="img-feature">
  <img src="/images/2026-01-01-short-name/example.png" alt="Describe the image" loading="lazy">
  <figcaption>img-feature — currently same as regular; matches the cover width</figcaption>
</figure>

A bare Markdown image also works (renders at regular size, no caption):

![Describe the image](/images/2026-01-01-short-name/example.png)

---

## Tables

| Flag | Meaning | Default |
|---|---|---|
| `-p` | Port range to scan | top 1000 |
| `-sV` | Probe service versions | off |
| `-oA` | Output in all formats | — |

---

## Link Cards & Buttons

A styled bookmark card for showcasing a URL:

<a class="bookmark" href="https://github.com/hutgrabber" target="_blank" rel="noopener">
  <span class="bookmark-title">Title of the Linked Page</span>
  <span class="bookmark-desc">One-line description of what's behind the link.</span>
  <span class="bookmark-meta">Author · Site name</span>
</a>

A button-style link:

<p class="btn-row"><a class="btn" href="https://example.com">Grab the tool →</a></p>

---

## Embeds

**YouTube** — swap in the VIDEO_ID from `youtube.com/watch?v=VIDEO_ID`. The
wrapper keeps it 16:9 and responsive. (RSS readers automatically get a
"▶ Watch on YouTube" link instead.)

<div class="video-embed">
  <iframe src="https://www.youtube.com/embed/VIDEO_ID"
          title="Video title for accessibility"
          loading="lazy" frameborder="0" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
</div>

**Twitter / X** — use "Embed post" on the tweet (or publish.twitter.com) and
paste. The script line is needed once per post, even with several tweets:

<blockquote class="twitter-tweet" data-dnt="true">
  <a href="https://twitter.com/USER/status/TWEET_ID"></a>
</blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

**Bluesky** — use "Embed post" on the post (or embed.bsky.app) and paste:

<blockquote class="bluesky-embed" data-bluesky-uri="at://DID/app.bsky.feed.post/POST_ID">
  <a href="https://bsky.app/profile/HANDLE/post/POST_ID">View on Bluesky</a>
</blockquote>
<script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>

**Anything else** (Asciinema, CodePen, maps...) — paste the service's iframe;
wrap video-shaped ones in `<div class="video-embed">` for responsive sizing.

---

Closing paragraph. Delete everything you didn't use — shorter posts read better.
