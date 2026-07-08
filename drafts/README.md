# Drafts

Write posts here (great as an Obsidian vault folder) — everything in this folder
except this README and `template.md` is **ignored by git**, so drafts never end
up on GitHub or the live site.

Starting a new post:

1. **Duplicate [`template.md`](template.md)** — it has the front matter pre-filled
   and a working example of every element the site can render. Rename the copy,
   write, and delete the example sections you don't need.
2. Drop the post's images into `src/images/<date>-<short-name>/` with 1-2 word
   descriptive filenames (see [publish.md](../publish.md) §3 for details)
3. When ready, move the `.md` file to `src/posts/`
4. Commit and push to `master` — live in about a minute

Obsidian tip: open the repo root as your vault (or add it to an existing vault).
The `.obsidian/` config folder is gitignored too, so your workspace settings,
themes, and plugins stay out of the repository.

---
# To Do:
- [ ] Fix your image uploading pipeline
	- Any size image file can be inserted and it gets auto-cropped
	- New image sizes are pre-defined
- [ ] Make a new file with new widths.
