// Helmet visuals. Every effect is drawn in shades of one colour: the colour of
// the equipped helmet (HELMET_COLOR in helmets.ts).
import angelUrl from "@/assets/helmet-angel.png";
import type { Entity, GameState } from "./types";
import { angelAngles, ANGEL_RING, HELMET, helmetColor } from "./helmets";

// ---------------------------------------------------------------- colour
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Same hue, lighter (k > 0, toward white) or darker (k < 0, toward black). */
export function shade(hex: string, k: number): string {
  const [r, g, b] = rgb(hex);
  const m = (c: number) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, alpha: number, sy = 1): void {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(hex, 1)); g.addColorStop(.45, rgba(hex, .45)); g.addColorStop(1, rgba(hex, 0));
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** Height (screen px above the feet) of Moses' chest, where blows land. */
const CHEST = 40;

// ---------------------------------------------------------------- shield bar
/**
 * Moses' shield bar: the part granted by the helmet is painted in the helmet
 * colour (empty: a dark shade of it), the rest keeps the usual blue.
 */
export function drawShieldBar(ctx: CanvasRenderingContext2D, x: number, y: number, s: GameState): void {
  const sh = s.shield ?? 0, mx = s.maxShield ?? 0;
  if (!(sh > 0 && mx > 0)) return;
  const bw = 30;
  const bonus = Math.max(0, Math.min(mx, s.shieldBonus ?? 0));
  const baseW = Math.round(bw * (mx - bonus) / mx);
  const fillW = Math.round(bw * Math.max(0, Math.min(1, sh / mx)));
  const col = helmetColor(s.loadout?.shield.id);
  const x0 = x - bw / 2;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x0 - 1, y - 1, bw + 2, 5);
  ctx.fillStyle = "#1c3f66"; ctx.fillRect(x0, y, baseW, 3);
  if (bonus > 0) { ctx.fillStyle = shade(col, -.6); ctx.fillRect(x0 + baseW, y, bw - baseW, 3); }
  ctx.fillStyle = "#5fb4ff"; ctx.fillRect(x0, y, Math.min(fillW, baseW), 3);
  if (fillW > baseW) {
    ctx.fillStyle = col; ctx.fillRect(x0 + baseW, y, fillW - baseW, 3);
    ctx.fillStyle = shade(col, .55); ctx.fillRect(x0 + baseW, y, fillW - baseW, 1);
  }
  if (bonus > 0 && baseW > 0 && baseW < bw) { ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x0 + baseW, y, 1, 3); }
}

// ---------------------------------------------------------------- one-shot effects
/** Is this a helmet effect entity (drawn above everyone by drawHelmetFx)? */
export function isHelmetFx(kind: string): boolean {
  return kind === "helmhit" || kind === "helmweaken" || kind === "helmheal" || kind === "helmseal";
}

export function drawHelmetFx(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, camX: number, camY: number): void {
  const d = e.data ?? {};
  const maxTtl = Number(d.maxTtl ?? .5);
  const u = Math.max(0, Math.min(1, 1 - (e.ttl ?? 0) / maxTtl));
  if (u >= 1) return;
  const col = String(d.color ?? "#ffffff");
  const tgt = d.follow != null ? s.entities.get(Number(d.follow)) : undefined;
  const ax = (tgt?.pos.x ?? (e.kind === "helmhit" ? s.player.pos.x : e.pos.x)) - camX;
  const ay = (tgt?.pos.y ?? (e.kind === "helmhit" ? s.player.pos.y : e.pos.y - 2)) - camY + 8;
  ctx.save();
  if (e.kind === "helmhit") drawHit(ctx, ax, ay, u, col, d, s);
  else if (e.kind === "helmweaken") drawWeaken(ctx, s.player.pos.x - camX, s.player.pos.y - camY + 8, u, col, Number(d.left ?? 0));
  else if (e.kind === "helmheal") drawHeal(ctx, ax, ay, u, col, !!d.big, e.id);
  else if (e.kind === "helmseal") drawSeal(ctx, ax, ay, u, col, tgt);
  ctx.restore();
}

/** A blow stopped by the helmet. `x, y` are Moses' feet on screen. */
function drawHit(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, col: string, d: Record<string, unknown>, s: GameState): void {
  const dx = Number(d.dirX ?? 1), dy = Number(d.dirY ?? 0);
  const style = String(d.style ?? "shield");
  const fade = (1 - u) ** 1.2;
  if (style === "angel") {
    // The angel nearest the attacker takes the blow: a burst of light on it.
    const t = s.now - (s.equipFx?.helmAngelsAt ?? s.now);
    const a = angelAngles(t)[Number(d.angel ?? 0)] ?? 0;
    const px = x + Math.cos(a) * ANGEL_RING.rx, py = y + Math.sin(a) * ANGEL_RING.ry - 44;
    glow(ctx, px, py, 26 + 30 * u, col, .9 * fade);
    ctx.strokeStyle = shade(col, .6); ctx.lineWidth = 2; ctx.globalAlpha = fade;
    for (let i = 0; i < 8; i++) {
      const r = i / 8 * Math.PI * 2 + .3;
      ctx.beginPath(); ctx.moveTo(px + Math.cos(r) * (8 + 14 * u), py + Math.sin(r) * (8 + 14 * u));
      ctx.lineTo(px + Math.cos(r) * (16 + 26 * u), py + Math.sin(r) * (16 + 26 * u)); ctx.stroke();
    }
    return;
  }
  const cx = x, cy = y - CHEST;
  const ang = Math.atan2(dy * .6, dx);
  const R = style === "bubble" ? 40 : 30;
  const hx = cx + Math.cos(ang) * R, hy = cy + Math.sin(ang) * R * 1.1;
  glow(ctx, hx, hy, 18 + 22 * u, col, .85 * fade);
  if (style === "dust") {
    // Dust swirls out of the contact point.
    for (let i = 0; i < 14; i++) {
      const r1 = hash(i * 3.1 + 1), r2 = hash(i * 7.7 + 2);
      const a = ang + (r1 - .5) * 2.4;
      const dist = 6 + 34 * u * (.5 + r2);
      ctx.globalAlpha = .75 * fade;
      ctx.fillStyle = shade(col, i % 3 === 0 ? .5 : i % 3 === 1 ? -.15 : -.35);
      ctx.beginPath(); ctx.arc(hx + Math.cos(a) * dist, hy + Math.sin(a) * dist - 10 * u * r2, 2 + 3 * r2 * (1 - u * .5), 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  // A curved guard of light on the attacker's side, cracked for a halved blow.
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(1, 1.15);
  const span = style === "half" ? .55 : .85;
  const rr = R + 4 * u;
  ctx.globalAlpha = .35 * fade; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, 0, rr + 5, ang - span, ang + span); ctx.arc(0, 0, rr - 5, ang + span, ang - span, true); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = fade; ctx.strokeStyle = shade(col, .55); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, rr, ang - span, ang + span); ctx.stroke();
  ctx.strokeStyle = shade(col, -.25); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, rr - 5, ang - span * .9, ang + span * .9); ctx.stroke();
  // facets
  ctx.strokeStyle = shade(col, .3); ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    const a = ang + i * span / 2.5;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * (rr - 5), Math.sin(a) * (rr - 5)); ctx.lineTo(Math.cos(a) * (rr + 5), Math.sin(a) * (rr + 5)); ctx.stroke();
  }
  if (style === "half") {
    ctx.strokeStyle = shade(col, -.55); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * (rr + 6), Math.sin(ang) * (rr + 6));
    ctx.lineTo(Math.cos(ang + .12) * (rr + 1), Math.sin(ang + .12) * (rr + 1));
    ctx.lineTo(Math.cos(ang - .08) * (rr - 2), Math.sin(ang - .08) * (rr - 2));
    ctx.lineTo(Math.cos(ang + .05) * (rr - 6), Math.sin(ang + .05) * (rr - 6));
    ctx.stroke();
  }
  ctx.restore();
  // An impact ring and sparks bouncing back toward the attacker.
  ctx.globalAlpha = .9 * fade; ctx.strokeStyle = shade(col, .4); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(hx, hy, 4 + 18 * u, (4 + 18 * u) * .7, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = shade(col, .7);
  for (let i = 0; i < 7; i++) {
    const a = ang + (hash(i + 5) - .5) * 1.8;
    const r0 = 4 + 16 * u, r1 = r0 + 6 + 8 * hash(i + 9);
    ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); ctx.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); ctx.stroke();
  }
}

/** Shield of Abraham, drawn on Moses: a golden ward flashes over his body, the
 *  shield badge above his head cracks in two, and pips show the charges left. */
function drawWeaken(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, col: string, left: number): void {
  const h = 78; // Moses' height on screen
  const fade = Math.min(1, (1 - u) * 2.2);
  glow(ctx, x, y - h * .5, 52, col, .6 * fade, 1.5);
  // A golden outline swelling around his body.
  ctx.globalAlpha = .8 * fade * (1 - u); ctx.strokeStyle = shade(col, .45); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y - h * .5, 20 + 12 * u, h * .55 + 8 * u, 0, 0, Math.PI * 2); ctx.stroke();
  // Golden motes rising off him: the blow's strength shed.
  for (let i = 0; i < 9; i++) {
    const r1 = hash(i * 4.1 + 3), r2 = hash(i * 6.3 + 1);
    const px = x + (r1 - .5) * 34, py = y - 8 - r2 * h * .8 - 26 * u;
    ctx.globalAlpha = fade * (.5 + .5 * r2);
    ctx.fillStyle = shade(col, i % 2 ? .55 : -.1);
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
  // Cracked shield badge above the head, split in two halves drifting apart.
  const by = y - h - 14 - 6 * u, gap = 1 + 5 * u;
  ctx.globalAlpha = fade;
  // Remaining charges under the badge.
  for (let i = 0; i < left; i++) {
    const px = x + (i - (left - 1) / 2) * 8, py = by + 13;
    ctx.fillStyle = shade(col, -.45); ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    ctx.fillStyle = shade(col, .6); ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(x + side * gap, by); ctx.rotate(side * .25 * u);
    ctx.fillStyle = col; ctx.strokeStyle = shade(col, -.5); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(side * 8, -6); ctx.lineTo(side * 7, 2); ctx.quadraticCurveTo(side * 4, 7, 0, 9);
    ctx.lineTo(side * 1.5, 3); ctx.lineTo(-side * 1, -1); ctx.lineTo(side * 1, -5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade(col, .6); ctx.fillRect(side > 0 ? 2 : -4, -5, 2, 2);
    ctx.restore();
  }
}

/** Shield of Joseph / Burning Bush: health restored after a quiet spell. */
function drawHeal(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, col: string, big: boolean, seed: number): void {
  const fade = Math.min(1, u / .12, (1 - u) / .4);
  glow(ctx, x, y - 2, (big ? 46 : 34) * (.6 + .4 * u), col, .5 * fade, .45);
  ctx.globalAlpha = .8 * fade; ctx.strokeStyle = shade(col, .35); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y - 2, 12 + (big ? 34 : 24) * u, (12 + (big ? 34 : 24) * u) * .4, 0, 0, Math.PI * 2); ctx.stroke();
  const n = big ? 12 : 7;
  for (let i = 0; i < n; i++) {
    const r1 = hash(seed + i * 3.3), r2 = hash(seed + i * 9.1);
    const k = Math.max(0, Math.min(1, (u - r2 * .35) / .65));
    if (k <= 0) continue;
    const px = x + (r1 - .5) * (big ? 48 : 36);
    const py = y - 8 - k * (50 + 30 * r1);
    const sz = (big ? 4 : 3) + 2 * r2;
    ctx.globalAlpha = fade * Math.sin(k * Math.PI);
    ctx.fillStyle = shade(col, -.35); ctx.fillRect(px - sz - 1, py - 2, sz * 2 + 2, 4); ctx.fillRect(px - 2, py - sz - 1, 4, sz * 2 + 2);
    ctx.fillStyle = shade(col, .55); ctx.fillRect(px - sz, py - 1, sz * 2, 2); ctx.fillRect(px - 1, py - sz, 2, sz * 2);
  }
}

/** Light of the Covenant: a seal of light closes on the foe and stamps it. */
function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, col: string, tgt?: Entity): void {
  const h = Math.max(30, Math.min(70, (tgt?.radius ?? 14) * 3.4));
  const fade = Math.min(1, (1 - u) * 3);
  const close = 1 - (1 - Math.min(1, u / .45)) ** 2;
  const r = 60 - 40 * close;
  glow(ctx, x, y - h * .5, h * (.6 + .4 * close), col, .7 * fade, 1.2);
  ctx.save(); ctx.translate(x, y - 2); ctx.scale(1, .45);
  ctx.globalAlpha = fade; ctx.strokeStyle = shade(col, .3); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = shade(col, -.3);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + u * 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 7, a, a + .55); ctx.stroke();
  }
  ctx.restore();
  // The seal stamps down from above onto the foe's head.
  const by = y - h - 12 - 30 * (1 - close);
  ctx.globalAlpha = fade;
  sealGlyph(ctx, x, by, 7 + 3 * (1 - close), col);
  if (u > .4 && u < .75) {
    ctx.strokeStyle = shade(col, .6); ctx.lineWidth = 2; ctx.globalAlpha = fade * (1 - (u - .4) / .35);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 12, by + Math.sin(a) * 12); ctx.lineTo(x + Math.cos(a) * 22, by + Math.sin(a) * 22); ctx.stroke();
    }
  }
}

/** A round seal with a cross of light. */
function sealGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  ctx.fillStyle = shade(col, -.45); ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(col, -.45);
  ctx.fillRect(x - 1, y - r + 2, 2, r * 2 - 4); ctx.fillRect(x - r + 2, y - 1, r * 2 - 4, 2);
  ctx.fillStyle = shade(col, .7); ctx.fillRect(x - r * .5, y - r * .6, 2, 2);
}

/** A sealed foe keeps a faint ring of covenant light and a small seal over its head. */
export function drawSealedMark(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, camX: number, camY: number, layer: "ground" | "over"): void {
  if (!e.data?.sealed) return;
  const col = helmetColor("covenant");
  const x = e.pos.x - camX, y = e.pos.y - camY + 8;
  const pulse = .5 + .5 * Math.sin(s.now * 4 + e.id);
  if (layer === "ground") {
    glow(ctx, x, y, 26, col, .35 + .15 * pulse, .4);
    ctx.save(); ctx.globalAlpha = .55 + .25 * pulse; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, 17, 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return;
  }
  const h = Math.max(30, Math.min(70, e.radius * 3.4));
  ctx.save(); ctx.globalAlpha = .85;
  glow(ctx, x, y - h - 10, 12, col, .5 + .3 * pulse);
  sealGlyph(ctx, x, y - h - 10 + Math.sin(s.now * 3 + e.id) * 1.5, 5, col);
  ctx.restore();
}

// ---------------------------------------------------------------- around Moses
let angelImg: HTMLImageElement | null = null;
function angelArt(): HTMLImageElement | null {
  if (typeof document === "undefined") return null;
  if (!angelImg) { angelImg = new Image(); angelImg.src = angelUrl; }
  return angelImg.complete && angelImg.naturalWidth > 0 ? angelImg : null;
}
/** helmet-angel.png: 80×86, feet at the bottom centre (40, 85). */
const ANGEL = { W: 80, H: 86, FX: 40, FY: 85, PX: .85 } as const;

/**
 * Lasting helmet effects around Moses: Jacob's magic bubble, the Promise's
 * invincibility, the Cloud's dust and the God of Israel's three angels.
 * `x, y` are Moses' feet on screen. "back" is drawn before Moses, "front" after.
 */
export function drawHelmetAura(ctx: CanvasRenderingContext2D, s: GameState, x: number, y: number, layer: "back" | "front"): void {
  const id = s.loadout?.shield.id;
  if (!id) return;
  const f = s.equipFx ?? {};
  const now = s.now, col = helmetColor(id);
  ctx.save();
  if (id === "jacobm") {
    const charges = Number(f.helmCharges ?? 0);
    const popU = (now - (f.helmBubblePopAt ?? -9)) / .45;
    if (charges > 0) {
      const inU = Math.min(1, (now - (f.helmBubbleAt ?? -9)) / .35);
      bubble(ctx, x, y, col, 1 - (1 - inU) ** 3, charges, now, layer);
    } else if (popU < 1 && layer === "front") {
      // The bubble bursts after its third blow.
      ctx.globalAlpha = 1 - popU; ctx.strokeStyle = shade(col, .4); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y - CHEST, 40 + 30 * popU, (40 + 30 * popU) * 1.2, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, r = 42 + 40 * popU;
        ctx.fillStyle = shade(col, .6); ctx.fillRect(x + Math.cos(a) * r - 1.5, y - CHEST + Math.sin(a) * r * 1.2 - 1.5, 3, 3);
      }
    }
  } else if (id === "promise" && now < (f.helmInvulnUntil ?? 0) + .25) {
    const t = now - (f.helmInvulnAt ?? now);
    const a = Math.min(1, t / .1, ((f.helmInvulnUntil ?? 0) + .25 - now) / .35);
    if (layer === "back") glow(ctx, x, y - CHEST, 58, col, .55 * a, 1.25);
    else {
      // A golden ring of promise turning around him, rays rising from it.
      ctx.globalAlpha = .9 * a;
      ctx.strokeStyle = shade(col, .35); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y - 2, 30, 11, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const ang = i / 10 * Math.PI * 2 + t * 2.5;
        const px = x + Math.cos(ang) * 30, py = y - 2 + Math.sin(ang) * 11;
        const len = 30 + 26 * hash(i + Math.floor(t * 12));
        const g = ctx.createLinearGradient(px, py, px, py - len);
        g.addColorStop(0, rgba(col, .9)); g.addColorStop(1, rgba(col, 0));
        ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - len); ctx.stroke();
      }
      glow(ctx, x, y - CHEST, 34, col, .35 * a);
    }
  } else if (id === "cloud" && now < (f.helmDustUntil ?? 0) + .3) {
    const t = now - (f.helmDustAt ?? now);
    const a = Math.min(1, t / .12, ((f.helmDustUntil ?? 0) + .3 - now) / .4);
    if (layer === "back") glow(ctx, x, y - CHEST, 50, col, .35 * a, 1.2);
    else {
      // Whirling dust motes around Moses.
      for (let i = 0; i < 26; i++) {
        const r1 = hash(i * 2.3), r2 = hash(i * 5.9);
        const ang = r1 * Math.PI * 2 + t * (3 + 2 * r2);
        const rr = 26 + 14 * r2;
        const px = x + Math.cos(ang) * rr, py = y - 10 - r1 * 60 + Math.sin(ang) * rr * .35;
        ctx.globalAlpha = a * (.45 + .45 * r2);
        ctx.fillStyle = shade(col, i % 3 === 0 ? .4 : i % 3 === 1 ? -.2 : -.4);
        ctx.beginPath(); ctx.arc(px, py, 1.5 + 2.5 * r2, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (id === "israel" && now < (f.helmAngelsUntil ?? 0) + .3) {
    drawAngels(ctx, s, x, y, col, layer);
  }
  ctx.restore();
}

/** Mantle of Jacob: a translucent sphere; one orbiting rune per blow it can still stop. */
function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, col: string, k: number, charges: number, now: number, layer: "back" | "front"): void {
  const cy = y - CHEST, rx = 36 * (.6 + .4 * k), ry = rx * 1.25;
  if (layer === "back") {
    const g = ctx.createRadialGradient(x, cy, rx * .3, x, cy, rx * 1.1);
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(.75, rgba(col, .1 * k)); g.addColorStop(1, rgba(col, .3 * k));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    bubbleRunes(ctx, x, cy, rx, ry, col, k, charges, now, "back");
    return;
  }
  const shimmer = .5 + .5 * Math.sin(now * 3);
  ctx.globalAlpha = (.45 + .2 * shimmer) * k; ctx.strokeStyle = shade(col, .3); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  // highlight arc
  ctx.globalAlpha = .6 * k; ctx.strokeStyle = shade(col, .75); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, cy, rx * .8, ry * .82, 0, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  bubbleRunes(ctx, x, cy, rx, ry, col, k, charges, now, "front");
}

/** Jacob's runes orbit around Moses: on the upper half of the orbit they pass
 *  behind him (drawn before him, smaller and dimmer), on the lower half in front. */
function bubbleRunes(ctx: CanvasRenderingContext2D, x: number, cy: number, rx: number, ry: number, col: string, k: number, charges: number, now: number, layer: "back" | "front"): void {
  for (let i = 0; i < charges; i++) {
    const a = now * 1.8 + i * Math.PI * 2 / 3;
    const depth = Math.sin(a); // -1 far side, +1 near side
    if ((layer === "back") !== (depth < 0)) continue;
    const px = x + Math.cos(a) * rx, py = cy + depth * ry * .35;
    const sc = .8 + .2 * depth, al = k * (.75 + .25 * depth);
    glow(ctx, px, py, 9 * sc, col, .7 * al);
    ctx.globalAlpha = al; ctx.fillStyle = shade(col, -.4); ctx.fillRect(px - 3 * sc, py - 3 * sc, 6 * sc, 6 * sc);
    ctx.fillStyle = shade(col, .6); ctx.fillRect(px - 2 * sc, py - 2 * sc, 4 * sc, 4 * sc);
  }
}

/** Shield of the God of Israel: three angels circling Moses, taking his blows. */
function drawAngels(ctx: CanvasRenderingContext2D, s: GameState, x: number, y: number, col: string, layer: "back" | "front"): void {
  const f = s.equipFx ?? {};
  const t = s.now - (f.helmAngelsAt ?? s.now);
  const until = (f.helmAngelsUntil ?? 0) - (f.helmAngelsAt ?? 0) || HELMET.israelFor;
  const a = Math.max(0, Math.min(1, t / .15, (until + .3 - t) / .3));
  const img = angelArt();
  angelAngles(t).forEach((ang, i) => {
    const behind = Math.sin(ang) < 0;
    if ((layer === "back") !== behind) return;
    const px = x + Math.cos(ang) * ANGEL_RING.rx, gy = y + Math.sin(ang) * ANGEL_RING.ry;
    const bob = Math.sin(s.now * 5 + i * 2) * 2.5 - 8;
    const appear = Math.min(1, t / .2);
    // shadow on the ground
    ctx.globalAlpha = .18 * a; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(px, gy + 2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // a column of light where each angel descends
    if (appear < 1) glow(ctx, px, gy - 50, 40, col, (1 - appear) * .9, 2);
    glow(ctx, px, gy - 44 + bob, 34, col, .45 * a, 1.3);
    if (img) {
      const w = ANGEL.W * ANGEL.PX, h = ANGEL.H * ANGEL.PX;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(px, gy + bob);
      if (Math.cos(ang) < 0) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -ANGEL.FX * ANGEL.PX, -ANGEL.FY * ANGEL.PX, w, h);
      ctx.restore();
    }
    // halo
    const hy = gy + bob - ANGEL.FY * ANGEL.PX + 2;
    ctx.globalAlpha = a; ctx.strokeStyle = shade(col, .5); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(px + (Math.cos(ang) < 0 ? -2 : 2), hy, 8, 3, 0, 0, Math.PI * 2); ctx.stroke();
  });
}
