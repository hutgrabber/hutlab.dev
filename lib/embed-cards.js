/* Native platform embed cards. A bare URL pasted in a post resolves at
   build time to a themed card for known platforms (YouTube, X, Bluesky,
   GitHub, Reddit, Threads, Instagram, LinkedIn); everything else falls
   back to the generic rich bookmark card. No third-party embed scripts.
   Zero dependencies; caching shared with bookmark-meta.js. */

import {
  UA,
  decodeEntities,
  escapeHtml as e,
  fetchMeta,
  getCached,
  putCached,
  resolveBookmark,
  renderBookmarkCard,
} from "./bookmark-meta.js";

/* ---------- helpers ---------- */

const truncate = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

const fmtCount = (n) => {
  if (!Number.isFinite(n)) return "";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
};

const fmtDate = (x) => {
  const d = new Date(x);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
};

const stripTags = (s) => String(s || "").replace(/<[^>]*>/g, " ");

async function jfetch(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, ...headers },
    signal: AbortSignal.timeout(6000),
    redirect: "follow",
  });
  if (!res.ok) return null;
  return res.json();
}

async function probeOk(url) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* OpenGraph enrichment for platforms that wall off bots — a login-page
   title means the scrape hit the wall and the data is garbage */
const GARBAGE_TITLE = /^(log ?in|sign ?up|instagram|threads|linkedin)\b|log in or sign up/i;
async function cleanOg(url) {
  try {
    const meta = await fetchMeta(url);
    if (meta && meta.title && !GARBAGE_TITLE.test(meta.title.trim())) {
      return { ogTitle: truncate(meta.title, 120), ogDescription: truncate(meta.description, 200), ogImage: meta.image };
    }
  } catch {
    /* enrichment is best-effort */
  }
  return {};
}

/* ---------- brand glyphs (Simple Icons path data, CC0) ---------- */

const GLYPHS = {
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  bluesky:
    "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z",
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  reddit:
    "M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z",
  threads:
    "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z",
  instagram:
    "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z",
};

const glyph = (name) =>
  `<svg class="embed-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${GLYPHS[name]}"/></svg>`;

/* ---------- shared card fragments ---------- */

const cardOpen = (url, name, extra = "") =>
  `<a class="embed-card embed-card--${name}" href="${e(url)}" target="_blank" rel="noopener"${extra}>`;
const head = (name, label) =>
  `<span class="embed-head">${glyph(name)}<span class="embed-source">${label}</span></span>`;
const foot = (parts, cta) =>
  `<span class="embed-foot">` +
  parts.filter(Boolean).map((p) => `<span class="embed-stat">${p}</span>`).join("") +
  `<span class="embed-cta">${cta} →</span></span>`;

function parseUrl(url) {
  try {
    const u = new URL(url);
    return { u, host: u.hostname.replace(/^www\./, ""), segs: u.pathname.split("/").filter(Boolean) };
  } catch {
    return null;
  }
}

/* ---------- platform registry ---------- */

const YT_ID = /^[\w-]{6,20}$/;
const GH_RESERVED = new Set([
  "orgs", "topics", "about", "features", "search", "settings", "sponsors",
  "marketplace", "explore", "trending", "login", "join", "pricing", "collections",
]);
const LANG_COLORS = {
  javascript: "#f1e05a", typescript: "#3178c6", python: "#3572a5", rust: "#dea584",
  go: "#00add8", c: "#555555", "c++": "#f34b7d", shell: "#89e051", html: "#e34c26", ruby: "#701516",
};

const PLATFORMS = [
  {
    name: "youtube",
    match(url) {
      const p = parseUrl(url);
      if (!p) return null;
      let id = null;
      if (p.host === "youtu.be" && p.segs.length >= 1) id = p.segs[0];
      else if (p.host === "youtube.com" || p.host === "m.youtube.com") {
        if (p.segs[0] === "watch") id = p.u.searchParams.get("v");
        else if (p.segs[0] === "shorts" && p.segs[1]) id = p.segs[1];
      }
      return id && YT_ID.test(id) ? { videoId: id } : null;
    },
    async resolve({ videoId }) {
      const data = await jfetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
      );
      if (!data || !data.title) return null;
      const maxres = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      const thumb = (await probeOk(maxres)) ? maxres : data.thumbnail_url;
      return { videoId, title: truncate(data.title, 160), channel: truncate(data.author_name, 80), thumb };
    },
    render(url, d) {
      return (
        cardOpen(url, "youtube", ` data-video-id="${e(d.videoId)}"`) +
        `<span class="embed-media"><img class="embed-media-img" src="${e(d.thumb)}" alt="" loading="lazy">` +
        `<span class="embed-play" aria-hidden="true">▶</span></span>` +
        head("youtube", `${e(d.channel)} · YouTube`) +
        `<span class="embed-body"><span class="embed-title">${e(d.title)}</span></span>` +
        `</a>`
      );
    },
  },

  {
    name: "twitter",
    match(url) {
      const p = parseUrl(url);
      if (!p || (p.host !== "x.com" && p.host !== "twitter.com")) return null;
      if (p.segs.length >= 3 && p.segs[1] === "status" && /^\d+$/.test(p.segs[2])) {
        return { handle: p.segs[0] };
      }
      return null;
    },
    async resolve({ handle }, url) {
      const data = await jfetch(
        `https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`
      );
      if (!data || !data.html) return null;
      const pm = data.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const text = pm ? truncate(decodeEntities(stripTags(pm[1])), 280) : "";
      const links = [...data.html.matchAll(/<a[^>]*>([^<]*)<\/a>/gi)];
      const last = links.length ? links[links.length - 1][1].trim() : "";
      const date = /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(last) ? last : "";
      return { author: truncate(data.author_name, 80), handle, text, date };
    },
    render(url, d) {
      return (
        cardOpen(url, "x") +
        head("x", `${e(d.author)} · @${e(d.handle)}`) +
        `<span class="embed-body"><span class="embed-text-lg">${e(d.text)}</span></span>` +
        foot([e(d.date)], "view on X") +
        `</a>`
      );
    },
  },

  {
    name: "bluesky",
    match(url) {
      const p = parseUrl(url);
      if (!p || p.host !== "bsky.app") return null;
      if (p.segs[0] === "profile" && p.segs[2] === "post" && p.segs[1] && p.segs[3]) {
        return { actor: p.segs[1], rkey: p.segs[3] };
      }
      return null;
    },
    async resolve({ actor, rkey }) {
      let did = actor;
      if (!did.startsWith("did:")) {
        const r = await jfetch(
          `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(actor)}`
        );
        if (!r || !r.did) return null;
        did = r.did;
      }
      const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
      const r = await jfetch(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`
      );
      const post = r && r.posts && r.posts[0];
      if (!post) return null;
      const images = ((post.embed && post.embed.images) || []).slice(0, 2).map((i) => i.thumb).filter(Boolean);
      return {
        text: truncate(post.record?.text, 300),
        name: truncate(post.author?.displayName || post.author?.handle, 80),
        handle: post.author?.handle || "",
        avatar: post.author?.avatar || null,
        likes: post.likeCount || 0,
        reposts: post.repostCount || 0,
        replies: post.replyCount || 0,
        date: fmtDate(post.record?.createdAt),
        images,
      };
    },
    render(url, d) {
      const avatar = d.avatar
        ? `<img class="embed-avatar" src="${e(d.avatar)}" alt="" loading="lazy">`
        : "";
      const thumbs = d.images && d.images.length
        ? `<span class="embed-thumbs">${d.images.map((i) => `<img src="${e(i)}" alt="" loading="lazy">`).join("")}</span>`
        : "";
      return (
        cardOpen(url, "bluesky") +
        `<span class="embed-head">${glyph("bluesky")}${avatar}<span class="embed-source">${e(d.name)} · @${e(d.handle)}</span></span>` +
        `<span class="embed-body"><span class="embed-text-lg">${e(d.text)}</span>${thumbs}</span>` +
        foot([`♥ ${fmtCount(d.likes)}`, `↻ ${fmtCount(d.reposts)}`, `${fmtCount(d.replies)} replies`, e(d.date)], "view on Bluesky") +
        `</a>`
      );
    },
  },

  {
    name: "github",
    match(url) {
      const p = parseUrl(url);
      if (!p || p.host !== "github.com") return null;
      if (!p.segs.length || GH_RESERVED.has(p.segs[0].toLowerCase())) return null;
      if (p.segs.length === 1) return { type: "user", owner: p.segs[0] };
      return { type: "repo", owner: p.segs[0], repo: p.segs[1].replace(/\.git$/, "") };
    },
    async resolve(parsed) {
      // a token avoids the 60 req/h unauthenticated limit; GitHub Actions
      // provides GITHUB_TOKEN automatically, local builds work without one.
      // If the ambient token is rejected (401), retry unauthenticated.
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      const base = { accept: "application/vnd.github+json" };
      const jfetchGh = async (u) => {
        if (token) {
          const r = await jfetch(u, { ...base, authorization: `Bearer ${token}` });
          if (r) return r;
        }
        return jfetch(u, base);
      };
      if (parsed.type === "repo") {
        const r = await jfetchGh(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
        if (!r || !r.full_name) return null;
        return {
          type: "repo",
          fullName: r.full_name,
          description: truncate(r.description, 200),
          stars: r.stargazers_count || 0,
          forks: r.forks_count || 0,
          language: r.language || "",
        };
      }
      const r = await jfetchGh(`https://api.github.com/users/${parsed.owner}`);
      if (!r || !r.login) return null;
      return {
        type: "user",
        login: r.login,
        name: truncate(r.name || r.login, 80),
        bio: truncate(r.bio, 160),
        followers: r.followers || 0,
        avatar: r.avatar_url || null,
      };
    },
    render(url, d) {
      if (d.type === "repo") {
        const langColor = LANG_COLORS[(d.language || "").toLowerCase()] || "var(--accent)";
        const lang = d.language
          ? `<span class="embed-lang-dot" style="background:${langColor}"></span> ${e(d.language)}`
          : "";
        return (
          cardOpen(url, "github") +
          head("github", "github.com") +
          `<span class="embed-body"><span class="embed-title">${e(d.fullName)}</span>` +
          (d.description ? `<span class="embed-text">${e(d.description)}</span>` : "") +
          `</span>` +
          foot([lang, `★ ${fmtCount(d.stars)}`, `⑂ ${fmtCount(d.forks)}`], "view on GitHub") +
          `</a>`
        );
      }
      const avatar = d.avatar
        ? `<img class="embed-avatar" src="${e(d.avatar)}" alt="" loading="lazy">`
        : "";
      return (
        cardOpen(url, "github") +
        `<span class="embed-head">${glyph("github")}${avatar}<span class="embed-source">github.com</span></span>` +
        `<span class="embed-body"><span class="embed-title">${e(d.name)}</span>` +
        `<span class="embed-text">@${e(d.login)}${d.bio ? ` — ${e(d.bio)}` : ""}</span></span>` +
        foot([`${fmtCount(d.followers)} followers`], "view on GitHub") +
        `</a>`
      );
    },
  },

  {
    name: "reddit",
    match(url) {
      const p = parseUrl(url);
      if (!p || !/(^|\.)reddit\.com$/.test(p.host)) return null;
      if (p.segs[0] === "r" && p.segs[1] && (p.segs[2] === "comments" || p.segs[2] === "s")) {
        return { share: p.segs[2] === "s" };
      }
      return null;
    },
    async resolve({ share }, url) {
      let canonical = url;
      if (share) {
        const res = await fetch(url, {
          headers: { "user-agent": UA },
          signal: AbortSignal.timeout(6000),
          redirect: "follow",
        });
        if (!res.ok || !/\/comments\//.test(res.url)) return null;
        canonical = res.url;
      }
      const jsonUrl = canonical.replace(/\/?(\?.*)?$/, "") + ".json?raw_json=1";
      let data = await jfetch(jsonUrl);
      if (!data) data = await jfetch(jsonUrl.replace(/(www\.)?reddit\.com/, "old.reddit.com"));
      const post = data && data[0]?.data?.children?.[0]?.data;
      if (!post || !post.title) return null;
      let thumb = post.preview?.images?.[0]?.source?.url || null;
      if (!thumb && /^https?:/.test(post.thumbnail || "")) thumb = post.thumbnail;
      return {
        title: truncate(post.title, 200),
        sub: post.subreddit_name_prefixed || `r/${post.subreddit}`,
        score: post.score || 0,
        comments: post.num_comments || 0,
        text: truncate(post.selftext, 200),
        date: fmtDate((post.created_utc || 0) * 1000),
        thumb,
      };
    },
    render(url, d) {
      return (
        cardOpen(url, "reddit") +
        head("reddit", `${e(d.sub)} · Reddit`) +
        `<span class="embed-body"><span class="embed-title">${e(d.title)}</span>` +
        (d.text ? `<span class="embed-text">${e(d.text)}</span>` : "") +
        (d.thumb ? `<span class="embed-thumbs"><img src="${e(d.thumb)}" alt="" loading="lazy"></span>` : "") +
        `</span>` +
        foot([`▲ ${fmtCount(d.score)}`, `${fmtCount(d.comments)} comments`, e(d.date)], "view on Reddit") +
        `</a>`
      );
    },
  },

  /* The no-anonymous-API trio: branded cards from the URL itself, plus
     OpenGraph enrichment when it isn't a login wall. Never fails. */
  {
    name: "threads",
    match(url) {
      const p = parseUrl(url);
      if (!p || (p.host !== "threads.net" && p.host !== "threads.com")) return null;
      if (p.segs[0]?.startsWith("@")) {
        const handle = p.segs[0].slice(1);
        return { handle, type: p.segs[1] === "post" && p.segs[2] ? "post" : "profile" };
      }
      return null;
    },
    async resolve(parsed, url) {
      return { ...parsed, ...(await cleanOg(url)) };
    },
    render(url, d) {
      const title = d.ogTitle || `@${d.handle}`;
      const label = d.ogDescription || (d.type === "post" ? `Post by @${d.handle} on Threads` : `@${d.handle} on Threads`);
      return (
        cardOpen(url, "threads") +
        head("threads", "Threads") +
        `<span class="embed-body"><span class="embed-title">${e(title)}</span>` +
        `<span class="embed-text">${e(label)}</span></span>` +
        foot([], d.type === "post" ? "view post on Threads" : "view profile on Threads") +
        `</a>`
      );
    },
  },

  {
    name: "instagram",
    match(url) {
      const p = parseUrl(url);
      if (!p || p.host !== "instagram.com") return null;
      const reserved = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "direct"]);
      if ((p.segs[0] === "p" || p.segs[0] === "reel") && p.segs[1]) {
        return { id: p.segs[1], type: p.segs[0] === "reel" ? "reel" : "post" };
      }
      if (p.segs.length === 1 && !reserved.has(p.segs[0])) {
        return { handle: p.segs[0], type: "profile" };
      }
      return null;
    },
    async resolve(parsed, url) {
      return { ...parsed, ...(await cleanOg(url)) };
    },
    render(url, d) {
      const title = d.ogTitle || (d.type === "profile" ? `@${d.handle}` : `instagram.com/${d.type === "reel" ? "reel" : "p"}/${d.id}`);
      const label =
        d.ogDescription ||
        (d.type === "profile" ? `@${d.handle} on Instagram` : d.type === "reel" ? "Instagram reel" : "Instagram post");
      return (
        cardOpen(url, "instagram") +
        head("instagram", "Instagram") +
        `<span class="embed-body"><span class="embed-title">${e(title)}</span>` +
        `<span class="embed-text">${e(label)}</span></span>` +
        foot([], `view on Instagram`) +
        `</a>`
      );
    },
  },

  {
    name: "linkedin",
    match(url) {
      const p = parseUrl(url);
      if (!p || !/(^|\.)linkedin\.com$/.test(p.host)) return null;
      if (p.segs[0] === "posts" && p.segs[1]) {
        const author = p.segs[1].split("_")[0]; // slug is author-name_title…-activity-ID
        return { type: "post", slug: p.segs[1], author };
      }
      if (p.segs[0] === "in" && p.segs[1]) return { type: "profile", handle: p.segs[1] };
      if (p.segs[0] === "company" && p.segs[1]) return { type: "company", handle: p.segs[1] };
      return null;
    },
    async resolve(parsed, url) {
      return { ...parsed, ...(await cleanOg(url)) };
    },
    render(url, d) {
      const pretty = (s) =>
        String(s || "").split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      let title, label, cta;
      if (d.type === "post") {
        title = d.ogTitle || pretty(d.author);
        label = d.ogDescription || `LinkedIn post by ${pretty(d.author)}`;
        cta = "view post on LinkedIn";
      } else if (d.type === "company") {
        title = d.ogTitle || pretty(d.handle);
        label = d.ogDescription || `${pretty(d.handle)} · Company · LinkedIn`;
        cta = "view company on LinkedIn";
      } else {
        title = d.ogTitle || pretty(d.handle);
        label = d.ogDescription || `Profile · LinkedIn`;
        cta = "view profile on LinkedIn";
      }
      return (
        cardOpen(url, "linkedin") +
        head("linkedin", "LinkedIn") +
        `<span class="embed-body"><span class="embed-title">${e(title)}</span>` +
        `<span class="embed-text">${e(label)}</span></span>` +
        foot([], cta) +
        `</a>`
      );
    },
  },
];

/* ---------- resolution chain ---------- */

const inFlight = new Map(); // url -> Promise<html> (per build)

export function resolveEmbedCard(url) {
  if (inFlight.has(url)) return inFlight.get(url);
  const p = resolveOnce(url);
  inFlight.set(url, p);
  return p;
}

async function resolveOnce(url) {
  let platform = null;
  let parsed = null;
  for (const pf of PLATFORMS) {
    try {
      parsed = pf.match(url);
    } catch {
      parsed = null;
    }
    if (parsed) {
      platform = pf;
      break;
    }
  }

  // unmatched → the plain bookmark pipeline, unchanged
  if (!platform) {
    const meta = await resolveBookmark(url);
    return renderBookmarkCard(url, meta);
  }

  const cached = getCached(url);
  if (cached) {
    if (cached.kind === platform.name) return platform.render(url, cached);
    return renderBookmarkCard(url, cached); // legacy bookmark-kind entry
  }

  try {
    const data = await platform.resolve(parsed, url);
    if (data) {
      const entry = { kind: platform.name, fetchedAt: new Date().toISOString().slice(0, 10), ...data };
      putCached(url, entry);
      return platform.render(url, entry);
    }
  } catch {
    /* fall through to default-card fallback */
  }

  // platform failed: render a default card for THIS build only (never
  // persisted, so the platform card self-heals on a later build)
  let meta = null;
  try {
    meta = await fetchMeta(url);
  } catch {
    /* offline / blocked */
  }
  return renderBookmarkCard(url, meta && meta.title ? meta : null);
}
