/* Build-time bookmark metadata: fetch a URL's OpenGraph/title/favicon once,
   cache it in bookmark-cache.json (committed, repo root), and render the
   rich card HTML used by the bookmarkCards transform. Zero dependencies. */

import { readFileSync, writeFileSync } from "node:fs";

const CACHE_PATH = new URL("../bookmark-cache.json", import.meta.url);
export const UA = "Mozilla/5.0 (compatible; hutlab.dev build bot)";

let cache = null; // url -> meta object ({} file missing is fine)
let dirty = false;
const inFlight = new Map(); // url -> Promise (dedupe within one build)
const failed = new Set(); // urls that failed this build (never persisted)

function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

export function getCached(url) {
  return loadCache()[url] || null;
}

export function putCached(url, entry) {
  loadCache()[url] = entry;
  dirty = true;
}

export function flushCache() {
  if (!dirty || !cache) return;
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");
  dirty = false;
}

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", middot: "·", bull: "•",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™", deg: "°",
};

export function decodeEntities(s) {
  return String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function attr(tag, name) {
  const m =
    tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i")) ||
    tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? m[1] : null;
}

function parseHead(html, baseUrl) {
  const meta = {};
  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const key = (attr(tag, "property") || attr(tag, "name") || "").toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !(key in meta)) meta[key] = decodeEntities(content);
  }
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const host = new URL(baseUrl).hostname.replace(/^www\./, "");

  const abs = (v) => {
    try {
      return new URL(v, baseUrl).href;
    } catch {
      return null;
    }
  };

  let icon = null;
  for (const [tag] of html.matchAll(/<link\s[^>]*>/gi)) {
    const rel = (attr(tag, "rel") || "").toLowerCase();
    if (rel.includes("icon") && !rel.includes("mask")) {
      const href = attr(tag, "href");
      if (href) {
        icon = abs(decodeEntities(href));
        if (rel === "icon" || rel === "shortcut icon") break; // prefer plain icons
      }
    }
  }

  return {
    title:
      meta["og:title"] || meta["twitter:title"] ||
      (titleTag ? decodeEntities(titleTag[1]).trim() : "") || host,
    description:
      meta["og:description"] || meta["twitter:description"] ||
      meta["description"] || "",
    siteName: meta["og:site_name"] || "",
    image: abs(meta["og:image"] || meta["twitter:image"] || "") || null,
    favicon: icon || abs("/favicon.ico"),
  };
}

async function checkFavicon(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
    });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

// X serves no OpenGraph to bots; its public oEmbed endpoint still works
async function fetchTweet(url) {
  const res = await fetch(
    `https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`,
    { headers: { "user-agent": UA }, signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const text = decodeEntities(String(data.html || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return {
    title: data.author_name ? `Post by ${data.author_name}` : "Post on X",
    description: text.length > 220 ? text.slice(0, 217) + "…" : text,
    siteName: "X",
    image: null,
    favicon: null,
  };
}

export async function fetchMeta(url) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "twitter.com" || host === "x.com") return fetchTweet(url);

  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8" },
    signal: AbortSignal.timeout(6000),
    redirect: "follow",
  });
  if (!res.ok) return null;
  if (!(res.headers.get("content-type") || "").includes("text/html")) return null;
  const html = (await res.text()).slice(0, 500_000);
  const meta = parseHead(html, res.url || url);
  meta.favicon = await checkFavicon(meta.favicon);
  return meta;
}

/* Resolve metadata for a URL: cache -> fetch -> null. Failures are
   remembered for this build only, never written to the cache file. */
export async function resolveBookmark(url) {
  const store = loadCache();
  if (store[url]) return store[url];
  if (failed.has(url)) return null;
  if (inFlight.has(url)) return inFlight.get(url);

  const p = (async () => {
    try {
      const meta = await fetchMeta(url);
      if (meta && meta.title) {
        store[url] = { kind: "bookmark", fetchedAt: new Date().toISOString().slice(0, 10), ...meta };
        dirty = true;
        return store[url];
      }
    } catch {
      /* fall through to failure */
    }
    failed.add(url);
    return null;
  })();
  inFlight.set(url, p);
  return p;
}

export const escapeHtml = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function renderBookmarkCard(url, meta) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const e = escapeHtml;

  if (!meta) {
    // graceful fallback: domain as title, full URL as meta line
    return (
      `<a class="bookmark bookmark-rich" href="${e(url)}" target="_blank" rel="noopener">` +
      `<span class="bookmark-body">` +
      `<span class="bookmark-title">${e(host)}</span>` +
      `<span class="bookmark-meta">${e(url)}</span>` +
      `</span></a>`
    );
  }

  const metaLine =
    meta.siteName && meta.siteName.toLowerCase() !== host ? `${meta.siteName} · ${host}` : host;
  return (
    `<a class="bookmark bookmark-rich" href="${e(url)}" target="_blank" rel="noopener">` +
    `<span class="bookmark-body">` +
    `<span class="bookmark-title">` +
    (meta.favicon
      ? `<img class="bookmark-favicon" src="${e(meta.favicon)}" alt="" loading="lazy">`
      : "") +
    `${e(meta.title)}</span>` +
    (meta.description
      ? `<span class="bookmark-desc">${e(meta.description)}</span>`
      : "") +
    `<span class="bookmark-meta">${e(metaLine)}</span>` +
    `</span>` +
    (meta.image
      ? `<img class="bookmark-thumb" src="${e(meta.image)}" alt="" loading="lazy">`
      : "") +
    `</a>`
  );
}
