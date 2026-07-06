import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
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

  // Make root-relative URLs absolute (for RSS readers fetching content)
  eleventyConfig.addFilter("absoluteUrls", (html, base) =>
    String(html || "")
      .replaceAll('src="/', `src="${base}/`)
      .replaceAll('href="/', `href="${base}/`)
  );

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
