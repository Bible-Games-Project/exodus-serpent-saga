// Records the Test Map in headless Chromium with a virtual clock, so the
// frames are exactly 30 fps however slow the machine renders, and logs every
// sound the game plays (file, time, pitch, volume) to rebuild the audio later.
//
//   node capture.mjs episodes/01-serpent.json [gameUrl]
//
// The game must be running (e.g. `bun run dev -- --port 5180` in the repo root).
import fs from "node:fs";
import { browser, readJson, workDir } from "./lib.mjs";

const [episodeFile, url = "http://127.0.0.1:5180/test-map"] = process.argv.slice(2);
const ep = readJson(episodeFile);
const cap = ep.capture;
const outDir = workDir(ep);
const FPS = 30, FRAMES = Math.round(cap.seconds * FPS);
const framesDir = `${outDir}/frames`;
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const b = await browser();
const pg = await b.newPage();
// "portrait" (default): the game fills the whole 1080x1920 reel. "square": a 1080x1080
// crop of the landscape game, for the layout with bands above and below.
const PORTRAIT = (ep.layout ?? "portrait") === "portrait";
await pg.setViewport(PORTRAIT ? { width: 540, height: 960, deviceScaleFactor: 2 } : { width: 1280, height: 720, deviceScaleFactor: 1.5 });
// The game pauses in portrait (it asks to rotate the phone): report a square window to that check.
if (PORTRAIT) await pg.evaluateOnNewDocument(() => {
  const h = Object.getOwnPropertyDescriptor(window, "innerHeight");
  Object.defineProperty(window, "innerHeight", { configurable: true, get: () => Math.min(h.get.call(window), window.innerWidth) });
});
pg.on("pageerror", (e) => console.log("page error:", e.message));

await pg.evaluateOnNewDocument(() => {
  // Virtual clock: time only moves when the recorder steps it.
  let now = 0, id = 0;
  const cbs = new Map();
  const d0 = Date.now();
  performance.now = () => now;
  Date.now = () => d0 + Math.floor(now);
  window.requestAnimationFrame = (cb) => (cbs.set(++id, cb), id);
  window.cancelAnimationFrame = (i) => cbs.delete(i);
  const step = (ms) => {
    now += ms;
    const l = [...cbs.values()];
    cbs.clear();
    for (const cb of l) { try { cb(now); } catch (e) { console.error(e); } }
  };
  const auto = setInterval(() => step(16), 16); // while loading: run roughly in real time
  window.__vt = { step, manual() { clearInterval(auto); }, get now() { return now; }, t0: 0 };
  Object.defineProperty(BaseAudioContext.prototype, "currentTime", { get() { return now / 1000; } });

  // Sound log: remember which URL each decoded buffer came from.
  const urlOf = new WeakMap();
  const rf = window.fetch;
  window.fetch = async (...a) => {
    const r = await rf(...a);
    const u = typeof a[0] === "string" ? a[0] : a[0].url;
    const ab = r.arrayBuffer.bind(r);
    r.arrayBuffer = async () => { const x = await ab(); urlOf.set(x, u); return x; };
    return r;
  };
  const dec = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (ab, ...rest) {
    const u = urlOf.get(ab);
    return dec.call(this, ab, ...rest).then((buf) => { if (u) urlOf.set(buf, u); return buf; });
  };
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (this instanceof AudioBufferSourceNode && dest instanceof GainNode) this.__g = dest;
    return conn.call(this, dest, ...rest);
  };
  window.__sounds = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
    const u = this.buffer && urlOf.get(this.buffer);
    if (u) window.__sounds.push({ url: u, t: Math.max(now / 1000, when) - window.__vt.t0, offset, rate: this.playbackRate.value, gain: this.__g ? this.__g.gain.value : 1 });
    return duration === undefined ? start.call(this, when, offset) : start.call(this, when, offset, duration);
  };
});

await pg.goto(url, { waitUntil: "networkidle0", timeout: 180000 });
const click = (text) => pg.evaluate((t) => {
  const el = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t) ?? [...document.querySelectorAll("button")].find((x) => x.textContent.includes(t));
  if (!el) throw new Error(`No button "${t}"`);
  el.click();
}, text);
for (const t of cap.clicks ?? []) await click(t);
// Level-up cards pause the game: pick one at once (preferring cap.pick, e.g. "Staff") so the
// menu never shows in the video. Returns true when a card was clicked.
const pickCard = async () => {
  const hit = await pg.evaluate((want) => {
    const cards = [...document.querySelectorAll('button[data-sfx-hover="ui.card"]')];
    if (!cards.length) return false;
    (cards.find((c) => want.some((w) => c.textContent.includes(w))) ?? cards[0]).click();
    return true;
  }, cap.pick ?? []);
  if (hit) await new Promise((r) => setTimeout(r, 80)); // let React close the menu
  return hit;
};
await click("Start test map");
await new Promise((r) => setTimeout(r, 6000)); // assets and sounds load
await pg.evaluate(() => window.__vt.manual());
for (let i = 0; i < Math.round((cap.warmup ?? 2) * FPS); i++) {
  await pg.evaluate(() => window.__vt.step(1000 / 30));
  if (i % 5 === 0) await pickCard();
}
await pg.evaluate(() => { window.__vt.t0 = window.__vt.now / 1000; window.__sounds.length = 0; });

const held = new Set();
const t0 = Date.now();
for (let f = 0; f < FRAMES; f++) {
  const t = f / FPS;
  const want = new Set((cap.moves ?? []).filter(([a, z]) => t >= a && t < z).flatMap(([, , k]) => k.split("")));
  for (const k of held) if (!want.has(k)) { await pg.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await pg.keyboard.down(k); held.add(k); }
  await pg.evaluate((ms) => window.__vt.step(ms), 1000 / FPS);
  await pickCard();
  // Square layout: central square of the 1920x1080 view (Moses stays in the middle).
  // captureBeyondViewport must be off or Chromium resizes the page and the canvas is blank.
  await pg.screenshot({ path: `${framesDir}/f${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 92, captureBeyondViewport: false, ...(PORTRAIT ? {} : { clip: { x: 280, y: 0, width: 720, height: 720 } }) });
  if (f % 60 === 0) console.log(`frame ${f}/${FRAMES} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
fs.writeFileSync(`${outDir}/sounds.json`, JSON.stringify(await pg.evaluate(() => window.__sounds)));
await b.close();
console.log("capture done");
