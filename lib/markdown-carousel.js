/* Carousel containers for markdown-it.

   ::: carousel rail=labels title="A short history"
   Optional lead-in text, shown above the cards.
   ::: card label="1979" title="chroot" tag="before Linux" tone=blue
   Card text. Any markdown works here.
   ::: card title="A screenshot" image="/images/2026-01-01-post/shot.png" alt="What it shows"
   :::

   `::: carousel` opens the block, every `::: card` line starts a new card,
   and a bare `:::` closes the whole thing. The output is an ordered list
   (so feeds and no-JS readers get plain, readable content) that
   carousel.css lays out as a row of cards and carousel.js adds controls to.
   Zero dependencies. Full writer documentation: drafts/template.md. */

const OPEN = /^:::[ \t]*carousel\b(.*)$/i;
const CARD = /^:::[ \t]*card\b(.*)$/i;
const CLOSE = /^:::[ \t]*$/;
const FENCE = /^(`{3,}|~{3,})/;

const RAILS = new Set(["labels", "numbers", "dots", "none"]);
const VIEWS = new Set(["peek", "single"]);
const TONES = new Set(["purple", "blue", "teal", "green", "pink", "amber", "yellow", "red"]);
const CAROUSEL_KEYS = new Set(["rail", "title", "id", "view", "cardlabels", "counter"]);
const CARD_KEYS = new Set(["label", "title", "tag", "tone", "image", "alt", "caption"]);
const OFF = new Set(["off", "no", "false", "0", "hide", "hidden"]);

/* key=value, key="value with spaces", key='value', or a bare flag (= "on") */
function parseAttrs(str) {
  const out = {};
  const re = /([A-Za-z][\w-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
  let m;
  while ((m = re.exec(str))) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "on";
  }
  return out;
}

export default function carousel(md) {
  const esc = md.utils.escapeHtml;

  function rule(state, startLine, endLine, silent) {
    // indented 4+ spaces is a code block, not a container
    if (state.sCount[startLine] - state.blkIndent >= 4) return false;

    const text = (l) => state.src.slice(state.bMarks[l] + state.tShift[l], state.eMarks[l]);
    const open = OPEN.exec(text(startLine));
    if (!open) return false;

    // scan to the closing `:::`, noting where each card starts; `:::` lines
    // inside a fenced code block are content, not markers
    const cardLines = [];
    let closeLine = -1;
    let fence = null;
    for (let l = startLine + 1; l < endLine; l++) {
      const t = text(l);
      const f = FENCE.exec(t);
      if (fence) {
        if (f && f[1][0] === fence[0] && f[1].length >= fence.length && t.trim() === f[1]) fence = null;
        continue;
      }
      if (f) { fence = f[1]; continue; }
      if (CARD.test(t)) cardLines.push(l);
      else if (CLOSE.test(t)) { closeLine = l; break; }
    }
    const where = (state.env && state.env.page && state.env.page.inputPath) || "markdown";
    const warn = (line, msg) => console.warn(`[carousel] ${where}:${line + 1} ${msg}`);

    // unclosed or cardless: leave the text alone rather than guess
    if (closeLine < 0 || !cardLines.length) {
      if (!silent) {
        warn(startLine, closeLine < 0
          ? "carousel is never closed (add a bare ::: line), left as plain text"
          : "carousel has no ::: card lines, left as plain text");
      }
      return false;
    }
    if (silent) return true;
    const check = (attrs, known, line, kind) => {
      for (const k of Object.keys(attrs)) {
        if (!known.has(k)) warn(line, `unknown ${kind} option "${k}" (ignored)`);
      }
    };

    /* ---- carousel options ---- */
    const opt = parseAttrs(open[1]);
    check(opt, CAROUSEL_KEYS, startLine, "carousel");
    let rail = (opt.rail || "labels").toLowerCase();
    if (!RAILS.has(rail)) { warn(startLine, `unknown rail "${rail}", using labels`); rail = "labels"; }
    let view = (opt.view || "peek").toLowerCase();
    if (!VIEWS.has(view)) { warn(startLine, `unknown view "${view}", using peek`); view = "peek"; }
    const cardLabels = !OFF.has(String(opt.cardlabels || "on").toLowerCase());
    const counter = !OFF.has(String(opt.counter || "on").toLowerCase());

    const html = (content) => {
      const t = state.push("html_block", "", 0);
      t.content = content;
      t.map = [startLine, closeLine + 1];
    };
    const nested = (from, to) => {
      const oldMax = state.lineMax;
      const oldParent = state.parentType;
      state.lineMax = to;
      state.parentType = "carousel";
      state.md.block.tokenize(state, from, to);
      state.lineMax = oldMax;
      state.parentType = oldParent;
    };
    const hasText = (from, to) => {
      for (let l = from; l < to; l++) if (text(l).trim() !== "") return true;
      return false;
    };

    html(
      `<div class="carousel" data-carousel data-rail="${rail}" data-view="${view}"` +
        (counter ? "" : ` data-counter="off"`) +
        (opt.id ? ` id="${esc(opt.id)}"` : "") +
        ` role="group" aria-roledescription="carousel"` +
        (opt.title ? ` aria-label="${esc(opt.title)}"` : "") +
        `>\n`
    );

    // anything between the opening line and the first card is a lead-in
    if (hasText(startLine + 1, cardLines[0])) {
      html(`<div class="carousel-intro">\n`);
      nested(startLine + 1, cardLines[0]);
      html(`</div>\n`);
    }

    html(`<ol class="carousel-track" tabindex="0">\n`);

    /* ---- cards ---- */
    cardLines.forEach((line, i) => {
      const end = i + 1 < cardLines.length ? cardLines[i + 1] : closeLine;
      const c = parseAttrs(CARD.exec(text(line))[1]);
      check(c, CARD_KEYS, line, "card");

      let tone = (c.tone || "").toLowerCase();
      if (tone && !TONES.has(tone)) { warn(line, `unknown tone "${tone}" (ignored)`); tone = ""; }
      if (c.image && !c.alt) warn(line, `image without alt text`);

      const body = hasText(line + 1, end);
      // a card that is nothing but an image keeps its label for the rail only
      const showLabel = cardLabels && c.label && (!c.image || c.title || c.tag || body);
      const hasBody = Boolean(showLabel || c.title || c.tag || body);
      const classes = ["carousel-card"];
      if (tone) classes.push(`tone-${tone}`);
      if (c.image) classes.push(hasBody ? "has-image" : "is-image-only");

      let out = `<li class="${classes.join(" ")}"` + (c.label ? ` data-label="${esc(c.label)}"` : "") + `>\n`;

      if (c.image) {
        out +=
          `<div class="carousel-media"><img src="${esc(c.image)}" alt="${esc(c.alt || "")}" loading="lazy" decoding="async">` +
          (c.caption ? `<span class="carousel-caption">${state.md.renderInline(c.caption)}</span>` : "") +
          `</div>\n`;
      }

      if (hasBody) {
        out += `<div class="carousel-body">\n`;
        if (showLabel) out += `<strong class="carousel-label">${esc(c.label)}</strong>\n`;
        if (c.title) out += `<span class="carousel-title">${state.md.renderInline(c.title)}</span>\n`;
        if (c.tag) out += `<em class="carousel-tag">${esc(c.tag)}</em>\n`;
        if (body) out += `<div class="carousel-text">\n`;
      }
      html(out);

      if (body) nested(line + 1, end);

      html((hasBody ? (body ? `</div>\n` : "") + `</div>\n` : "") + `</li>\n`);
    });

    html(`</ol>\n</div>\n`);
    state.line = closeLine + 1;
    return true;
  }

  md.block.ruler.before("fence", "carousel", rule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
}
