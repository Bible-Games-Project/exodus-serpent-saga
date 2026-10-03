// Shared renderer for allied champions (data from allies.ts) and their
// lightweight Canvas pixel-art FX. Sprites are the supplied PNGs drawn 1:1;
// only the feet band steps during the walk so the robe/body stays intact.
import type { Entity, GameState } from "./types";
import { allyDef, type AllyDef } from "./allies";

const imgs = new Map<string, HTMLImageElement>();
function load(url: string): HTMLImageElement | null {
  if (typeof document === "undefined") return null;
  let i = imgs.get(url);
  if (!i) { i = new Image(); i.src = url; imgs.set(url, i); }
  return i.complete && i.naturalWidth ? i : null;
}
function img(def: AllyDef): HTMLImageElement | null {
  return load(def.weapon ? def.weapon.bodyUrl : def.sprite.url);
}

/** Weapon rotation (rad, facing right) for the current attack timeline. */
export function allyWeaponAngle(def: AllyDef, attackT: number | undefined): number {
  const w = def.weapon;
  if (!w || attackT == null) return 0;
  const el = def.windup + def.action - attackT;
  if (el < def.windup) return w.windupAngle * Math.sin((el / def.windup) * Math.PI / 2);
  const k = Math.min(1, (el - def.windup) / def.action);
  const f = def.impactFrac ?? 0.35;
  if (k < f) { const q = k / f; return w.windupAngle + (w.swingAngle - w.windupAngle) * q * q; }
  if (k < f + 0.25) return w.swingAngle;
  return w.swingAngle * (1 - (k - f - 0.25) / (1 - f - 0.25));
}

const rnd = (seed: number, i: number) => {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, frac: number, fg: string, bg: string) {
  const bw = 30;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x - bw / 2 - 1, y - 1, bw + 2, 5);
  ctx.fillStyle = bg; ctx.fillRect(x - bw / 2, y, bw, 3);
  ctx.fillStyle = fg; ctx.fillRect(x - bw / 2, y, Math.round(bw * Math.max(0, Math.min(1, frac))), 3);
}

function drawGrave(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const P = 3;
  const p = (dx: number, dy: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x + dx * P, y + dy * P, w * P, h * P); };
  p(-5, 1, 10, 2, "#8a6338");         // mound
  p(-4, 0, 8, 1, "#a8814c");
  p(-3, -7, 6, 8, "#5b5850");         // stone
  p(-2, -8, 4, 1, "#5b5850");
  p(-2, -7, 4, 7, "#8f8b80");
  p(-1, -8, 2, 1, "#8f8b80");
  p(-1, -6, 2, 4, "#5b5850");         // cross
  p(-2, -5, 4, 1, "#5b5850");
}

/** Returns true when the entity is a registered champion and was drawn. */
export function drawAlly(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState): boolean {
  const def = allyDef(e.kind);
  if (!def) return false;
  const im = img(def);
  const d = e.data ?? {};
  const x = Math.round(e.pos.x - camX);
  const gy = Math.round(e.pos.y - camY + 10);
  const { W, H, CX, FOOT_TOP, FOOT_X0, FOOT_X1, FOOT_SPLIT } = def.sprite;
  const sc = def.sprite.scale ?? 1;

  if (d.downedUntil != null) {
    drawGrave(ctx, x, gy - 6);
    const left = Math.max(0, (d.downedUntil as number) - s.now);
    bar(ctx, x, gy - 40, 1 - left / 30, "#9a9a9a", "#3a3a3a");
    return true;
  }
  // Ground shadow
  ctx.fillStyle = "rgba(40,25,10,0.25)";
  ctx.fillRect(x - 15, gy - 2, 30, 3); ctx.fillRect(x - 11, gy - 3, 22, 5);

  const summonUntil = d.summonUntil as number | undefined;
  if (summonUntil && s.now < summonUntil) ctx.globalAlpha = 0.4 + 0.6 * (1 - (summonUntil - s.now));
  if (!im) { ctx.globalAlpha = 1; return true; }

  const moving = Math.hypot(e.vel.x, e.vel.y) > 5;
  // Walk cadence follows ground speed so feet never slide.
  const phase = (d.walkPhase as number ?? 0) + (moving ? Math.hypot(e.vel.x, e.vel.y) / 60 * 0.1 : 0);
  d.walkPhase = phase; e.data = d;
  const sw = Math.sin(phase * Math.PI * 2);
  const lift = moving ? Math.round(Math.abs(sw) * 2) : 0;
  const bodyBob = moving && lift >= 2 ? -1 : 0;

  // Attack pose: lean back while preparing, lunge forward on the action.
  let lean = 0, push = 0;
  const at = d.attackT as number | undefined;
  if (at != null) {
    const total = def.windup + def.action;
    const el = total - at;
    if (el < def.windup) { const k = el / def.windup; lean = -0.12 * k; push = -2 * k; }
    else { const k = Math.min(1, (el - def.windup) / def.action); const f = Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * (1 - k * 0.6); lean = 0.2 * f; push = 4 * f; }
    if (def.attack === "horn") { lean *= -0.5; push *= 0.3; } // blowing: chest back
    if (def.weapon) { lean = 0; push *= 0.25; } // the weapon strikes, not the body
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, gy);
  if (sc !== 1) ctx.scale(sc, sc);
  if (e.facing === -1) ctx.scale(-1, 1);
  ctx.translate(push, 0);
  if (lean) ctx.rotate(lean);
  ctx.translate(-CX, -H);
  // Feet band: two feet alternate lift + stride; everything else stays whole.
  if (moving) {
    const a = sw > 0 ? 1 : 0;
    ctx.drawImage(im, 0, 0, W, FOOT_TOP, 0, bodyBob, W, FOOT_TOP);
    const fh = H - FOOT_TOP;
    ctx.drawImage(im, FOOT_X1, FOOT_TOP, W - FOOT_X1, fh, FOOT_X1, FOOT_TOP, W - FOOT_X1, fh);
    ctx.drawImage(im, 0, FOOT_TOP, FOOT_X0, fh, 0, FOOT_TOP, FOOT_X0, fh);
    ctx.drawImage(im, FOOT_X0, FOOT_TOP, FOOT_SPLIT - FOOT_X0, fh, FOOT_X0 - (a ? 1 : -1), FOOT_TOP - (a ? 0 : lift), FOOT_SPLIT - FOOT_X0, fh);
    ctx.drawImage(im, FOOT_SPLIT, FOOT_TOP, FOOT_X1 - FOOT_SPLIT, fh, FOOT_SPLIT + (a ? 1 : -1), FOOT_TOP - (a ? lift : 0), FOOT_X1 - FOOT_SPLIT, fh);
  } else {
    ctx.drawImage(im, 0, 0, W, H, 0, 0, W, H);
  }
  // Held weapon: one complete layer attached to the grip, rotated as a whole.
  const w = def.weapon;
  if (w) {
    const wi = load(w.weaponUrl), hi = load(w.handUrl);
    if (wi) {
      ctx.save();
      ctx.translate(w.pivot.x, w.pivot.y + bodyBob);
      ctx.rotate(allyWeaponAngle(def, at));
      ctx.drawImage(wi, -w.pivot.x, -w.pivot.y);
      ctx.restore();
    }
    if (hi) ctx.drawImage(hi, 0, bodyBob);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  bar(ctx, x, gy - Math.round(H * sc) - 8, e.hp / e.maxHp, "#4ec24e", "#1e5a1e");
  return true;
}

/** Ally FX hazards. Returns true when handled. */
export function drawAllyFx(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState): boolean {
  const k = e.kind;
  if (k !== "allydust" && k !== "allysplash" && k !== "allyhorn" && k !== "allyinvoke") return false;
  const d = e.data ?? {};
  const maxT = (d.maxTtl as number) ?? 0.5;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxT));
  const g = 1 - life;
  const seed = (d.seed as number) ?? 1;
  const R = (d.radius as number) ?? 40;
  let x = e.pos.x - camX, y = e.pos.y - camY;
  const P = 3;
  const sq = (px: number, py: number, sz: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(px / P) * P, Math.round(py / P) * P, sz, sz); };
  ctx.save();
  if (k === "allydust") {
    const n = 10 + Math.floor(rnd(seed, 1) * 8);
    const base = rnd(seed, 2) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = base + rnd(seed, i + 10) * Math.PI * 2;
      const r = R * (0.2 + rnd(seed, i + 30) * 0.8) * Math.min(1, g * 1.8);
      ctx.globalAlpha = life * 0.85;
      const c = ["#e6d3ab", "#cbb083", "#b19467", "#d8c294"][i % 4];
      const sz = P * (1 + Math.floor(rnd(seed, i + 50) * 3) - (g > 0.6 ? 1 : 0));
      sq(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5 - g * 14 * rnd(seed, i + 70), Math.max(P, sz), c);
    }
  } else if (k === "allysplash") {
    const n = 8 + Math.floor(rnd(seed, 3) * 6);
    for (let i = 0; i < n; i++) {
      const a = rnd(seed, i + 5) * Math.PI * 2;
      const r = R * (0.3 + rnd(seed, i + 15) * 0.7) * g;
      const up = Math.sin(g * Math.PI) * 14 * rnd(seed, i + 25);
      ctx.globalAlpha = life;
      sq(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5 - up - 12, P * (1 + (i % 2)), i % 3 ? "#5fa8d8" : "#c8ecff");
    }
    ctx.globalAlpha = life * 0.6;
    ctx.fillStyle = "#3d7fb0";
    ctx.fillRect(Math.round(x - R * 0.6 * g), Math.round(y), Math.round(R * 1.2 * g) + 1, P);
  } else if (k === "allyhorn") {
    // Follow the horn of the ally who blew it.
    const ally = d.allyId != null ? s.entities.get(d.allyId as number) : undefined;
    const def = ally ? allyDef(ally.kind) : undefined;
    if (ally && def) {
      x = ally.pos.x - camX + (def.sprite.FX.x - def.sprite.CX) * ally.facing;
      y = ally.pos.y - camY + 10 - def.sprite.H + def.sprite.FX.y;
    }
    const ang = (d.angle as number) ?? 0;
    for (let w = 0; w < 3; w++) {
      const t = g * 1.3 - w * 0.18;
      if (t <= 0 || t >= 1) continue;
      const rr = 8 + t * R;
      ctx.globalAlpha = (1 - t) * 0.9;
      const segs = 9;
      for (let i = 0; i < segs; i++) {
        if (rnd(seed + w, i) > 0.82) continue;
        const a = ang + (i / (segs - 1) - 0.5) * 1.1;
        sq(x + Math.cos(a) * rr, y + Math.sin(a) * rr, P * (w === 0 ? 2 : 1) , w % 2 ? "#f6e2a8" : "#e1a256");
      }
    }
  } else {
    // Invocation: rising golden pillar + outward ring of sand pixels.
    ctx.globalAlpha = life * 0.5;
    ctx.fillStyle = "#fbd98f";
    ctx.fillRect(Math.round(x - 12), Math.round(y - 110), 24, 120);
    ctx.globalAlpha = life;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + rnd(seed, i) * 0.2;
      const r = R * g * (0.85 + rnd(seed, i + 40) * 0.15);
      sq(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, P * 2, i % 2 ? "#f6c674" : "#e6d3ab");
    }
  }
  ctx.restore();
  return true;
}

/** In-flight water thrown from Jochebed's basket. */
export function drawAllyWater(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number): void {
  const x = e.pos.x - camX, y = e.pos.y - camY - 14;
  const seed = (e.data?.seed as number) ?? 1;
  const vx = e.vel.x, vy = e.vel.y;
  const sp = Math.hypot(vx, vy) || 1;
  const P = 3;
  for (let i = 0; i < 7; i++) {
    const back = i * 4;
    const jx = (rnd(seed + Math.floor(e.animT * 20), i) - 0.5) * 4;
    const px = x - (vx / sp) * back + jx, py = y - (vy / sp) * back + jx;
    ctx.fillStyle = i === 0 ? "#c8ecff" : i < 3 ? "#5fa8d8" : "#3d7fb0";
    const sz = i < 2 ? P * 2 : P;
    ctx.fillRect(Math.round(px / P) * P, Math.round(py / P) * P, sz, sz);
  }
}
