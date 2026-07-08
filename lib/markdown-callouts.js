/* Obsidian-style callouts for markdown-it.
   `> [!type] optional title` as the first line of a blockquote becomes
   <div class="callout" data-callout="type"><p class="callout-title">…</p>…</div>
   Fold markers ([!type]- / [!type]+) are accepted but rendered expanded. */

const ALIASES = {
  summary: "abstract",
  tldr: "abstract",
  hint: "tip",
  important: "tip",
  check: "success",
  done: "success",
  help: "question",
  faq: "question",
  caution: "warning",
  attention: "warning",
  fail: "failure",
  missing: "failure",
  error: "danger",
  cite: "quote",
};

const KNOWN = new Set([
  "note", "abstract", "info", "todo", "tip", "success", "question",
  "warning", "failure", "danger", "bug", "example", "quote",
]);

// [!type] or [!type]- / [!type]+, then either end-of-line or whitespace + title
const MARKER = /^\[!([a-zA-Z][a-zA-Z0-9-]*)\]([+-]?)(?:[ \t]+(.*))?$/;

export default function callouts(md) {
  md.core.ruler.after("block", "obsidian_callouts", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") continue;
      const pOpen = tokens[i + 1];
      const inline = tokens[i + 2];
      if (!pOpen || pOpen.type !== "paragraph_open") continue;
      if (!inline || inline.type !== "inline") continue;

      const nl = inline.content.indexOf("\n");
      const firstLine = nl === -1 ? inline.content : inline.content.slice(0, nl);
      const m = MARKER.exec(firstLine);
      if (!m) continue; // plain blockquote

      const typed = m[1].toLowerCase();
      const type = ALIASES[typed] || typed;
      const title =
        (m[3] || "").trim() ||
        m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();

      // retag the blockquote pair as div.callout (unknown types keep their
      // name and inherit the base .callout look)
      let depth = 1;
      let j = i + 1;
      for (; j < tokens.length; j++) {
        if (tokens[j].type === "blockquote_open") depth++;
        else if (tokens[j].type === "blockquote_close" && --depth === 0) break;
      }
      if (j === tokens.length) continue; // unbalanced; leave untouched

      const open = tokens[i];
      open.type = "callout_open";
      open.tag = "div";
      open.attrSet("class", "callout");
      open.attrSet("data-callout", KNOWN.has(type) ? type : typed);
      tokens[j].type = "callout_close";
      tokens[j].tag = "div";

      // title tokens — the inline token's content is parsed by the core
      // "inline" rule after this rule, so markdown in titles renders
      const tOpen = new state.Token("callout_title_open", "p", 1);
      tOpen.attrSet("class", "callout-title");
      tOpen.block = true;
      const tInline = new state.Token("inline", "", 0);
      tInline.content = title;
      tInline.children = [];
      const tClose = new state.Token("callout_title_close", "p", -1);
      tClose.block = true;

      const rest = nl === -1 ? "" : inline.content.slice(nl + 1);
      if (rest.trim() === "") {
        tokens.splice(i + 1, 3, tOpen, tInline, tClose);
      } else {
        inline.content = rest;
        tokens.splice(i + 1, 0, tOpen, tInline, tClose);
      }
      i += 3;
    }
  });
}
