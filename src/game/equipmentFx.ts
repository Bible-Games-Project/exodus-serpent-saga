import type { Entity, GameState } from "./types";
import godHandUrl from "@/assets/staff-god-hand.png";
import ringCrystalUrl from "@/assets/combat-staff-ring-crystal.png";
import ringDiamondUrl from "@/assets/combat-staff-ring-diamond.png";
import ringFireUrl from "@/assets/combat-staff-ring-fire.png";
import tornadoUrl from "@/assets/combat-staff-tornado.png";
import waveUrl from "@/assets/combat-staff-wave.png";
import lightBeamUrl from "@/assets/combat-staff-light-beam.png";

const fxImages = new Map<string, HTMLImageElement>();
function fxImage(url: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = fxImages.get(url);
  if (!img) { img = new Image(); img.src = url; fxImages.set(url, img); }
  return img.complete && img.naturalWidth ? img : null;
}
const RING_ART: Record<string, string> = { crystal: ringCrystalUrl, diamond: ringDiamondUrl, fire: ringFireUrl };
/** Supplied staff effect art is drawn see-through, as asked. */
const STAFF_ART_ALPHA = .78;

/** A supplied ring lying on the ground, slowly turning. `r` is its outer radius. */
export function drawStaffRing(ctx: CanvasRenderingContext2D, art: string, x: number, y: number, r: number, angle: number, alpha: number): boolean {
  const img = fxImage(RING_ART[art] ?? ringCrystalUrl);
  if (!img || r <= 0 || alpha <= 0) return !!img;
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, .55); ctx.rotate(angle);
  ctx.globalAlpha = alpha * STAFF_ART_ALPHA; ctx.imageSmoothingEnabled = true;
  const w = r * 2, h = w * img.naturalHeight / img.naturalWidth;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

/** Total visual cast: 1 s charge, 0.3 s slam, 0.3 s settle. */
export const STAFF_CAST_VISUAL_SECONDS = 1.6;

/** Visual-only staff cast progress (0..1) while a staff special is being cast. */
export function latestEquipmentCastProgress(state: GameState): number | null {
  const at = state.equipFx?.staffVisualAt;
  if (at === undefined || state.now < at || state.now - at > STAFF_CAST_VISUAL_SECONDS) return null;
  return (state.now - at) / STAFF_CAST_VISUAL_SECONDS;
}

/** Rear-staff pose: raised while charging, slammed to the ground, then settles. */
export function staffCastPose(progress: number | null): { angle: number; lift: number } {
  if (progress == null) return { angle: 0, lift: 0 };
  const t = progress * STAFF_CAST_VISUAL_SECONDS;
  if (t < 1) { const u = Math.sin(Math.min(1, t / .35) * Math.PI / 2); return { angle: -.35 * u, lift: -6 * u }; }
  if (t < 1.3) { const u = ((t - 1) / .3) ** 2; return { angle: -.35 + .45 * u, lift: -6 + 10 * u }; }
  const u = Math.min(1, (t - 1.3) / .3);
  return { angle: .1 * (1 - u), lift: 4 * (1 - u) };
}

function staffColor(id: string): string {
  const token = id === "bronze" ? "fire" : id === "waters" ? "water" : id === "crystal" || id === "fire" ? "ice"
    : id === "bush" ? "sand" : id === "iron" ? "iron" : id === "moses" ? "wood-light" : "light";
  return getComputedStyle(document.documentElement).getPropertyValue(`--equip-${token}`).trim();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number, sy = 1) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, color); g.addColorStop(1, "transparent");
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Soft light at the staff head while charging and on the ground at the slam. */
let staffCrown: { x: number; y: number } | null = null;
/** Set by the Moses renderer each frame: where the staff's top orb was drawn. */
export function setStaffCrownPoint(p: { x: number; y: number } | null): void { staffCrown = p; }
export function lastStaffCrownPoint(): { x: number; y: number } | null { return staffCrown; }

export function drawEquipmentPower(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number, flip: number): void {
  const lo = state.loadout;
  if (!lo || lo.staff.id === "none") return;
  const p = latestEquipmentCastProgress(state);
  if (p === null) return;
  const t = p * STAFF_CAST_VISUAL_SECONDS;
  const color = staffColor(lo.staff.id);
  const sx = x - 14 * flip;
  // The charge light sits on the staff's top orb and follows it through the cast.
  const crown = lastStaffCrownPoint() ?? { x: sx, y: y - 92 - (t < 1 ? 14 : 0) };
  if (t < 1.3) glow(ctx, crown.x, crown.y, 10 + 14 * Math.min(1, t), color, .55 + .25 * Math.sin(t * 18));
  if (t >= 1.25) { const u = (t - 1.25) / .35; glow(ctx, sx, y, 30 + 50 * u, color, .9 * (1 - u), .45); }
}

/** Visuals for staff special entities. */
export function drawStaffSpecial(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, x: number, y: number): void {
  const d = e.data ?? {};
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(`--equip-${n}`).trim();
  if (e.kind === "staffburst") {
    const ttl0 = Number(d.ttl0 ?? 0.6);
    const u = 1 - Math.max(0, Math.min(1, (e.ttl ?? 0) / ttl0));
    const r = Number(d.r ?? 100) * (.25 + .75 * u);
    const col = v(String(d.color ?? "light"));
    glow(ctx, x, y, r, col, .5 * (1 - u), .55);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .55);
    ctx.strokeStyle = col; ctx.globalAlpha = .8 * (1 - u); ctx.lineWidth = d.wind ? 3 : 5;
    if (d.wind) {
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + u * 2; ctx.beginPath(); ctx.arc(0, 0, r, a, a + .6); ctx.stroke(); }
    } else { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
    if (d.rays) {
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .3, Math.sin(a) * r * .3); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
    }
    ctx.restore();
  } else if (e.kind === "staffring") {
    // Crystal / Diamond rings: grow out from Moses while turning, then fade.
    const ttl0 = Number(d.ttl0 ?? 1), age = Math.min(1, (s.now - e.born) / ttl0);
    const grow = 1 - (1 - Math.min(1, age / .35)) ** 3;
    const fade = Math.min(1, (1 - age) / .35);
    const cx = d.follow ? s.player.pos.x - (e.pos.x - x) : x, cy = d.follow ? s.player.pos.y - (e.pos.y - y) : y;
    drawStaffRing(ctx, String(d.art ?? "crystal"), cx, cy, Number(d.r ?? 100) * (.25 + .75 * grow), (s.now - e.born) * 2.4, fade);
  } else if (e.kind === "stafftornado") {
    // Wind Staff: a small tornado twisting around Moses.
    const img = fxImage(tornadoUrl);
    if (!img) return;
    const ttl0 = Number(d.ttl0 ?? 1.1), age = Math.min(1, (s.now - e.born) / ttl0);
    const alpha = Math.min(1, age / .15, (1 - age) / .3) * STAFF_ART_ALPHA * .9;
    const h = 96 + 10 * (Number(d.evo ?? 1) - 1), w = h * img.naturalWidth / img.naturalHeight;
    const t = s.now - e.born;
    ctx.save(); ctx.translate(x, y + 4); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    // Slice the art into horizontal strips that sway out of phase, so it spins and writhes.
    const strips = 16, sh = img.naturalHeight / strips, dh = h / strips;
    for (let i = 0; i < strips; i++) {
      const k = 1 - i / strips; // 1 at the top, 0 at the base
      const sway = Math.sin(t * 9 - i * .55) * 5 * k + Math.sin(t * 3.1) * 3 * k;
      const squeeze = 1 + .06 * Math.sin(t * 14 - i * .8);
      ctx.drawImage(img, 0, i * sh, img.naturalWidth, sh, -w * squeeze / 2 + sway, -h + i * dh, w * squeeze, dh + .6);
    }
    ctx.restore();
  } else if (e.kind === "staffwave") {
    // Primordial Waters: the wave faces its travel direction, rising in and sinking away.
    const img = fxImage(waveUrl);
    if (!img) return;
    const ttl0 = Number(d.ttl0 ?? 1.2), age = Math.min(1, (s.now - e.born) / ttl0);
    const vx = Number(d.vx ?? 1), vy = Number(d.vy ?? 0);
    const left = vx < 0;
    // Top-down travel can't be drawn as a side wave, so tilt it at most 35 degrees.
    const tilt = Math.max(-.6, Math.min(.6, Math.atan2(vy, Math.abs(vx))));
    const rise = Math.min(1, age / .2), sink = Math.min(1, (1 - age) / .25);
    const w = 96 * Number(d.sc ?? 1), h = w * img.naturalHeight / img.naturalWidth;
    ctx.save(); ctx.translate(x, y + 6); if (left) ctx.scale(-1, 1); ctx.rotate(tilt);
    ctx.scale(1, .55 + .45 * rise);
    ctx.globalAlpha = STAFF_ART_ALPHA * Math.min(rise, sink); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -w * .55, -h * .9, w, h);
    ctx.restore();
  } else if (e.kind === "stafflight") {
    // Divine Light: a blinding beam pours down on the foe.
    const img = fxImage(lightBeamUrl);
    if (!img) return;
    const ttl0 = Number(d.ttl0 ?? 1.2), age = Math.min(1, (s.now - e.born) / ttl0);
    const alpha = Math.min(1, age / .15, (1 - age) / .4) * STAFF_ART_ALPHA * (.85 + .15 * Math.sin(s.now * 20));
    const h = 110, w = h * img.naturalWidth / img.naturalHeight;
    ctx.save(); ctx.translate(x, y + 4); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  } else if (e.kind === "waterorbit") {
    const r = Number(d.r ?? 80);
    const fade = Math.min(1, (e.ttl ?? 0) / .4, (s.now - e.born) / .3);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .55); ctx.lineCap = "round";
    const rot = s.now * 4;
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2;
      ctx.globalAlpha = .35 * fade; ctx.strokeStyle = v("water"); ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(0, 0, r, a, a + 1.1); ctx.stroke();
      ctx.globalAlpha = .85 * fade; ctx.lineWidth = 5; ctx.stroke();
      ctx.globalAlpha = .9 * fade; ctx.strokeStyle = v("ice"); ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  } else if (e.kind === "godhand") {
    const impactAt = Number(d.impactAt ?? e.born);
    const r = Number(d.r ?? 110);
    const fall = Math.min(1, (s.now - e.born) / Math.max(.01, impactAt - e.born));
    const after = Math.max(0, s.now - impactAt);
    const img = handImage();
    const w = r * 1.3, h = w * 4 / 3;
    if (img) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, fall * 2) * (1 - Math.min(1, after / .6));
      ctx.drawImage(img, x - w / 2, y - h * .9 - (1 - fall * fall) * 260, w, h);
      ctx.restore();
    }
    if (after > 0) {
      const u = Math.min(1, after / .6);
      glow(ctx, x, y, r * (.5 + u), v("light"), .9 * (1 - u), .45);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .45);
      ctx.strokeStyle = v("light"); ctx.globalAlpha = 1 - u; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, r * (.4 + .8 * u), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}

let hand: HTMLImageElement | null = null;
function handImage(): HTMLImageElement | null {
  if (!hand) { hand = new Image(); hand.src = godHandUrl; }
  return hand.complete && hand.naturalWidth ? hand : null;
}
