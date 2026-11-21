// Schedule a finished reel on upload-post.com (YouTube Shorts, TikTok, Instagram
// Reels, Facebook Reels, Pinterest) with texts built from the episode's `post` block.
//
//   bun publish.ts episodes/07-bronze-serpent.json 2026-11-21T17:00:00Z [--dry]
//
// Needs UPLOAD_POST_BGP_API_KEY in the environment (never in a file). The target
// brand, Facebook page and Pinterest board are in schedule.json, and every scheduled
// post is recorded there (date, episode, job id). Always ask the owner before
// publishing anything.
import fs from "node:fs";

const [epPath, date, flag] = process.argv.slice(2);
if (!epPath || !date) throw new Error("usage: bun publish.ts <episode.json> <ISO date, UTC> [--dry]");
const ep = JSON.parse(fs.readFileSync(epPath, "utf8"));
const SCHED = `${import.meta.dir}/schedule.json`;
const sched = JSON.parse(fs.readFileSync(SCHED, "utf8"));
const { profile, facebookPageId, pinterestBoardId, steam, platforms } = sched.target;
const p = ep.post;
const video = `${import.meta.dir}/../../public/reels/${ep.id}.mp4`;
if (!fs.existsSync(video)) throw new Error(`No video ${video}: run compose.ts first`);

const tags = p.hashtags.join(" ");
const promo = `🎮 Exodus Survivors is a pixel-art game about Moses and the Exodus. Wishlist it on Steam: ${steam}`;
// YouTube and Facebook: links in the description are clickable.
const long = `${p.hook}\n\n${p.summary}\n\n${promo}\n\n📖 ${p.source}\n\n${tags}`;
// TikTok and Instagram never make caption links clickable: also point to the bio.
const social = `${p.hook}\n\n${p.summary}\n\n${promo} (link in bio)\n\n📖 ${p.source}\n\n${tags}`;
const pin = `${p.hook} ${p.summary} 📖 ${p.source}. Wishlist Exodus Survivors on Steam.`.slice(0, 480);

const f = new FormData();
f.append("user", profile);
for (const pl of platforms) f.append("platform[]", pl);
f.append("video", new Blob([fs.readFileSync(video)], { type: "video/mp4" }), `${ep.id}.mp4`);
f.append("title", p.title);
f.append("description", long);
f.append("youtube_title", p.title);
f.append("youtube_description", long);
for (const t of p.tags ?? []) f.append("tags[]", t);
f.append("privacyStatus", "public");
f.append("categoryId", "20");
f.append("selfDeclaredMadeForKids", "false");
f.append("containsSyntheticMedia", "false");
f.append("tiktok_title", social);
f.append("privacy_level", "PUBLIC_TO_EVERYONE");
f.append("is_aigc", "true");
f.append("instagram_title", social);
f.append("media_type", "REELS");
f.append("share_to_feed", "true");
f.append("facebook_title", p.title.replace(/\s*#shorts/i, ""));
f.append("facebook_description", long);
f.append("facebook_page_id", facebookPageId);
f.append("facebook_media_type", "REELS");
f.append("pinterest_title", p.pinTitle ?? p.title.replace(/\s*#shorts/i, ""));
f.append("pinterest_description", pin);
f.append("pinterest_board_id", pinterestBoardId);
f.append("pinterest_link", steam);
f.append("external_id", ep.id);
f.append("scheduled_date", date);

if (flag === "--dry") {
  for (const [k, v] of f.entries()) console.log(k, "=", typeof v === "string" ? v.replace(/\n/g, " ⏎ ").slice(0, 160) : "(file)");
  process.exit(0);
}
const key = process.env.UPLOAD_POST_BGP_API_KEY;
if (!key) throw new Error("UPLOAD_POST_BGP_API_KEY is not set");
const r = await fetch("https://api.upload-post.com/api/upload", { method: "POST", headers: { Authorization: `Apikey ${key}` }, body: f });
const out = await r.json().catch(() => ({}));
if (!r.ok || out.success === false) throw new Error(`upload-post ${r.status}: ${JSON.stringify(out).slice(0, 500)}`);
const job = out.job_id ?? out.request_id ?? null;
sched.posts = [...(sched.posts ?? []).filter((x: { id: string }) => x.id !== ep.id), { date, id: ep.id, job }].sort((a, b) => a.date.localeCompare(b.date));
fs.writeFileSync(SCHED, JSON.stringify(sched, null, 1) + "\n");
console.log("scheduled", ep.id, date, job, JSON.stringify(out).slice(0, 300));
