/* Stable anchor ids for h1-h6 so headings can be linked and listed in the
   table of contents. Runs at the end of the core chain, after "inline", so
   slugs come from the parsed heading text (markdown/tags stripped). */

function slugify(text) {
  const s = String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // fold accents
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // strip punctuation, keep letters/digits
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
  return s || "section";
}

export default function headingIds(md) {
  md.core.ruler.push("heading_ids", (state) => {
    const seen = new Map(); // per-render, so ids are deterministic per page
    for (let i = 0; i < state.tokens.length; i++) {
      const t = state.tokens[i];
      if (t.type !== "heading_open" || t.attrGet("id")) continue;
      const inline = state.tokens[i + 1];
      if (!inline || inline.type !== "inline") continue;
      const text = (inline.children || [])
        .filter((c) => c.type === "text" || c.type === "code_inline")
        .map((c) => c.content)
        .join("");
      let slug = slugify(text);
      const n = (seen.get(slug) || 0) + 1;
      seen.set(slug, n);
      if (n > 1) slug = `${slug}-${n}`;
      t.attrSet("id", slug);
    }
  });
}
