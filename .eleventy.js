import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import callouts from "./lib/markdown-callouts.js";
import bookmarks from "./lib/markdown-bookmarks.js";
import headingIds from "./lib/markdown-heading-ids.js";
import { flushCache } from "./lib/bookmark-meta.js";
import { resolveEmbedCard } from "./lib/embed-cards.js";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.amendLibrary("md", (md) =>
    md.use(callouts).use(bookmarks).use(headingIds)
  );

  // Consecutive <figure class="img-h1|img-h2"> (pair) or img-q1..q4 (quadrant)
  // figures get wrapped in a grid container on HTML pages; feeds read
  // templateContent and keep them as plain sequential figures
  // (?:(?!<\/?figure)[\s\S])*? = lazy body that cannot cross another figure
  // tag, so one match is always exactly one figure (backtracking can't make
  // a match swallow the content between two figures)
  const GFIG = /<figure class="img-([hq])([1-4])"[^>]*>(?:(?!<\/?figure)[\s\S])*?<\/figure>/;
  const GRUN = new RegExp(`(?:${GFIG.source}\\s*){2,}`, "g");
  eleventyConfig.addTransform("imageGroups", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    if (!/class="img-[hq][1-4]"/.test(content)) return content;

    return content.replace(GRUN, (run) => {
      const figs = [...run.matchAll(new RegExp(GFIG.source, "g"))].map((m) => ({
        family: m[1],
        n: Number(m[2]),
        html: m[0],
      }));
      // split where the family flips (h vs q), then chunk by capacity
      const out = [];
      let seg = [];
      const flush = () => {
        if (!seg.length) return;
        const cap = seg[0].family === "h" ? 2 : 4;
        for (let i = 0; i < seg.length; i += cap) {
          const chunk = seg.slice(i, i + cap).sort((a, b) => a.n - b.n);
          if (chunk.length === 1) {
            out.push(chunk[0].html);
          } else {
            const cls = chunk[0].family === "h" ? "img-pair" : "img-quad";
            out.push(
              `<div class="img-group ${cls}">\n${chunk.map((f) => f.html).join("\n")}\n</div>`
            );
          }
        }
        seg = [];
      };
      for (const fig of figs) {
        if (seg.length && seg[0].family !== fig.family) flush();
        seg.push(fig);
      }
      flush();
      return out.join("\n") + "\n";
    });
  });

  // Headings of a post, for the table of contents rail
  eleventyConfig.addFilter("tocHeadings", (html) => {
    const out = [];
    for (const m of String(html || "").matchAll(
      /<h([1-6])[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g
    )) {
      const text = m[3]
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      out.push({ level: Number(m[1]), id: m[2], text });
    }
    return out;
  });

  // Bare-URL paragraphs → rich bookmark cards (HTML pages only; feeds and
  // search read templateContent, which keeps the plain-link fallback)
  const BOOKMARK_MARKER = /<p class="bookmark-fallback" data-bookmark="([^"]*)">.*?<\/p>/gs;
  eleventyConfig.addTransform("bookmarkCards", async function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    if (!content.includes("bookmark-fallback")) return content;

    const jobs = new Map();
    for (const [, escUrl] of content.matchAll(BOOKMARK_MARKER)) {
      const url = escUrl
        .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      if (!jobs.has(escUrl)) jobs.set(escUrl, resolveEmbedCard(url));
    }
    const cards = new Map();
    for (const [escUrl, job] of jobs) {
      cards.set(escUrl, await job);
    }
    return content.replace(BOOKMARK_MARKER, (match, escUrl) => cards.get(escUrl) ?? match);
  });

  // persist newly fetched bookmark metadata (bookmark-cache.json, committed)
  eleventyConfig.on("eleventy.after", flushCache);
  eleventyConfig.watchIgnores.add("bookmark-cache.json");

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ CNAME: "CNAME" });

  eleventyConfig.addCollection("posts", (collectionApi) =>
    collectionApi.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date)
  );

  // All tags in use across posts, with counts
  eleventyConfig.addCollection("tagList", (collectionApi) => {
    const counts = new Map();
    for (const post of collectionApi.getFilteredByGlob("src/posts/*.md")) {
      for (const tag of post.data.tags || []) {
        if (tag === "posts") continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  eleventyConfig.addFilter("readableDate", (date) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    })
  );

  eleventyConfig.addFilter("isoDate", (date) => new Date(date).toISOString());

  eleventyConfig.addFilter("rfc822Date", (date) => new Date(date).toUTCString());

  // Tags a post should display (everything except the internal "posts" tag)
  eleventyConfig.addFilter("displayTags", (tags) =>
    (tags || []).filter((t) => t !== "posts")
  );

  // Post HTML prepared for feed readers: absolute URLs, and YouTube embed
  // iframes swapped for plain links (readers strip iframes, leaving a gap)
  eleventyConfig.addFilter("feedContent", (html, base) =>
    String(html || "")
      // bookmark markers degrade to a plain link paragraph in feeds
      .replace(/<p class="bookmark-fallback" data-bookmark="[^"]*">/g, "<p>")
      .replace(
        /<div class="video-embed">\s*<iframe([^>]*)>\s*<\/iframe>\s*<\/div>/g,
        (match, attrs) => {
          const src = attrs.match(/src="https:\/\/www\.youtube\.com\/embed\/([\w-]+)/);
          if (!src) return match; // non-YouTube embed: leave as-is
          const title = attrs.match(/title="([^"]*)"/);
          const label =
            title && title[1] && title[1] !== "Embedded video" ? `: ${title[1]}` : "";
          return `<p><a href="https://www.youtube.com/watch?v=${src[1]}">▶ Watch on YouTube${label}</a></p>`;
        }
      )
      .replaceAll('src="/', `src="${base}/`)
      .replaceAll('href="/', `href="${base}/`)
  );

  // YYYY-MM-DD, used for stable tag: URIs in feed guids
  eleventyConfig.addFilter("isoDateOnly", (date) =>
    new Date(date).toISOString().slice(0, 10)
  );

  // URLs of other posts this post's body links to (for the /tags/ graph)
  eleventyConfig.addFilter("internalLinks", (html, posts, selfUrl) => {
    const known = new Set(posts.map((p) => p.url));
    const found = new Set();
    for (const m of String(html || "").matchAll(/href="(\/[^"/]+\/)"/g)) {
      if (known.has(m[1]) && m[1] !== selfUrl) found.add(m[1]);
    }
    return [...found];
  });

  // Escape a string for safe inclusion inside an XML CDATA section
  eleventyConfig.addFilter("cdata", (html) =>
    String(html || "").replaceAll("]]>", "]]]]><![CDATA[>")
  );

  // Search index text: strip HTML, collapse whitespace, lowercase
  eleventyConfig.addFilter("squash", (html) =>
    String(html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );

  eleventyConfig.addFilter("readingTime", (words) => {
    const minutes = Math.max(1, Math.round(words / 220));
    return `${minutes} min read`;
  });

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  // Changes every build; appended to CSS/JS URLs so GitHub Pages' 10-minute
  // asset cache can never serve stale styles with fresh HTML
  eleventyConfig.addGlobalData("buildId", () => Date.now().toString(36));

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
