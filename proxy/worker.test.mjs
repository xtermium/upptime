// node proxy/worker.test.mjs
import assert from "node:assert/strict";
import { ttl, upstream } from "./worker.js";

// Cached until 90 s after the next 5-minute boundary.
assert.equal(ttl(Date.UTC(2026, 10, 8, 3, 0, 0)), 390);
assert.equal(ttl(Date.UTC(2026, 10, 8, 3, 4, 59)), 91);
assert.equal(ttl(Date.UTC(2026, 10, 8, 3, 2, 30)), 240);

// Only the page's own reads pass.
assert.equal(upstream("/repos/xtermium/upptime/issues", "?state=open&labels=status"), "https://api.github.com/repos/xtermium/upptime/issues?state=open&labels=status");
assert.equal(upstream("/repos/xtermium/upptime/issues/3/comments", ""), "https://api.github.com/repos/xtermium/upptime/issues/3/comments");
assert.equal(upstream("/repos/xtermium/upptime/commits", "?path=history%2Fsync-server.yml"), "https://api.github.com/repos/xtermium/upptime/commits?path=history%2Fsync-server.yml");
assert.equal(upstream("/xtermium/upptime/master/history/summary.json", ""), "https://raw.githubusercontent.com/xtermium/upptime/master/history/summary.json");
assert.equal(upstream("/xtermium/upptime/master/graphs/sync-server/response-time-week.png", ""), "https://raw.githubusercontent.com/xtermium/upptime/master/graphs/sync-server/response-time-week.png");
assert.equal(upstream("/xtermium/upptime/master/fonts/jetbrains-mono-latin.woff2", ""), "https://raw.githubusercontent.com/xtermium/upptime/master/fonts/jetbrains-mono-latin.woff2");
for (const p of ["/xtermium/upptime/master/fonts/x.ttf", "/xtermium/upptime/master/fonts/a/b.woff2", "/user", "/repos/xtermium/xtermium-api/issues", "/repos/xtermium/upptime/contents/x", "/xtermium/upptime/master/.upptimerc.yml", "/xtermium/upptime/master/history/../../x", "/xtermium/xtermium-api/main/history/a.yml", "/xtermium/upptime/main/history/summary.json", "/xtermium/upptime/master/api/sync-server/uptime.json"])
  assert.equal(upstream(p, ""), null, p);
console.log("ok");
