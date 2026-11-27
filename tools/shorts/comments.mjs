// Reel comment replies through Upload-Post (key: UPLOAD_POST_BGP_API_KEY, never written anywhere).
//
//   bun tools/shorts/comments.mjs list            → JSON of new comments (last 7 days, not yet handled)
//   bun tools/shorts/comments.mjs reply file.json → posts the replies, records them in comments-state.json
//   bun tools/shorts/comments.mjs skip file.json  → records comments decided not to answer
//
// file.json: [{ "platform", "comment_id", "post_id"?, "message"? }] (max 40 replies per run).
// Replies are written by hand (by the agent), never by an AI service.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = "https://api.upload-post.com/api/uploadposts";
const STATE = join(HERE, "comments-state.json");
const MAX_REPLIES = 40;
const MAX_AGE_DAYS = 7;

const KEY = process.env.UPLOAD_POST_BGP_API_KEY;
if (!KEY) throw new Error("UPLOAD_POST_BGP_API_KEY is not set");
const H = { Authorization: `Apikey ${KEY}` };

function profile() {
  const ch = join(HERE, "channel.json");
  if (existsSync(ch)) { const p = JSON.parse(readFileSync(ch, "utf8")).profile; if (p) return p; }
  const s = JSON.parse(readFileSync(join(HERE, "..", "..", "scripts", "reels", "schedule.json"), "utf8"));
  return s.target?.profile ?? s.profile;
}
const USER = profile();

function loadState() {
  return existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { handled: [] };
}
function saveState(s) { writeFileSync(STATE, JSON.stringify(s, null, 2) + "\n"); }
const keyOf = (platform, id) => `${platform}:${id}`;

// Each network names the fields its own way.
const pick = (o, ...names) => { for (const n of names) if (o?.[n] != null && o[n] !== "") return o[n]; return undefined; };
const idOf = (c) => String(pick(c, "comment_id", "id", "commentId") ?? "");
const textOf = (c) => String(pick(c, "text", "message", "textDisplay", "textOriginal", "content") ?? "").trim();
const authorOf = (c) => {
  const a = pick(c, "author", "from", "user", "username", "authorDisplayName", "author_name");
  return typeof a === "object" && a ? String(pick(a, "username", "name", "display_name", "id") ?? "") : String(a ?? "");
};
const timeOf = (c) => pick(c, "timestamp", "created_time", "created_at", "publishedAt", "create_time", "date");
const repliesOf = (c) => { const r = pick(c, "replies", "children"); return Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : Array.isArray(r?.comments) ? r.comments : []; };
const isOurs = (c) => {
  const a = authorOf(c).toLowerCase();
  return !!pick(c, "is_owner", "from_owner", "is_author", "own") || (a && OUR_NAMES.some((n) => a.includes(n)));
};
const OUR_NAMES = ["biblequiz.truechrist", "biblefun", USER.toLowerCase()];

async function get(path, params) {
  const u = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: H });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function list() {
  const state = loadState();
  const done = new Set(state.handled.map((h) => keyOf(h.platform, h.comment_id)));
  const since = Date.now() - MAX_AGE_DAYS * 86400e3;
  const { body } = await get("history", { profile_username: USER, limit: 50 });
  const posts = (body.history ?? []).filter((p) => p.success && p.platform !== "pinterest" && Date.parse(p.upload_timestamp) > since - 30 * 86400e3);
  const out = [];
  for (const p of posts) {
    // YouTube only finds the video by id; the others by URL.
    const q = p.platform === "youtube" ? { post_id: p.platform_post_id } : { post_url: p.post_url };
    const { status, body: cb } = await get("comments", { platform: p.platform, user: USER, ...q });
    if (status !== 200) { console.error(`${p.platform} ${p.platform_post_id}: HTTP ${status} ${cb.error ?? ""}`); continue; }
    for (const c of cb.comments ?? []) {
      const id = idOf(c), text = textOf(c), t = timeOf(c);
      if (!id || done.has(keyOf(p.platform, id))) continue;
      if (!text || isOurs(c)) continue;
      if (t && Date.parse(typeof t === "number" && t < 1e12 ? t * 1000 : t) < since) continue;
      if (repliesOf(c).some(isOurs)) continue;
      out.push({ platform: p.platform, comment_id: id, post_id: p.platform_post_id, post_title: p.post_title?.split("\n")[0], author: authorOf(c), time: t, text });
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

async function record(file, reply) {
  const items = JSON.parse(readFileSync(file, "utf8"));
  const state = loadState();
  const done = new Set(state.handled.map((h) => keyOf(h.platform, h.comment_id)));
  let sent = 0;
  for (const it of items) {
    if (done.has(keyOf(it.platform, it.comment_id))) { console.log("already handled", it.platform, it.comment_id); continue; }
    if (reply) {
      if (sent >= MAX_REPLIES) { console.log("reply limit reached"); break; }
      const msg = String(it.message ?? "").trim();
      if (!msg || msg.length > 200) { console.log("bad message for", it.comment_id); continue; }
      const payload = { platform: it.platform, user: USER, message: msg, comment_id: it.comment_id };
      if (it.platform === "tiktok") payload.post_id = it.post_id;
      const r = await fetch(`${API}/comments/create`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok || b.success === false) { console.log("failed", it.platform, it.comment_id, r.status, b.error ?? ""); continue; }
      sent++;
    }
    state.handled.push({ platform: it.platform, comment_id: it.comment_id, action: reply ? "replied" : "skipped", at: new Date().toISOString() });
    done.add(keyOf(it.platform, it.comment_id));
    saveState(state);
  }
  console.log(reply ? `replied ${sent}` : `skipped ${items.length}`);
}

const [cmd, file] = process.argv.slice(2);
if (cmd === "list") await list();
else if (cmd === "reply" && file) await record(file, true);
else if (cmd === "skip" && file) await record(file, false);
else console.log("usage: bun tools/shorts/comments.mjs list | reply file.json | skip file.json");
