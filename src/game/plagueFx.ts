// Canvas renderers for the reworked plague abilities (locusts, darkness light
// pockets, firstborn discharges, pillar zones, hail fire, Red Sea waves).
// Purely visual: no game state is changed here.
import locustFrontAsset from "@/assets/locust-front.png.asset.json";
import locustBackAsset from "@/assets/locust-back.png.asset.json";
import type { Entity, GameState, Vec2 } from "./types";

/** Hash-ish deterministic noise in [0,1). */
function hn(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Irregular, slowly breathing closed contour around (cx, cy). */
export function organicPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, t: number, amp = 0.12, squash = 1, verts = 28) {
  ctx.beginPath();
  for (let i = 0; i <= verts; i++) {
    const a = (i / verts) * Math.PI * 2;
    const k = 1
      + Math.sin(a * 3 + seed + t * 0.9) * amp * 0.55
      + Math.sin(a * 5 - seed * 1.7 + t * 1.4) * amp * 0.3
      + (hn(seed + i) - 0.5) * amp * 0.5;
    const x = Math.round(cx + Math.cos(a) * r * k);
    const y = Math.round(cy + Math.sin(a) * r * k * squash);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---------------- Locusts ----------------
const locustImgs: Record<"front" | "back", HTMLImageElement | null> = { front: null, back: null };
function locustImg(which: "front" | "back"): HTMLImageElement {
  let i = locustImgs[which];
  if (!i) {
    i = new Image();
    i.src = which === "front" ? locustFrontAsset.url : locustBackAsset.url;
    locustImgs[which] = i;
  }
  return i;
}
if (typeof window !== "undefined") { locustImg("front"); locustImg("back"); }

/** On-screen width of a locust sprite. */
const LOCUST_W = 46;

export function drawLocust(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const dir = (e.data?.dir as number) ?? 1;
  const img = locustImg(dir === 1 ? "front" : "back");
  if (!(img.complete && img.naturalWidth)) return;
  const w = LOCUST_W;
  const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const t = e.animT;
  // Ground shadow so the flying insect reads as airborne.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#2a1a08";
  ctx.fillRect(x - 10, y + 22, 20, 3);
  ctx.fillRect(x - 6, y + 21, 12, 5);
  ctx.restore();
  // Bank slightly into the lateral S-curve.
  const tilt = Math.max(-0.25, Math.min(0.25, (e.vel.x / 220) * dir * -1));
  // Wing beat: the outer wing columns squash horizontally; the body column
  // (centre 30%) stays intact so the artwork is never distorted.
  const beat = Math.sin(t * 7.5);
  const wingK = 0.82 + 0.18 * (0.5 + 0.5 * beat);
  const lift = beat > 0 ? -1 : 0;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const bodyF = 0.3;
  const sxL = Math.round(nw * (0.5 - bodyF / 2));
  const sxR = Math.round(nw * (0.5 + bodyF / 2));
  const bodyW = (w * (sxR - sxL)) / nw;
  const wingW = ((w - bodyW) / 2) * wingK;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y + lift);
  ctx.rotate(tilt);
  // Left wing, body, right wing.
  ctx.drawImage(img, 0, 0, sxL, nh, -bodyW / 2 - wingW, -h / 2 + (1 - wingK) * 3, wingW, h);
  ctx.drawImage(img, sxR, 0, nw - sxR, nh, bodyW / 2, -h / 2 + (1 - wingK) * 3, wingW, h);
  ctx.drawImage(img, sxL, 0, sxR - sxL, nh, -bodyW / 2, -h / 2, bodyW, h);
  ctx.restore();
}

// ---------------- Darkness ----------------
/** Weapon-flame anchor for a champion (world coords). */
export function championFlameAnchor(n: Entity): Vec2 {
  const f = n.facing === -1 ? -1 : 1;
  const k = n.kind === "aaron" ? 1.1 : n.kind === "miriam" ? 0.9 : 1;
  return { x: n.pos.x + f * 13 * k, y: n.pos.y - 34 * k };
}

let darkCanvas: HTMLCanvasElement | null = null;
export function drawDarkness(ctx: CanvasRenderingContext2D, s: GameState, camX: number, camY: number, viewW: number, viewH: number, k: number) {
  if (!darkCanvas) darkCanvas = document.createElement("canvas");
  const dc = darkCanvas;
  const cw = Math.ceil(viewW), ch = Math.ceil(viewH);
  if (dc.width !== cw || dc.height !== ch) { dc.width = cw; dc.height = ch; }
  const g = dc.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, cw, ch);
  g.fillStyle = `rgba(6,4,12,${0.86 * k})`;
  g.fillRect(0, 0, cw, ch);
  // Ragged dark veins drifting through the shadow so it never looks flat.
  g.fillStyle = `rgba(0,0,0,${0.12 * k})`;
  for (let i = 0; i < 14; i++) {
    const vx = ((hn(i) * cw + s.now * (8 + hn(i + 9) * 10)) % (cw + 120)) - 60;
    const vy = hn(i + 3) * ch;
    g.fillRect(Math.round(vx), Math.round(vy), 60 + hn(i + 5) * 80, 6 + hn(i + 7) * 10);
  }
  const lights: Array<{ x: number; y: number; r: number; seed: number }> = [];
  lights.push({ x: s.player.pos.x - camX, y: s.player.pos.y - camY - 10, r: 78, seed: 1 });
  for (const id of s.npcs.values()) {
    const n = s.entities.get(id);
    if (!n || n.data?.downedUntil) continue;
    const a = championFlameAnchor(n);
    lights.push({ x: a.x - camX, y: a.y - camY + 8, r: 58, seed: id });
  }
  // Cut irregular light pockets: soft outer ring, then the clear core.
  g.globalCompositeOperation = "destination-out";
  for (const L of lights) {
    g.fillStyle = "rgba(0,0,0,0.45)";
    organicPath(g, L.x, L.y, L.r * 1.18, L.seed, s.now, 0.16, 0.85);
    g.fill();
    g.fillStyle = "rgba(0,0,0,1)";
    organicPath(g, L.x, L.y, L.r * 0.82, L.seed + 3, s.now * 1.3, 0.2, 0.85);
    g.fill();
  }
  g.globalCompositeOperation = "source-over";
  ctx.drawImage(dc, 0, 0, viewW, viewH);
  // Warm glow inside each pocket.
  ctx.save();
  for (const L of lights) {
    ctx.globalAlpha = 0.16 * k;
    ctx.fillStyle = "#ffc878";
    organicPath(ctx, L.x, L.y, L.r * 0.7, L.seed + 7, s.now * 1.6, 0.22, 0.85);
    ctx.fill();
  }
  ctx.restore();
}

/** Small pixel flame on each champion's weapon while darkness is falling. */
export function drawChampionFlames(ctx: CanvasRenderingContext2D, s: GameState, camX: number, camY: number, k: number) {
  for (const id of s.npcs.values()) {
    const n = s.entities.get(id);
    if (!n || n.data?.downedUntil) continue;
    const a = championFlameAnchor(n);
    drawPixelFlame(ctx, a.x - camX, a.y - camY, s.now + id, 0.7, k);
  }
}

/** Stacked pixel flame; `size` 1 ≈ 12 px tall. */
export function drawPixelFlame(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, size = 1, alpha = 1) {
  const px = Math.max(2, Math.round(2 * size));
  const f1 = Math.sin(t * 13) > 0 ? 1 : 0;
  const f2 = Math.sin(t * 9 + 1) > 0 ? 1 : 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  const cols: Array<[number, number, number, string]> = [
    // dx, dy (from base, upward negative), height cells, colour
    [-2, 0, 3, "#b8300c"], [2, 0, 3, "#b8300c"],
    [-1, 0, 4 + f1, "#ff6a14"], [1, 0, 4 + f2, "#ff6a14"], [0, 0, 6 + f1, "#ff8a20"],
    [0, 0, 4, "#ffd050"], [-1, 0, 2, "#ffd050"], [1, 0, 2 + f2, "#ffd050"],
    [0, 0, 2, "#fff6c8"],
  ];
  for (const [dx, , hcells, c] of cols) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x + dx * px - px / 2), Math.round(y - hcells * px), px, hcells * px);
  }
  if (f1) { ctx.fillStyle = "#ffb040"; ctx.fillRect(Math.round(x + (f2 ? px : -px) * 1.5), Math.round(y - 8 * px), px, px); }
  ctx.restore();
}

// ---------------- Death of the Firstborn ----------------
export function drawFirstbornBolt(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const d = e.data!;
  const path = d.path as Vec2[] | undefined;
  if (!path || path.length < 1) return;
  const pts = [...path, ...(d.done ? [] : [{ x: e.pos.x, y: e.pos.y }])];
  const fade = d.done ? Math.max(0, (e.ttl ?? 0) / ((d.fadeFrom as number) || 0.3)) : Math.min(1, (e.ttl ?? 0) / 0.5);
  const seed = (d.seed as number) ?? e.id;
  const t = e.animT;
  ctx.save();
  // Soft cloud halo along the trunk.
  ctx.globalAlpha = 0.22 * fade;
  ctx.fillStyle = "#e8f0ff";
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i];
    const r = 5 + hn(seed + i) * 5;
    ctx.fillRect(Math.round(p.x - camX - r), Math.round(p.y - camY - r), r * 2, r * 2);
  }
  // Trunk: chunky white pixels with a pale-blue edge, crackling jitter.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let k = 0; k < steps; k++) {
      const u = k / steps;
      const jx = (hn(seed + i * 13 + k + Math.floor(t * 8)) - 0.5) * 2;
      const x = Math.round(a.x + (b.x - a.x) * u - camX + jx);
      const y = Math.round(a.y + (b.y - a.y) * u - camY);
      ctx.globalAlpha = 0.6 * fade;
      ctx.fillStyle = "#a8c4ff";
      ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.globalAlpha = fade;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    // Side branches sprout from every few joints and stay attached.
    if (i % 3 === 0) {
      const side = hn(seed + i) < 0.5 ? -1 : 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + side * (0.7 + hn(seed + i * 3) * 0.6);
      const len = 8 + hn(seed + i * 7) * 16;
      let bx = b.x, by = b.y;
      ctx.globalAlpha = 0.75 * fade;
      ctx.fillStyle = "#eef4ff";
      const segs = Math.ceil(len / 3);
      for (let k = 0; k < segs; k++) {
        bx += Math.cos(ang + (hn(seed + i + k) - 0.5) * 0.8) * 3;
        by += Math.sin(ang + (hn(seed + i + k) - 0.5) * 0.8) * 3;
        ctx.fillRect(Math.round(bx - camX), Math.round(by - camY), 2, 2);
      }
    }
  }
  // Glowing growth tip.
  if (!d.done) {
    const x = Math.round(e.pos.x - camX), y = Math.round(e.pos.y - camY);
    ctx.globalAlpha = 0.35 * fade;
    ctx.fillStyle = "#dfe8ff";
    ctx.fillRect(x - 7, y - 7, 14, 14);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
  ctx.restore();
}

export function drawFirstbornHit(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const life = Math.max(0, (e.ttl ?? 0) / ((e.data?.maxTtl as number) ?? 0.35));
  const x = Math.round(e.pos.x - camX), y = Math.round(e.pos.y - camY);
  const r = 6 + (1 - life) * 16;
  ctx.save();
  ctx.globalAlpha = life;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y + Math.sin(a) * r) - 1, 3, 3);
  }
  ctx.fillRect(x - 3, y - 3, 6, 6);
  ctx.restore();
}

// ---------------- Pillar zones ----------------
function zoneFade(e: Entity): number {
  const maxTtl = (e.data?.maxTtl as number) ?? 5;
  const age = maxTtl - (e.ttl ?? 0);
  return Math.max(0, Math.min(1, Math.min(age / 0.35, (e.ttl ?? 0) / 0.4)));
}

export function drawPillarCloud(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, now: number) {
  const r = (e.data?.radius as number) ?? 80;
  const seed = ((e.data?.seed as number) ?? e.id) % 1000;
  const cx = e.pos.x - camX, cy = e.pos.y - camY;
  const k = zoneFade(e);
  ctx.save();
  ctx.globalAlpha = 0.28 * k;
  ctx.fillStyle = "#dfe6ee";
  organicPath(ctx, cx, cy, r, seed, now, 0.1);
  ctx.fill();
  // Readable containment rim: billowing cloud puffs along the boundary.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + now * 0.15;
    const pr = 7 + hn(seed + i) * 7 + Math.sin(now * 2 + i) * 1.5;
    const rr = r * (0.96 + (hn(seed + i * 5) - 0.5) * 0.08);
    const x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr);
    ctx.globalAlpha = 0.75 * k;
    ctx.fillStyle = "#b8c2cf";
    ctx.fillRect(x - pr, y - pr * 0.7 + 2, pr * 2, pr * 1.4);
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(x - pr + 2, y - pr * 0.7, pr * 2 - 4, pr * 1.1);
  }
  ctx.restore();
}

export function drawPillarFire(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, now: number) {
  const r = (e.data?.radius as number) ?? 80;
  const seed = ((e.data?.seed as number) ?? e.id) % 1000;
  const cx = e.pos.x - camX, cy = e.pos.y - camY;
  const k = zoneFade(e);
  ctx.save();
  ctx.globalAlpha = 0.3 * k;
  ctx.fillStyle = "#a8240c";
  organicPath(ctx, cx, cy, r, seed, now * 1.5, 0.12);
  ctx.fill();
  ctx.globalAlpha = 0.25 * k;
  ctx.fillStyle = "#ff8a20";
  organicPath(ctx, cx, cy, r * 0.7, seed + 5, now * 2, 0.18);
  ctx.fill();
  ctx.restore();
  // Ring of tongues of flame along the edge, plus a few inside.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const rr = r * (0.92 + (hn(seed + i) - 0.5) * 0.1);
    drawPixelFlame(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, now + i * 0.37, 0.85 + hn(seed + i * 2) * 0.4, k);
  }
  for (let i = 0; i < 7; i++) {
    const a = hn(seed + i * 11) * Math.PI * 2, rr = hn(seed + i * 17) * r * 0.65;
    drawPixelFlame(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, now * 1.2 + i, 0.7, 0.8 * k);
  }
}

// ---------------- Hail: fire phase ----------------
export function drawFireball(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const t = e.animT || 0;
  const sp = Math.hypot(e.vel.x, e.vel.y) || 1;
  const ux = -e.vel.x / sp, uy = -e.vel.y / sp; // points back up the trail
  const nx = -uy, ny = ux;
  ctx.save();
  // Long licking comet tail: tongues that taper and flicker.
  for (let i = 18; i >= 0; i--) {
    const k = i / 18;
    const wob = Math.sin(t * 20 + i * 0.9) * (2 + k * 5);
    const px = x + ux * i * 4.5 + nx * wob;
    const py = y + uy * i * 4.5 + ny * wob;
    const sz = Math.max(2, Math.round((1 - k) * 14 + 2));
    ctx.globalAlpha = 1 - k * 0.75;
    ctx.fillStyle = k > 0.75 ? "#5a1a0c" : k > 0.5 ? "#c02a0c" : k > 0.25 ? "#ff6a14" : "#ffb040";
    ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
    if (i % 4 === 2) {
      ctx.fillStyle = "#ffd050";
      ctx.fillRect(Math.round(px + nx * sz * 0.8), Math.round(py + ny * sz * 0.8), 2, 2);
    }
  }
  // Smoke wisps far behind.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#3a2a24";
  for (let i = 0; i < 4; i++) {
    const d = 80 + i * 10;
    ctx.fillRect(Math.round(x + ux * d + Math.sin(t * 5 + i) * 6), Math.round(y + uy * d), 6, 4);
  }
  // Molten head: a rock core wrapped in flame.
  ctx.globalAlpha = 1;
  const f = Math.sin(t * 30) > 0 ? 1 : 0;
  ctx.fillStyle = "#c02a0c"; ctx.fillRect(x - 9, y - 8, 18, 16); ctx.fillRect(x - 8, y - 9, 16, 18);
  ctx.fillStyle = "#ff6a14"; ctx.fillRect(x - 7, y - 6 - f, 14, 12);
  ctx.fillStyle = "#ffb040"; ctx.fillRect(x - 5, y - 4, 10, 8);
  ctx.fillStyle = "#3a1408"; ctx.fillRect(x - 3, y - 2, 6, 5);
  ctx.fillStyle = "#ffe8a0"; ctx.fillRect(x - 2 + f, y - 4, 3, 2);
  ctx.restore();
}

export function drawFireExplosion(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, now: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 0.55;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxTtl));
  const t = 1 - life;
  const cx = e.pos.x - camX, cy = e.pos.y - camY;
  const R = (e.data?.radius as number) ?? 110;
  const seed = e.id % 997;
  const rNow = R * (0.45 + 0.55 * Math.min(1, t * 2.2));
  ctx.save();
  // Scorched, ragged ground patch.
  ctx.globalAlpha = 0.45 * life;
  ctx.fillStyle = "#2a1208";
  organicPath(ctx, cx, cy, rNow * 0.95, seed, 0, 0.22, 0.6, 22);
  ctx.fill();
  ctx.globalAlpha = 0.55 * life;
  ctx.fillStyle = "#c0300c";
  organicPath(ctx, cx, cy, rNow * 0.8, seed + 4, now * 3, 0.26, 0.6, 22);
  ctx.fill();
  ctx.globalAlpha = 0.6 * life;
  ctx.fillStyle = "#ffa030";
  organicPath(ctx, cx, cy, rNow * 0.45, seed + 9, now * 4, 0.3, 0.6, 18);
  ctx.fill();
  ctx.restore();
  // Uneven crown of flames: taller near the centre, shorter at the rim.
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = hn(seed + i) * Math.PI * 2;
    const rr = Math.sqrt(hn(seed + i * 7)) * rNow * 0.9;
    const size = (1.6 - rr / rNow) * (0.9 + hn(seed + i * 3) * 0.6) * (0.5 + life * 0.7);
    drawPixelFlame(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.6, now + i * 0.53, size, Math.min(1, life * 1.6));
  }
  // Flying embers.
  ctx.save();
  ctx.globalAlpha = life;
  for (let i = 0; i < 16; i++) {
    const a = hn(seed + i * 19) * Math.PI * 2;
    const d = rNow * (0.6 + t * 0.8) * hn(seed + i * 23);
    ctx.fillStyle = i % 2 ? "#ffd050" : "#ff6a14";
    ctx.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.6 - t * 30), 2, 2);
  }
  ctx.restore();
}

/** Cosmetic flame where a fire-killed enemy fell, ~2 s. */
export function drawCorpseFlame(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, now: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 2;
  const life = Math.max(0, (e.ttl ?? 0) / maxTtl);
  const x = e.pos.x - camX, y = e.pos.y - camY + 6;
  const k = Math.min(1, life * 3);
  ctx.save();
  ctx.globalAlpha = 0.35 * k;
  ctx.fillStyle = "#1e1008";
  ctx.fillRect(Math.round(x - 9), Math.round(y - 2), 18, 4);
  ctx.restore();
  drawPixelFlame(ctx, x, y, now * 1.1 + e.id, 0.6 + life * 0.5, k);
  drawPixelFlame(ctx, x - 6, y + 1, now + e.id * 0.3, 0.4 + life * 0.3, k * 0.9);
}

/** Flame carried by an enemy burning from the Pillar of Fire. */
export function drawBurningOverlay(ctx: CanvasRenderingContext2D, s: GameState, camX: number, camY: number) {
  for (const en of s.entities.values()) {
    if (en.team !== "enemy") continue;
    const bu = en.data?.burnUntil as number | undefined;
    if (bu == null || s.now >= bu) continue;
    const x = en.pos.x - camX, y = en.pos.y - camY;
    const hgt = Math.max(16, en.radius * 1.6);
    drawPixelFlame(ctx, x - 4, y - hgt * 0.4, s.now + en.id, 0.7, 0.95);
    drawPixelFlame(ctx, x + 5, y - hgt * 0.7, s.now * 1.2 + en.id * 0.5, 0.55, 0.9);
  }
}

// ---------------- Red Sea ----------------
export function drawRedSeaWall(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, now: number) {
  const d = e.data!;
  const height = (d.height as number) * 2;
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const sign = (d.sign as number) ?? (e.vel.x > 0 ? 1 : -1);
  const top = y - height / 2;
  const far = 4000;
  ctx.save();
  // Deep water behind the front, in layered vertical depth bands that get
  // lighter toward the crest.
  const bands: Array<[number, string]> = [[999, "#0b2550"], [150, "#123a7a"], [90, "#1a5aa8"], [48, "#2a7cc8"], [22, "#4aa0e0"]];
  const step = 6;
  for (let yy = 0; yy < height; yy += step) {
    // Ragged per-row front edge: the wall is never a straight line.
    const wob = Math.sin((yy + now * 120) * 0.045) * 7 + Math.sin(yy * 0.13 + now * 6) * 4 + (hn(Math.floor(yy / step) + Math.floor(now * 10)) - 0.5) * 4;
    const fx = x + sign * wob;
    for (const [depth, col] of bands) {
      const dpt = Math.min(depth, far);
      ctx.fillStyle = col;
      const x0 = sign > 0 ? fx - dpt : fx;
      ctx.fillRect(Math.round(x0), Math.round(top + yy), Math.round(dpt), step);
    }
  }
  // Rolling streaks travelling with the current.
  ctx.fillStyle = "rgba(170,215,255,0.5)";
  for (let yy = 8; yy < height; yy += 18) {
    for (let k = 0; k < 10; k++) {
      const off = ((k * 70 + now * 160 + yy * 3) % 700);
      const sx = x - sign * (40 + off);
      ctx.fillRect(Math.round(sx), Math.round(top + yy + Math.sin(k + now * 3) * 2), 10, 2);
    }
  }
  // Curling crest: foam lip with chunky overhanging curls.
  for (let yy = 0; yy < height; yy += 4) {
    const wob = Math.sin((yy + now * 120) * 0.045) * 7 + Math.sin(yy * 0.13 + now * 6) * 4;
    const cx = x + sign * wob;
    const curl = Math.max(0, Math.sin(yy * 0.09 + now * 4)) * 10;
    ctx.fillStyle = "#cfeaff";
    ctx.fillRect(Math.round(sign > 0 ? cx - 8 : cx), Math.round(top + yy), 8, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(sign > 0 ? cx - 2 : cx - curl + 2), Math.round(top + yy), Math.round(curl + 2), 3);
    if (curl > 7) ctx.fillRect(Math.round(cx + sign * curl), Math.round(top + yy + 3), 3, 3);
  }
  // Spray thrown forward off the crest (deterministic, flickering).
  ctx.fillStyle = "rgba(235,248,255,0.9)";
  const tick = Math.floor(now * 14);
  for (let i = 0; i < 40; i++) {
    const yy = hn(i + tick * 3) * height;
    const xx = x + sign * (6 + hn(i * 7 + tick) * 46);
    const sz = hn(i * 5) < 0.3 ? 3 : 2;
    ctx.fillRect(Math.round(xx), Math.round(top + yy), sz, sz);
  }
  ctx.restore();
}

export function drawRedSeaBurst(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 0.7;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxTtl));
  const t = 1 - life;
  const cx = e.pos.x - camX, cy = e.pos.y - camY;
  const height = (e.data?.height as number) ?? 700;
  const seed = e.id % 991;
  ctx.save();
  // A vertical seam of colliding water: towering, irregular crests shooting
  // up and outward along the whole meeting line.
  const rows = Math.ceil(height / 10);
  for (let r = 0; r < rows; r++) {
    const yy = cy - height / 2 + r * 10;
    const h = hn(seed + r);
    const rise = (0.4 + h * 0.6) * (1 - Math.abs(t - 0.35) * 1.4);
    if (rise <= 0) continue;
    const w = 18 + h * 40 * rise + t * 30;
    ctx.globalAlpha = Math.min(1, life * 1.4);
    ctx.fillStyle = "#2a7cc8";
    ctx.fillRect(Math.round(cx - w), Math.round(yy), Math.round(w * 2), 10);
    ctx.fillStyle = "#8cc8f4";
    ctx.fillRect(Math.round(cx - w * 0.7), Math.round(yy + 1), Math.round(w * 1.4), 7);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(cx - w * 0.35 + (h - 0.5) * 8), Math.round(yy + 2), Math.round(w * 0.7), 5);
    // Crest tongues thrown sideways.
    for (const sgn of [-1, 1]) {
      const len = (10 + hn(seed + r * 3 + (sgn > 0 ? 1 : 0)) * 50) * rise * (0.6 + t);
      ctx.fillStyle = "#e4f4ff";
      ctx.fillRect(Math.round(cx + sgn * w), Math.round(yy + 2), Math.round(sgn * len), 3);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(cx + sgn * (w + len)), Math.round(yy), 3, 3);
    }
  }
  // Spray droplets arcing out of the impact.
  for (let i = 0; i < 70; i++) {
    const sgn = i % 2 ? 1 : -1;
    const yy = cy + (hn(seed + i * 3) - 0.5) * height;
    const v = 60 + hn(seed + i * 7) * 180;
    const px = cx + sgn * v * t;
    const py = yy - (90 * t - 160 * t * t) * hn(seed + i * 11);
    ctx.globalAlpha = life;
    ctx.fillStyle = i % 3 ? "#ffffff" : "#a8d8ff";
    ctx.fillRect(Math.round(px), Math.round(py), 3, 3);
  }
  // Foam pools spreading on the sand.
  ctx.globalAlpha = 0.5 * life;
  ctx.fillStyle = "#e8f6ff";
  for (let i = 0; i < 18; i++) {
    const yy = cy + (hn(seed + i * 13) - 0.5) * height;
    const w = (20 + hn(seed + i) * 40) * (0.5 + t);
    ctx.fillRect(Math.round(cx - w / 2), Math.round(yy), Math.round(w), 4);
  }
  ctx.restore();
}

/** Staff angle for Moses' Red Sea casting pose, or null when not casting. */
export function redSeaStaffAngle(s: GameState, raise: number, strike: number): number | null {
  const rc = s.redSeaCast;
  if (!rc || s.now >= rc.end) return null;
  const el = s.now - rc.start;
  const UP = -1.35, DOWN = 1.15;
  if (el < raise) {
    const u = el / raise;
    return UP * (1 - (1 - u) * (1 - u));
  }
  if (el < raise + strike) {
    const u = (el - raise) / strike;
    return UP + (DOWN - UP) * u * u;
  }
  return DOWN;
}
