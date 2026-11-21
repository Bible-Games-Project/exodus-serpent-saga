// Records the Test Map in headless Chromium with a virtual clock, so the
// frames are exactly 30 fps however slow the machine renders, and logs every
// sound the game plays (file, time, pitch, volume) to rebuild the audio later.
//
//   node capture.mjs episodes/03-red-river.json [gameUrl]
//
// The game must be running (e.g. `bun run dev -- --port 5180` in the repo root).
//
// `capture.takes` edits the gameplay like a film: each take is a fresh Test Map
// run (its own `clicks`), cut into `shots`. A shot can first play `skip` seconds
// unseen (a jump in time), then films `len` seconds with its own camera:
// `cam.on` = "moses" | "enemy" (one enemy, followed; `cam.kinds` to choose which)
// | "center", `cam.zoom` = [from, to] (1 = whole screen, 2 = close-up), and
// `slow` (0.5 = half-speed slow motion). The old single `capture` block
// (seconds, clicks, moves) still works: it is one take with one shot.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { FFMPEG, browser, readJson, workDir } from "./lib.mjs";

const [episodeFile, url = "http://127.0.0.1:5180/test-map"] = process.argv.slice(2);
const ep = readJson(episodeFile);
const cap = ep.capture;
const outDir = workDir(ep);
const FPS = 30;
const framesDir = `${outDir}/frames`;
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

// "portrait" (default): the game fills the whole 1080x1920 reel. "square": a 1080x1080
// crop of the landscape game, for the layout with bands above and below.
const PORTRAIT = (ep.layout ?? "portrait") === "portrait";
// Portrait renders at 3x so close-ups (zoom up to 1.5) stay sharp.
const DPR = PORTRAIT ? cap.dpr ?? 3 : 1.5;
const VW = PORTRAIT ? 540 : 1280, VH = PORTRAIT ? 960 : 720;
const takes = cap.takes ?? [{ clicks: cap.clicks, pick: cap.pick, warmup: cap.warmup, shots: [{ len: cap.seconds, moves: cap.moves }] }];

function pageSetup() {
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
  window.__vt = { step, manual() { clearInterval(auto); }, get now() { return now; }, t0: 0, rec: false };
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
    if (u && window.__vt.rec) window.__sounds.push({ url: u, t: Math.max(now / 1000, when) - window.__vt.t0, offset, rate: this.playbackRate.value, gain: this.__g ? this.__g.gain.value : 1 });
    return duration === undefined ? start.call(this, when, offset) : start.call(this, when, offset, duration);
  };

  // Camera helper: where Moses or an enemy is on screen (CSS pixels). The game state
  // is read from the canvas component's React ref (the game itself is not changed).
  let state = null;
  const findState = () => {
    const cnv = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const key = cnv && Object.keys(cnv).find((k) => k.startsWith("__reactFiber$"));
    for (let f = key ? cnv[key] : null; f; f = f.return)
      for (let h = f.memoizedState; h && typeof h === "object" && "next" in h; h = h.next) {
        const v = h.memoizedState;
        if (v && v.current && v.current.camera && v.current.entities) return { s: v.current, cnv };
      }
    return null;
  };
  window.__where = (on, kinds, lockId) => {
    if (!state || !state.cnv.isConnected) state = findState();
    if (!state) return null;
    const { s, cnv } = state;
    const r = cnv.getBoundingClientRect();
    const z = Math.max(0.8, Math.min(1.7, Math.sqrt((r.width * r.height) / (1280 * 720))));
    const wd = (a, b, w) => { const d = a - b; return d - Math.round(d / w) * w; };
    const scr = (e) => ({ x: r.left + r.width / 2 + wd(e.pos.x, s.camera.x, s.worldW) * z, y: r.top + r.height / 2 + wd(e.pos.y, s.camera.y, s.worldH) * z });
    if (on === "moses") return { ...scr(s.player), id: 1 };
    if (on === "enemy") {
      const live = [...s.entities.values()].filter((e) => e.team === "enemy" && (e.hp ?? 1) > 0 && (!kinds || kinds.includes(e.kind)));
      let e = live.find((x) => x.id === lockId);
      if (!e) {
        // The nearest one that is well inside the screen.
        let best = Infinity;
        for (const x of live) {
          const p = scr(x);
          if (p.x < r.left + 60 || p.x > r.right - 60 || p.y < r.top + 120 || p.y > r.bottom - 160) continue;
          const d = Math.hypot(x.pos.x - s.player.pos.x, x.pos.y - s.player.pos.y);
          if (d < best) { best = d; e = x; }
        }
      }
      return e ? { ...scr(e), id: e.id } : { ...scr(s.player), id: -1 };
    }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: 0 };
  };
  // Hide the Test Map's buttons and HUD: only the game picture is filmed.
  window.__hideHud = () => {
    const cnv = findState()?.cnv;
    if (!cnv) return;
    const st = document.createElement("style");
    st.textContent = ".reel-hide{visibility:hidden!important}";
    document.head.appendChild(st);
    for (const el of document.body.querySelectorAll("*")) {
      if (el === cnv || el.contains(cnv) || cnv.contains(el)) continue;
      const p = getComputedStyle(el).position;
      if ((p === "absolute" || p === "fixed") && !el.closest(".reel-hide")) el.classList.add("reel-hide");
    }
  };
}

const b = await browser();
const sounds = [];
let frame = 0;
const ease = (u) => u * u * (3 - 2 * u);
for (const take of takes) {
  const pg = await b.newPage();
  await pg.setViewport({ width: VW, height: VH, deviceScaleFactor: DPR });
  // The game pauses in portrait (it asks to rotate the phone): report a square window to that check.
  if (PORTRAIT) await pg.evaluateOnNewDocument(() => {
    const h = Object.getOwnPropertyDescriptor(window, "innerHeight");
    Object.defineProperty(window, "innerHeight", { configurable: true, get: () => Math.min(h.get.call(window), window.innerWidth) });
  });
  pg.on("pageerror", (e) => console.log("page error:", e.message));
  await pg.evaluateOnNewDocument(pageSetup);
  await pg.goto(url, { waitUntil: "networkidle0", timeout: 180000 });
  const click = (text) => pg.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t) ?? [...document.querySelectorAll("button")].find((x) => x.textContent.includes(t));
    if (!el) throw new Error(`No button "${t}"`);
    el.click();
  }, text);
  for (const t of take.clicks ?? []) await click(t);
  // Level-up cards pause the game: pick one at once (preferring take.pick) so the menu never shows.
  const pickCard = async () => {
    const hit = await pg.evaluate((want) => {
      const cards = [...document.querySelectorAll('button[data-sfx-hover="ui.card"]')];
      if (!cards.length) return false;
      (cards.find((c) => want.some((w) => c.textContent.includes(w))) ?? cards[0]).click();
      return true;
    }, take.pick ?? []);
    if (hit) await new Promise((r) => setTimeout(r, 80)); // let React close the menu
    return hit;
  };
  await click("Start test map");
  await new Promise((r) => setTimeout(r, 6000)); // assets and sounds load
  await pg.evaluate(() => window.__vt.manual());
  if (PORTRAIT) await pg.evaluate(() => window.__hideHud());
  const play = async (seconds, moves = []) => {
    // Unfilmed play (warm-up, jumps in time); `moves` hold keys like in a shot.
    const held = new Set();
    for (let i = 0; i < Math.round(seconds * FPS); i++) {
      const t = i / FPS;
      const want = new Set(moves.filter(([a, z]) => t >= a && t < z).flatMap(([, , k]) => k.split("")));
      for (const k of held) if (!want.has(k)) { await pg.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await pg.keyboard.down(k); held.add(k); }
      await pg.evaluate(() => window.__vt.step(1000 / 30));
      if (i % 5 === 0) await pickCard();
    }
    for (const k of held) await pg.keyboard.up(k);
  };
  await play(take.warmup ?? 2, take.warmupMoves);

  for (const shot of take.shots) {
    if (shot.skip) await play(shot.skip, shot.skipMoves);
    const cam = shot.cam ?? {};
    const [z0, z1] = cam.zoom ?? [1, 1];
    const n = Math.round(shot.len * FPS);
    const outStart = frame / FPS;
    await pg.evaluate((o) => { window.__vt.t0 = window.__vt.now / 1000 - o; window.__vt.rec = true; }, outStart);
    const held = new Set();
    let cx = null, cy = null, lock = null;
    for (let f = 0; f < n; f++) {
      const t = f / FPS;
      const want = new Set((shot.moves ?? []).filter(([a, z]) => t >= a && t < z).flatMap(([, , k]) => k.split("")));
      for (const k of held) if (!want.has(k)) { await pg.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await pg.keyboard.down(k); held.add(k); }
      await pg.evaluate((ms) => window.__vt.step(ms), (1000 / FPS) * (shot.slow ?? 1));
      await pickCard();
      let clip;
      if (PORTRAIT) {
        const z = z0 + (z1 - z0) * ease(n > 1 ? f / (n - 1) : 1);
        const p = (await pg.evaluate((on, kinds, id) => window.__where(on, kinds, id), cam.on ?? "center", cam.kinds ?? null, lock)) ?? { x: VW / 2, y: VH / 2, id: 0 };
        lock = p.id;
        const tx = p.x + (cam.dx ?? 0), ty = p.y + (cam.dy ?? 0);
        // The camera eases towards its target (no jitter), starting on it.
        cx = cx == null ? tx : cx + (tx - cx) * 0.18;
        cy = cy == null ? ty : cy + (ty - cy) * 0.18;
        const w = VW / z, h = VH / z;
        const x = Math.max(0, Math.min(VW - w, cx - w / 2)), y = Math.max(0, Math.min(VH - h, cy - h / 2));
        clip = { x, y, width: w, height: h };
      } else {
        // Square layout: central square of the 1920x1080 view (Moses stays in the middle).
        clip = { x: 280, y: 0, width: 720, height: 720 };
      }
      // captureBeyondViewport must be off or Chromium resizes the page and the canvas is blank.
      const file = `${framesDir}/f${String(frame).padStart(4, "0")}.jpg`;
      await pg.screenshot({ path: file, type: "jpeg", quality: 92, captureBeyondViewport: false, clip });
      // Every frame must be 1080x1920 (close-ups come out smaller, wide shots larger).
      if (PORTRAIT && Math.round(clip.width * DPR) !== 1080) {
        execFileSync(FFMPEG, ["-v", "error", "-y", "-i", file, "-vf", "scale=1080:1920:flags=lanczos", "-q:v", "2", `${file}.jpg`]);
        fs.renameSync(`${file}.jpg`, file);
      }
      frame++;
      if (frame % 60 === 0) console.log(`frame ${frame}`);
    }
    for (const k of held) await pg.keyboard.up(k);
    await pg.evaluate(() => { window.__vt.rec = false; });
  }
  sounds.push(...(await pg.evaluate(() => window.__sounds)));
  await pg.close();
}
fs.writeFileSync(`${outDir}/sounds.json`, JSON.stringify(sounds));
await b.close();
console.log("capture done:", frame, "frames");
