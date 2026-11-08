// status-api.xtermium.com: the status page's GitHub reads, cached at Cloudflare, so visitors never
// spend GitHub's 60-calls-an-hour-per-IP allowance. .upptimerc.yml points `apiBaseUrl` and
// `userContentBaseUrl` here. Only the reads the page makes pass; anything else is a 404, so this
// is no open proxy for our token.
//
// Upptime commits new results every 5 minutes (Actions cron */5, the run takes about a minute), so a
// cached answer lives until shortly after the next run should have landed, then is fetched fresh.

const REPO = "xtermium/upptime";
const PAGE = "https://status.xtermium.com";
const API = [
  new RegExp(`^/repos/${REPO}/issues$`),
  new RegExp(`^/repos/${REPO}/issues/\\d+$`),
  new RegExp(`^/repos/${REPO}/issues/\\d+/comments$`),
  new RegExp(`^/repos/${REPO}/commits$`),
];
const RAW = new RegExp(`^/${REPO}/master/(history|graphs)/[\\w./-]+$`); // the page asks for master/ only
const FONT = new RegExp(`^/${REPO}/master/fonts/[\\w-]+\\.woff2$`); // the page's own fonts (.upptimerc.yml css)

/** Seconds until 90 s after the next 5-minute boundary: when the next check's commit is in. */
export function ttl(nowMs) {
  const s = Math.floor(nowMs / 1000);
  return 300 - (s % 300) + 90;
}

/** Where a path goes upstream, or null when the page never asks for it. */
export function upstream(path, search) {
  if (API.some((r) => r.test(path))) return `https://api.github.com${path}${search}`;
  if ((RAW.test(path) || FONT.test(path)) && !path.includes("..")) return `https://raw.githubusercontent.com${path}`;
  return null;
}

const cors = { "access-control-allow-origin": PAGE, "access-control-allow-headers": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-max-age": "86400", vary: "origin" };

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors });
    const url = new URL(req.url);
    const target = upstream(url.pathname, url.search);
    if (!target) return new Response("Not found", { status: 404, headers: cors });

    const key = new Request(target);
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return hit;

    const headers = { "user-agent": "xtermium-status-proxy", accept: req.headers.get("accept") || "*/*" };
    if (env.GITHUB_TOKEN && target.startsWith("https://api.github.com")) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const up = await fetch(target, { headers });

    const age = ttl(Date.now());
    const res = new Response(up.body, up);
    for (const h of ["set-cookie", "x-github-request-id", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "x-ratelimit-used", "x-ratelimit-resource"]) res.headers.delete(h);
    const link = up.headers.get("link"); // pagination stays on the proxy
    if (link) res.headers.set("link", link.replaceAll("https://api.github.com", url.origin));
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    // The browser may keep it a minute; Cloudflare keeps it until the next check's results are in.
    // Fonts never change with a check: a day everywhere, typed as fonts (raw GitHub serves them as octet-stream).
    const font = FONT.test(url.pathname);
    if (font && up.ok) res.headers.set("content-type", "font/woff2");
    res.headers.set("cache-control", !up.ok ? "no-store" : font ? "public, max-age=86400" : `public, max-age=60, s-maxage=${age}`);
    if (up.ok) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};
