// Assembles the vertical 1080x1920 reel: blurred gameplay as background, the
// gameplay square in the middle, hook + karaoke subtitles, the Steam card at
// the end, and the audio mix (voice on top, music and game sounds ducked under it).
//
//   bun compose.ts episodes/01-serpent.json [out.mp4]
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { FFMPEG, REPO, readJson, workDir } from "./lib.mjs";

const ep = readJson(process.argv[2]);
const dir = workDir(ep);
const out = process.argv[3] ?? `${REPO}/public/reels/${ep.id}.mp4`;
const { timeline, fades, TEMPO, VO0, ctaVo, end: END } = readJson(`${dir}/timeline.json`);
// The karaoke subtitles become one stream (concat list of PNGs with durations, blank in the
// gaps): one looped input per PNG would need more memory than the build server has.
const blank = `${dir}/ov/_blank.png`;
spawnSync(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "color=black@0.0:s=1080x1920,format=rgba", "-frames:v", "1", blank]);
const subs = timeline.filter((x: any) => x.png.startsWith("sub-")).sort((x: any, y: any) => x.a - y.a);
const list: string[] = [];
let at = 0;
const seg = (file: string, d: number) => { if (d > 0.001) list.push(`file '${file}'`, `duration ${d.toFixed(3)}`); };
for (const x of subs) {
  seg(blank, x.a - at);
  const a = Math.max(x.a, at);
  seg(`${dir}/ov/${x.png}.png`, x.b - a);
  at = Math.max(at, x.b);
}
seg(blank, END - at);
list.push(`file '${blank}'`);
fs.writeFileSync(`${dir}/subs.txt`, list.join("\n") + "\n");
// Other overlays are read once (a single frame, kept by overlay's eof_action=repeat); the
// fading ones only for the length of their fade. Looping them for the whole reel runs out of memory.
const others = timeline.filter((x: any) => !x.png.startsWith("sub-"));
const args = ["-y", "-v", "error", "-framerate", "30", "-i", `${dir}/frames/f%04d.jpg`, "-f", "concat", "-safe", "0", "-i", `${dir}/subs.txt`];
for (const x of others) args.push("-i", `${dir}/ov/${x.png}.png`);
for (const [p, , d] of fades) args.push("-loop", "1", "-framerate", "30", "-t", String(d + 0.1), "-i", `${dir}/ov/${p}.png`);
const A = 2 + others.length + fades.length;
// `music` in the episode: a track from the repo (looped if shorter than the reel); otherwise music.ts' synth.
const music = ep.music ? `${REPO}/${ep.music}` : `${dir}/music.wav`;
args.push("-i", `${dir}/vo.wav`, "-i", `${dir}/cta.wav`, "-stream_loop", "-1", "-i", music, "-i", `${dir}/sfx.wav`);

let f = `[0:v]tpad=stop_mode=clone:stop_duration=${END},trim=duration=${END},setpts=PTS-STARTPTS,split[g1][g2];`;
if ((ep.layout ?? "portrait") === "portrait") {
  // The game fills the whole frame.
  f += `[g1]scale=1080:1920[v00];[g2]nullsink;`;
} else {
  // Blurred gameplay behind a 1080x1080 gameplay square with brown borders.
  f += `[g1]scale=480:480,crop=270:480,boxblur=6:2,scale=1080:1920,eq=brightness=-0.12:saturation=0.85[bg];`;
  f += `[g2]pad=1080:1092:0:6:color=0x2a1406,pad=1080:1104:0:0:color=0x2a1406[sq];`;
  f += `[bg][sq]overlay=0:408[v00];`;
}
f += `[1:v]fps=30,format=rgba[subs];[v00][subs]overlay=0:0:shortest=0:eof_action=pass[v0];`;
let last = "v0", n = 0;
others.forEach((it: any, i: number) => {
  const nx = `v${++n}`;
  f += `[${last}][${2 + i}:v]overlay=0:0:eof_action=repeat:enable='between(t,${it.a},${it.b})'[${nx}];`;
  last = nx;
});
fades.forEach(([p, st, d]: [string, number, number], i: number) => {
  const nx = `v${++n}`;
  f += `[${2 + others.length + i}:v]format=rgba,fade=in:st=0:d=${d}:alpha=1,setpts=PTS+${st}/TB[${p}f];[${last}][${p}f]overlay=0:0:eof_action=repeat[${nx}];`;
  last = nx;
});
f += `[${last}]format=yuv420p[vout];`;
f += `[${A}:a]aresample=44100,atempo=${TEMPO},adelay=${Math.round(VO0 * 1000)},apad[vo];`;
f += `[${A + 1}:a]aresample=44100,atempo=${TEMPO},adelay=${Math.round(ctaVo * 1000)},apad[cta];`;
// The bundled ffmpeg (2018) has no amix normalize=0, so tracks are summed with amerge + pan (all mono, padded).
const fmt = "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono";
const sum = (a: string, b: string, o: string) =>
  `[${a}]${fmt}[${a}_];[${b}]${fmt}[${b}_];[${a}_][${b}_]amerge=inputs=2,pan=mono|c0=c0+c1[${o}];`;
f += sum("vo", "cta", "vc") + `[vc]aresample=44100,asplit[voice][side];`;
f += `[${A + 2}:a]aresample=44100,volume=0.55,afade=in:d=1,afade=out:st=${END - 1.2}:d=1.2,apad[mus];`;
f += `[${A + 3}:a]aresample=44100,volume=0.5,apad[sfx];`;
f += sum("mus", "sfx", "bed");
f += `[bed][side]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck];`;
f += sum("voice", "duck", "mixed") + `[mixed]atrim=duration=${END},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`;
args.push("-filter_complex", f, "-map", "[vout]", "-map", "[aout]", "-t", String(END),
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-threads", "2", "-x264-params", "rc-lookahead=15", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-movflags", "+faststart", out);
if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(args));
const r = spawnSync(FFMPEG, args, { stdio: "inherit" });
if (r.status !== 0) { console.error("ffmpeg failed:", r.status ?? r.signal); process.exit(1); }
console.log("reel:", out, `(${END} s)`);
