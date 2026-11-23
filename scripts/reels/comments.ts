// Reads the new comments on the Brand_2_BibleFun reels (YouTube, TikTok, Instagram,
// Facebook; upload-post cannot read Pinterest comments) and answers each one once,
// kindly, with a short reply written by OpenAI. Runs every night from
// .github/workflows/reel-comments.yml; locally:
//
//   bun comments.ts --dry                          # print the replies, post nothing
//   bun comments.ts --dry --profile Brand_1_RPG    # try it on another brand (read only)
//
// Needs UPLOAD_POST_BGP_API_KEY and OPENAI_API_KEY in the environment (never in a file).
// Comments already answered are remembered in comments-state.json (kept between runs
// by the workflow's cache, git-ignored); comments that already have a reply, are ours,
// are empty or are older than MAX_AGE_DAYS are skipped too, so nobody gets two answers.
import fs from "node:fs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const PROFILE = args.includes("--profile") ? args[args.indexOf("--profile") + 1] : "Brand_2_BibleFun";
const MAX_AGE_DAYS = 7;
const MAX_REPLIES = 40;
const MODEL = "gpt-5.4-mini";
const STEAM = "https://store.steampowered.com/app/4102420/Exodus_Survivors/";
const OWN_NAMES = ["biblequiz.truechrist", "Bible Quiz True Christ"];
const FB_PAGE_ID = "1020908321106180";

const API = "https://api.upload-post.com/api/uploadposts";
const upKey = process.env.UPLOAD_POST_BGP_API_KEY;
const aiKey = process.env.OPENAI_API_KEY;
if (!upKey || !aiKey) throw new Error("UPLOAD_POST_BGP_API_KEY and OPENAI_API_KEY must be set");
const UP = { Authorization: `Apikey ${upKey}` };

const STATE = `${import.meta.dir}/comments-state.json`;
const state: { replied: Record<string, string> } = fs.existsSync(STATE)
  ? JSON.parse(fs.readFileSync(STATE, "utf8"))
  : { replied: {} };
const now = Date.now();
const maxAge = MAX_AGE_DAYS * 864e5;
// Forget entries older than a month so the file stays small.
for (const [k, t] of Object.entries(state.replied)) if (now - Date.parse(t) > 30 * 864e5) delete state.replied[k];

type Comment = { platform: string; id: string; text: string; author: string; video: string };

async function up(path: string) {
  const r = await fetch(`${API}${path}`, { headers: UP });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.warn(`upload-post ${r.status} ${path.split("?")[0]}: ${JSON.stringify(j).slice(0, 200)}`);
  return r.ok ? j : null;
}

function time(c: any): number {
  if (c.create_time) return Number(c.create_time) * 1000;
  const t = c.timestamp ?? c.created_time ?? c.created_at ?? c.publishedAt;
  return t ? Date.parse(t) : now;
}

function isOwn(c: any): boolean {
  return c.owner === true || OWN_NAMES.includes(c.username) || OWN_NAMES.includes(c.from?.name) || c.from?.id === FB_PAGE_ID;
}

function answered(c: any): boolean {
  const r = c.replies;
  if (Array.isArray(r)) return r.some(isOwn);
  if (Array.isArray(r?.data)) return r.data.some(isOwn);
  return Number(r ?? c.reply_count ?? c.comment_count ?? 0) > 0;
}

// Posts of this brand on TikTok, Instagram and Facebook from the last MAX_AGE_DAYS + 7 days.
async function recentPosts() {
  const posts = new Map<string, { platform: string; url: string; title: string }>();
  for (let page = 1; page <= 6; page++) {
    const h = await up(`/history?limit=50&page=${page}`);
    const items: any[] = h?.history ?? [];
    for (const x of items) {
      if (x.profile_username !== PROFILE || !x.success || !x.post_url) continue;
      if (!["tiktok", "instagram", "facebook"].includes(x.platform)) continue;
      if (now - Date.parse(x.upload_timestamp) > maxAge + 7 * 864e5) continue;
      posts.set(x.post_url, { platform: x.platform, url: x.post_url, title: x.post_title ?? "" });
    }
    if (items.length < 50) break;
  }
  return [...posts.values()];
}

async function collect(): Promise<Comment[]> {
  const out: Comment[] = [];
  for (const p of await recentPosts()) {
    const j = await up(`/comments?platform=${p.platform}&user=${PROFILE}&post_url=${encodeURIComponent(p.url)}`);
    for (const c of j?.comments ?? []) {
      const id = String(c.comment_id ?? c.id ?? "");
      const text = String(c.text ?? c.message ?? "").trim();
      if (!id || !text || isOwn(c) || answered(c) || now - time(c) > maxAge) continue;
      out.push({ platform: p.platform, id, text, author: c.display_name ?? c.username ?? c.from?.name ?? "", video: p.title });
    }
  }
  let token = "";
  for (let i = 0; i < 3; i++) {
    const j = await up(`/youtube/comments?user=${PROFILE}&scope=channel${token ? `&page_token=${token}` : ""}`);
    for (const t of j?.items ?? []) {
      const s = t.snippet?.topLevelComment?.snippet;
      if (!s) continue;
      const channel = t.snippet.channelId;
      const ours = (x: any) => x?.authorChannelId?.value === channel;
      if (ours(s) || now - Date.parse(s.publishedAt) > maxAge) continue;
      if (t.replies?.comments ? t.replies.comments.some((r: any) => ours(r.snippet)) : t.snippet.totalReplyCount > 0) continue;
      const text = String(s.textOriginal ?? "").trim();
      if (text) out.push({ platform: "youtube", id: t.id, text, author: s.authorDisplayName ?? "", video: s.videoId });
    }
    token = j?.next_page_token;
    if (!token) break;
  }
  return out.filter((c) => !state.replied[`${c.platform}:${c.id}`]);
}

const SYSTEM = `You answer comments for "Bible Quiz True Christ", a Christian channel of short videos that each teach something from the Bible (mostly Exodus, Leviticus, Numbers and Deuteronomy). The videos use gameplay from Exodus Survivors, a pixel-art game about Moses and the Exodus (Steam: ${STEAM}).
Write one warm, kind, humble reply, like a friendly believer who runs the channel.
- Reply in the commenter's language. One or two short sentences, at most 200 characters. At most one emoji.
- Thank them, answer what they ask, or add one small encouraging thought tied to the comment.
- Never argue, preach at, judge or correct people harshly. If they disagree or doubt, answer gently and respectfully.
- Do not invent Bible facts or verse numbers; only cite a verse if you are completely sure.
- Mention the game only if they ask about it (name, where to get it, what it is): say it is Exodus Survivors and that the Steam link is in the description or the bio.
- No links, no hashtags, no questions asking them to follow or like.
- Return SKIP instead of a reply when the comment is spam, a scam, sexual, hateful, an insult or troll, about politics, or anything a careful human moderator would not answer.
Answer with JSON: {"reply": "..."} or {"reply": "SKIP"}.`;

async function write(c: Comment): Promise<string | null> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Platform: ${c.platform}\nVideo: ${c.video}\nCommenter: ${c.author}\nComment: ${c.text}` },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const reply = String(JSON.parse(j.choices[0].message.content).reply ?? "").trim();
  return !reply || reply === "SKIP" ? null : reply.slice(0, 300);
}

async function reply(c: Comment, message: string) {
  const r = await fetch(`${API}/comments/reply`, {
    method: "POST",
    headers: { ...UP, "Content-Type": "application/json" },
    body: JSON.stringify({ platform: c.platform, user: PROFILE, comment_id: c.id, message }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 200)}`);
}

const comments = await collect();
console.log(`${PROFILE}: ${comments.length} new comment(s)${DRY ? " (dry run)" : ""}`);
let sent = 0;
for (const c of comments.slice(0, MAX_REPLIES)) {
  const key = `${c.platform}:${c.id}`;
  try {
    const message = await write(c);
    console.log(`\n[${c.platform}] ${c.author}: ${c.text.slice(0, 200)}\n  -> ${message ?? "(skipped)"}`);
    if (DRY) continue;
    if (message) {
      await reply(c, message);
      sent++;
      await new Promise((r) => setTimeout(r, 2000));
    }
    state.replied[key] = new Date().toISOString();
  } catch (e) {
    console.warn(`  failed: ${(e as Error).message}`);
  }
}
if (!DRY) fs.writeFileSync(STATE, JSON.stringify(state, null, 1) + "\n");
console.log(`\nreplied to ${sent} comment(s)`);
