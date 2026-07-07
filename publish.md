# Publishing on hutlab.dev

Everything you need to go from an idea to a live post. The short version: **add one
Markdown file, push to `master`, done.** GitHub Actions builds and deploys the site
automatically — live at [hutlab.dev](https://hutlab.dev) in about a minute.

---

## 1. Create the post file

Posts live in `src/posts/`. Create a new file there, named after the URL slug you want:

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
| `feature_image` | optional | Cover image path, shown atop the post and in link previews |
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

Use a figure block with one of four size classes — this also centers the image and
gives you a styled caption:

```html
<figure class="img-regular">
  <img src="/images/2026-07-06-hardening-ssh/scan-results.png" alt="Nmap scan results" loading="lazy">
  <figcaption>Figure — full TCP scan of the target</figcaption>
</figure>
```

| Class | Width | Use for |
|---|---|---|
| `img-small` | ~60% of the text column | Terminal snippets, tall/narrow screenshots |
| `img-regular` | Full text column (800px) | The default — most screenshots and diagrams |
| `img-big` | Full text column (800px) | Reserved for a future, wider treatment |
| `img-feature` | Full text column (800px), same as the cover | Reserved for a future, wider treatment |

`img-regular`, `img-big`, and `img-feature` all render at the same width today —
the text column itself is 800px, one step wider than the header/footer bar, so
there's no room left to break out further. They're kept as distinct classes so
sizing can be tuned independently later without touching any posts. Plain
`<figure>`, the legacy `class="figure"`, and bare Markdown images all render at
`img-regular` size. On phones every size collapses to full width (`img-small`
stays a bit narrower).

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
keeps local preview working). There's also a styled link-card for showcasing a URL:

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

## 6. Embeds

Markdown accepts raw HTML, so embeds are copy-paste. Put them on their own line with
a blank line above and below.

### YouTube

Take the video ID from the URL (`youtube.com/watch?v=VIDEO_ID`) and use the site's
responsive wrapper:

```html
<div class="video-embed">
  <iframe src="https://www.youtube.com/embed/VIDEO_ID"
          title="Video title for accessibility"
          loading="lazy" frameborder="0" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
</div>
```

The `.video-embed` wrapper keeps it 16:9 and full-width on every screen size.

### Twitter / X

On the tweet, choose **Embed post** (or build it at [publish.twitter.com](https://publish.twitter.com)),
then paste the snippet — it looks like this:

```html
<blockquote class="twitter-tweet" data-dnt="true">
  <a href="https://twitter.com/USER/status/TWEET_ID"></a>
</blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
```

The `<script>` line is only needed once per post, even with multiple tweets.
Before the script loads (or if it's blocked), readers see a plain link — fine.

### Bluesky

On the post, choose **Embed post** (or use [embed.bsky.app](https://embed.bsky.app)),
then paste:

```html
<blockquote class="bluesky-embed" data-bluesky-uri="at://DID/app.bsky.feed.post/POST_ID">
  <a href="https://bsky.app/profile/HANDLE/post/POST_ID">View on Bluesky</a>
</blockquote>
<script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>
```

### Anything else (Asciinema, CodePen, Google Maps, …)

Most services offer an iframe embed. Wrap video-shaped ones in `.video-embed` for
responsive sizing; paste others as-is:

```html
<iframe src="https://..." title="What this embed is" loading="lazy" width="100%" height="400" frameborder="0"></iframe>
```

---

## 7. Preview locally, then publish

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

## 8. Other workflows

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
