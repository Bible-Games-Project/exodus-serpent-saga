// Schedule a finished reel on upload-post.com (YouTube Shorts, TikTok, Instagram
// Reels, Facebook Reels, Pinterest) with texts built from the episode's `post` block.
//
//   bun publish.ts episodes/07-bronze-serpent.json 2026-11-21T17:00:00Z [--dry] [--replace]
//
// When public/reels/covers/<id>.jpg exists (cover.ts) it is sent as the
// YouTube and Facebook thumbnail, and the video gets the cover as its first two
// frames, which Instagram, TikTok and Pinterest use as cover. --replace
// re-schedules an episode that is already in schedule.json: the old job is
// cancelled only after the new one is confirmed.
//
// Needs UPLOAD_POST_BGP_API_KEY in the environment (never in a file). The target
// brand, Facebook page and Pinterest board are in schedule.json, and every scheduled
// post is recorded there (date, episode, job id). Always ask the owner before
// publishing anything.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { FFMPEG } from "./lib.mjs";

const [epPath, date, ...flags] = process.argv.slice(2);
const flag = flags.includes("--dry") ? "--dry" : undefined;
const replace = flags.includes("--replace");
if (!epPath || !date) throw new Error("usage: bun publish.ts <episode.json> <ISO date, UTC> [--dry]");
const ep = JSON.parse(fs.readFileSync(epPath, "utf8"));
const SCHED = `${import.meta.dir}/schedule.json`;
const sched = JSON.parse(fs.readFileSync(SCHED, "utf8"));
const { profile, facebookPageId, pinterestBoardId, steam, platforms } = sched.target;
const p = ep.post;
const video = `${import.meta.dir}/../../public/reels/${ep.id}.mp4`;
if (!fs.existsSync(video)) throw new Error(`No video ${video}: run compose.ts first`);
const cover = `${import.meta.dir}/../../public/reels/covers/${ep.id}.jpg`;
const hasCover = fs.existsSync(cover);
const old = (sched.posts ?? []).find((x: { id: string }) => x.id === ep.id);
if (old && !replace && flag !== "--dry") throw new Error(`${ep.id} is already scheduled (job ${old.job}): add --replace`);

/** The reel with the cover as its first two frames (in the git-ignored work/<id>/). */
function withCover(): string {
  const dir = path.join(import.meta.dir, "work", ep.id);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, "with-cover.mp4");
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > Math.max(fs.statSync(video).mtimeMs, fs.statSync(cover).mtimeMs)) return out;
  const r = spawnSync(FFMPEG, ["-nostdin", "-y", "-v", "error", "-loop", "1", "-framerate", "30", "-t", "0.0667", "-i", cover, "-i", video,
    "-filter_complex", "[0:v]scale=1080:1920,setsar=1,format=yuv420p,fps=30[c];[1:v]fps=30,format=yuv420p[v];[c][v]concat=n=2:v=1:a=0[vo];[1:a]adelay=67|67[ao]",
    "-map", "[vo]", "-map", "[ao]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error("ffmpeg could not put the cover in front of the video");
  return out;
}

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
const upload = hasCover && flag !== "--dry" ? withCover() : video;
f.append("video", new Blob([fs.readFileSync(upload)], { type: "video/mp4" }), `${ep.id}.mp4`);
if (hasCover) {
  const img = () => new Blob([fs.readFileSync(cover)], { type: "image/jpeg" });
  f.append("thumbnail", img(), `${ep.id}.jpg`); // YouTube
  f.append("facebook_thumbnail", img(), `${ep.id}.jpg`);
  // Instagram, TikTok and Pinterest only take a frame of the video: the first one, the cover.
  f.append("thumb_offset", "0");
  f.append("pinterest_cover_image_key_frame_time", "0");
  f.append("cover_timestamp", "0");
}
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
const H = { Authorization: `Apikey ${key}` };
const r = await fetch("https://api.upload-post.com/api/upload", { method: "POST", headers: H, body: f });
const out = await r.json().catch(() => ({}));
if (!r.ok || out.success === false) throw new Error(`upload-post ${r.status}: ${JSON.stringify(out).slice(0, 500)}`);
const job = out.job_id ?? out.request_id ?? null;
if (old?.job && old.job !== job) {
  // Cancel the old post only once the new one is really scheduled (with its cover).
  const check = await fetch(`https://api.upload-post.com/api/uploadposts/schedule/${job}`, { headers: H });
  const info = await check.json().catch(() => ({}));
  const kept = JSON.stringify(info.kept_files ?? info.job?.kept_files ?? {});
  if (!check.ok || (hasCover && !/thumbnail|cover/.test(kept))) throw new Error(`new job ${job} not confirmed (${check.status} ${kept}); old job ${old.job} kept`);
  const d = await fetch(`https://api.upload-post.com/api/uploadposts/schedule/${old.job}`, { method: "DELETE", headers: H });
  console.log("cancelled old job", old.job, d.status);
}
sched.posts = [...(sched.posts ?? []).filter((x: { id: string }) => x.id !== ep.id), { date, id: ep.id, job }].sort((a, b) => a.date.localeCompare(b.date));
fs.writeFileSync(SCHED, JSON.stringify(sched, null, 1) + "\n");
console.log("scheduled", ep.id, date, job, JSON.stringify(out).slice(0, 300));
