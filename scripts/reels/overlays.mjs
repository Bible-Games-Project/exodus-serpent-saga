// Renders the reel's text overlays (hook, karaoke subtitles, Steam card) as
// transparent 1080x1920 PNGs with headless Chromium.
//
//   node overlays.mjs episodes/01-serpent.json
import fs from "node:fs";
import path from "node:path";
import { HERE, browser, readJson, workDir } from "./lib.mjs";

const dir = workDir(readJson(process.argv[2]));
const spec = readJson(`${dir}/overlays.json`);
const OUT = `${dir}/ov`;
fs.mkdirSync(OUT, { recursive: true });
// Fonts as data URLs: Chromium refuses web fonts from file:// URLs.
const F = (p) => "data:font/woff2;base64," + fs.readFileSync(path.join(HERE, "node_modules/@fontsource", p)).toString("base64");
const css = `
@font-face{font-family:Silk;font-weight:700;src:url(${F("silkscreen/files/silkscreen-latin-700-normal.woff2")})}
@font-face{font-family:Silk;font-weight:700;src:url(${F("silkscreen/files/silkscreen-latin-ext-700-normal.woff2")});unicode-range:U+0100-024F}
@font-face{font-family:Rub;font-weight:900;src:url(${F("rubik/files/rubik-latin-900-normal.woff2")})}
@font-face{font-family:Rub;font-weight:700;src:url(${F("rubik/files/rubik-latin-700-normal.woff2")})}
html,body{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden}
.ov{position:absolute;inset:0;display:none}
.hook{position:absolute;top:150px;left:40px;right:40px;line-height:1.3;text-align:center;font:700 84px Silk;color:#ffd75e;letter-spacing:2px;
  text-shadow:0 6px 0 #5a2a0c,4px 0 0 #3a1a08,-4px 0 0 #3a1a08,0 -4px 0 #3a1a08,0 4px 0 #3a1a08,0 10px 24px rgba(0,0,0,.6)}
.ref{margin-top:22px;text-align:center;font:700 38px Rub;color:#fff4d6;letter-spacing:3px;text-transform:uppercase;-webkit-text-stroke:8px #2a1406;paint-order:stroke fill;text-shadow:0 4px 10px rgba(0,0,0,.5)}
.sub{position:absolute;top:1235px;left:80px;right:80px;text-align:center;font:900 70px/1.12 Rub;color:#fff;
  -webkit-text-stroke:12px #2a1406;paint-order:stroke fill;text-shadow:0 8px 18px rgba(0,0,0,.55)}
.sub b{color:#ffd75e;font-weight:900}
.sub.high{top:985px}
.poster{position:absolute;inset:0;background:#000}
.poster img{width:1080px;height:1920px;object-fit:cover}
.steam{position:absolute;left:170px;right:170px;top:1585px;padding:22px 30px 28px;border-radius:22px;text-align:center;
  background:linear-gradient(#1b2838ee,#171a21f2);border:3px solid #66c0f4;box-shadow:0 0 30px rgba(102,192,244,.45),0 14px 30px rgba(0,0,0,.6)}
.steamtop{display:flex;align-items:center;justify-content:center;gap:18px;font:900 54px Rub;color:#fff;letter-spacing:6px}
.steambtn{margin-top:16px;padding:20px 10px;border-radius:12px;font:900 46px/1 Rub;color:#fff;letter-spacing:1px;
  background:linear-gradient(#79b42b,#4c7d16);box-shadow:inset 0 2px 0 rgba(255,255,255,.35),0 6px 0 #2d4a0c;text-shadow:0 2px 0 #2d4a0c}
.steam small{display:block;margin-top:14px;font:700 30px Rub;color:#c7d5e0;letter-spacing:2px}
.card{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 35%,#4a2410 0%,#1d0f07 55%,#0e0703 100%)}
.card img{position:absolute;left:190px;top:120px;width:700px;-webkit-mask-image:radial-gradient(ellipse 60% 62% at 50% 50%,#000 60%,transparent 100%)}
.title{position:absolute;top:1170px;left:0;right:0;text-align:center;font:700 104px/1 Silk;color:#ffd75e;
  text-shadow:0 8px 0 #7a3a10,5px 0 0 #2a1406,-5px 0 0 #2a1406,0 -5px 0 #2a1406,0 5px 0 #2a1406,0 0 40px rgba(255,190,80,.35)}
.tag{position:absolute;top:1395px;left:0;right:0;text-align:center;font:700 40px Rub;color:#f6e2ad;letter-spacing:1px}
.btn{position:absolute;top:1490px;left:120px;right:120px;padding:30px 20px;text-align:center;font:900 46px/1.15 Rub;color:#fff;
  background:linear-gradient(#5fae3a,#3c7f22);border:6px solid #1f3d10;border-radius:18px;box-shadow:0 10px 0 #1f3d10,0 18px 30px rgba(0,0,0,.5);text-shadow:0 3px 0 #1f3d10}
.btn small{display:block;font:700 34px Rub;color:#e8ffd8;margin-top:6px;letter-spacing:4px}
`;
const names = Object.keys(spec);
const page = `${OUT}/_page.html`;
fs.writeFileSync(page, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${names.map((n, i) => `<div class="ov" id="o${i}">${spec[n]}</div>`).join("")}</body></html>`);
const b = await browser();
const pg = await b.newPage();
await pg.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await pg.goto("file://" + page, { waitUntil: "load" });
// Load the fonts first (retrying: Chromium sometimes reports a spurious network error for
// data-URL fonts), then show everything once so the images decode, then one overlay at a time.
await pg.evaluate(async () => {
  for (const f of ["700 40px Silk", "900 40px Rub", "700 40px Rub"])
    for (let i = 0; ; i++) {
      try { await document.fonts.load(f, "¿SABÍAS Añádelo"); break; }
      catch (e) { if (i === 4) throw new Error(f + ": " + e.message); await new Promise((r) => setTimeout(r, 300)); }
    }
  document.querySelectorAll(".ov").forEach((e) => (e.style.display = "block"));
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
});
await new Promise((r) => setTimeout(r, 500));
for (let i = 0; i < names.length; i++) {
  await pg.evaluate((i) => document.querySelectorAll(".ov").forEach((e, j) => (e.style.display = j === i ? "block" : "none")), i);
  await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await pg.screenshot({ path: `${OUT}/${names[i]}.png`, omitBackground: true, captureBeyondViewport: false });
}
fs.rmSync(page);
await b.close();
console.log(names.length, "overlays");
