/* Bare-URL bookmark paragraphs for markdown-it.
   A paragraph whose entire content is one bare URL becomes a fallback
   marker (a plain link) that the bookmarkCards Eleventy transform upgrades
   to a rich card on HTML outputs. Feeds and search keep the plain link. */

const BARE_URL = /^https?:\/\/[^\s<>]+$/;

export default function bookmarks(md) {
  md.core.ruler.after("block", "bookmark_urls", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "paragraph_open") continue;
      const inline = tokens[i + 1];
      const close = tokens[i + 2];
      if (!inline || inline.type !== "inline") continue;
      if (!close || close.type !== "paragraph_close") continue;

      const url = inline.content.trim();
      if (!BARE_URL.test(url)) continue;

      const esc = md.utils.escapeHtml(url);
      const display = md.utils.escapeHtml(
        url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
      );
      const html = new state.Token("html_block", "", 0);
      html.block = true;
      html.content =
        `<p class="bookmark-fallback" data-bookmark="${esc}">` +
        `<a href="${esc}" target="_blank" rel="noopener">${display}</a></p>\n`;
      tokens.splice(i, 3, html);
    }
  });
}
