# hutlab.dev

The Hutgrabber blog — all things cyber. Migrated from Ghost (hutgrabber.com) to a fully static
[Eleventy](https://www.11ty.dev/) site, hosted for free on GitHub Pages at **https://hutlab.dev**.

## Writing a new post

1. Create `src/posts/my-new-post.md`:

   ````markdown
   ---
   title: "My New Post"
   date: 2026-07-06
   layout: layouts/post.njk
   permalink: /my-new-post/
   tags: [posts, tutorials]
   description: "One or two sentences shown in the post list, RSS, and search results."
   feature_image: "/assets/images/2026/07/my-cover.jpg"   # optional
   ---

   Write standard Markdown here. Fenced code blocks get syntax highlighting:

   ```bash
   sudo apt update
   ```
   ````

2. Drop any images into `src/assets/images/<year>/<month>/` and reference them
   with absolute paths (`/assets/images/...`).
3. Commit and push to `master`. GitHub Actions builds and deploys automatically —
   live in about a minute.

Notes:
- Always keep `posts` in the `tags` list; extra tags (`tutorials`, `writeups`, …)
  get an archive page at `/tags/<tag>/` automatically.
- Pages (like About) live in `src/pages/` and use `layout: layouts/page.njk`.

## Local preview

```bash
npm install
npm start          # serves http://localhost:8080 with live reload
npm run build      # writes the static site to _site/
```

## How deployment works

Pushing to `master` triggers `.github/workflows/deploy.yml`, which runs Eleventy and
publishes `_site/` via GitHub Pages (source must be set to **GitHub Actions** under
Settings → Pages).

## Custom domain setup (one-time)

1. Repo **Settings → Pages**: set *Source* to **GitHub Actions**, and *Custom domain* to `hutlab.dev`
   (the `CNAME` file in this repo keeps it pinned across deploys).
2. At your DNS registrar for `hutlab.dev`, add apex records pointing at GitHub Pages:

   | Type  | Host | Value |
   |-------|------|-------------------|
   | A     | @    | 185.199.108.153 |
   | A     | @    | 185.199.109.153 |
   | A     | @    | 185.199.110.153 |
   | A     | @    | 185.199.111.153 |
   | AAAA  | @    | 2606:50c0:8000::153 |
   | AAAA  | @    | 2606:50c0:8001::153 |
   | AAAA  | @    | 2606:50c0:8002::153 |
   | AAAA  | @    | 2606:50c0:8003::153 |
   | CNAME | www  | hutgrabber.github.io |

3. Back in Settings → Pages, wait for the DNS check, then tick **Enforce HTTPS**.

## Repo layout

```
src/
  _data/site.json        site title, nav, author info
  _includes/layouts/     base / post / page templates (Nunjucks)
  posts/                 blog posts (Markdown)
  pages/                 static pages (Markdown)
  assets/                css, self-hosted fonts, images
  index.njk              home page (terminal hero + post feed)
  tags.njk               per-tag archive pages
  feed.njk               RSS feed (/feed.xml)
scripts/migrate.py       one-off Ghost-export → Markdown migration (kept for reference)
```

Fonts: [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (body & code) and
[VT323](https://fonts.google.com/specimen/VT323) (pixel headings), both self-hosted — no CDN calls.
