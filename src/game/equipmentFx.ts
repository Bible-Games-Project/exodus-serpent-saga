import type { Entity, GameState } from "./types";
import godFistUrl from "@/assets/staff-god-fist.png";
import godCrackUrl from "@/assets/staff-god-crack.png";
import ringCrystalUrl from "@/assets/combat-staff-ring-crystal.png";
import ringFireUrl from "@/assets/combat-staff-ring-fire.png";
import tornadoUrl from "@/assets/combat-staff-tornado.png";
import waveUrl from "@/assets/combat-staff-wave.png";
import lightBeamUrl from "@/assets/combat-staff-light-beam.png";
import shardUrl from "@/assets/combat-staff-diamond-shard.png";
import { LIGHT_BEAM_ASPECT } from "./weapons";

const fxImages = new Map<string, HTMLImageElement>();
function fxImage(url: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = fxImages.get(url);
  if (!img) { img = new Image(); img.src = url; fxImages.set(url, img); }
  return img.complete && img.naturalWidth ? img : null;
}
const RING_ART: Record<string, string> = { crystal: ringCrystalUrl, fire: ringFireUrl };
/** Supplied staff effect art is drawn see-through, as asked. */
const STAFF_ART_ALPHA = .78;

/** The art recoloured to `color` (keeping its light and shade), cached per colour. */
const tintedImages = new Map<string, HTMLCanvasElement>();
function tinted(img: HTMLImageElement, color: string): HTMLCanvasElement | HTMLImageElement {
  const key = img.src + "|" + color;
  let c = tintedImages.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d");
  if (!g) return img;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "color"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-in"; g.drawImage(img, 0, 0);
  tintedImages.set(key, c);
  return c;
}

/** A supplied ring lying on the ground, slowly turning. `r` is its outer radius. */
export function drawStaffRing(ctx: CanvasRenderingContext2D, art: string, x: number, y: number, r: number, angle: number, alpha: number, tint?: string): boolean {
  const raw = fxImage(RING_ART[art] ?? ringCrystalUrl);
  if (!raw || r <= 0 || alpha <= 0) return !!raw;
  const img = tint ? tinted(raw, tint) : raw;
  const iw = raw.naturalWidth, ih = raw.naturalHeight;
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, .55); ctx.rotate(angle);
  ctx.globalAlpha = alpha * STAFF_ART_ALPHA; ctx.imageSmoothingEnabled = true;
  const w = r * 2, h = w * ih / iw;
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
    // Crystal ring: grows out from Moses (on the ground, under him) while turning, then fades.
    const ttl0 = Number(d.ttl0 ?? 1), age = Math.min(1, (s.now - e.born) / ttl0);
    const grow = 1 - (1 - Math.min(1, age / .35)) ** 3;
    const fade = Math.min(1, (1 - age) / .35);
    const cx = d.follow ? s.player.pos.x - (e.pos.x - x) : x, cy = d.follow ? s.player.pos.y - (e.pos.y - y) : y;
    drawStaffRing(ctx, String(d.art ?? "crystal"), cx, cy, Number(d.r ?? 100) * (.25 + .75 * grow), (s.now - e.born) * 2.4, fade, d.tint ? v(String(d.tint)) : undefined);
  } else if (e.kind === "stafftornado") {
    // Wind Staff: a tornado twisting around Moses, drawn in front of him.
    const img = fxImage(tornadoUrl);
    if (!img) return;
    const ttl0 = Number(d.ttl0 ?? 1.1), age = Math.min(1, (s.now - e.born) / ttl0);
    const alpha = Math.min(1, age / .15, (1 - age) / .3) * STAFF_ART_ALPHA * .9;
    const h = 2 * (96 + 10 * (Number(d.evo ?? 1) - 1)), w = h * img.naturalWidth / img.naturalHeight;
    const t = s.now - e.born;
    ctx.save(); ctx.translate(x, y + 3); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    // Slice the art into horizontal strips that sway out of phase, so it spins and writhes.
    const strips = 16, sh = img.naturalHeight / strips, dh = h / strips;
    for (let i = 0; i < strips; i++) {
      const k = 1 - i / strips; // 1 at the top, 0 at the base
      const sway = Math.sin(t * 9 - i * .55) * 10 * k + Math.sin(t * 3.1) * 6 * k;
      const squeeze = 1 + .06 * Math.sin(t * 14 - i * .8);
      ctx.drawImage(img, 0, i * sh, img.naturalWidth, sh, -w * squeeze / 2 + sway, -h + i * dh, w * squeeze, dh + .6);
    }
    ctx.restore();
  } else if (e.kind === "staffwave") {
    // Primordial Waters: the wave is turned to point exactly where it travels (its curl
    // leads), mirrored rather than upside down when heading left. See-through.
    const img = fxImage(waveUrl);
    if (!img) return;
    const ttl0 = Number(d.ttl0 ?? 1.2), age = Math.min(1, (s.now - e.born) / ttl0);
    const vx = Number(d.vx ?? 1), vy = Number(d.vy ?? 0);
    const rise = Math.min(1, age / .2), sink = Math.min(1, (1 - age) / .25);
    const w = 192 * Number(d.sc ?? 1), h = w * img.naturalHeight / img.naturalWidth;
    ctx.save(); ctx.translate(x, y - 10); ctx.rotate(Math.atan2(vy, vx)); if (vx < 0) ctx.scale(1, -1);
    ctx.scale(.7 + .3 * rise, .55 + .45 * rise);
    ctx.globalAlpha = .62 * Math.min(rise, sink); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -w * .5, -h * .55, w, h);
    ctx.restore();
  } else if (e.kind === "stafflight") {
    // Divine Light: one great beam pours down; its cone (and the pool of light at its
    // foot) is exactly the area that blinds (see inLightCone in weapons.ts).
    const img = fxImage(lightBeamUrl);
    if (!img) return;
    const ttl0 = Number(d.ttl0 ?? 1.6), age = Math.min(1, (s.now - e.born) / ttl0);
    const fade = Math.min(1, age / .12, (1 - age) / .35);
    const h = Number(d.h ?? 260), w = h * LIGHT_BEAM_ASPECT, foot = w * .5 * .45;
    glow(ctx, x, y, w * .55, v("light"), .55 * fade, .45);
    ctx.save(); ctx.translate(x, y + foot); ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = fade * STAFF_ART_ALPHA * (.88 + .12 * Math.sin(s.now * 20));
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  } else if (e.kind === "staffshard") {
    // Diamond Staff: a crystal shard spinning slightly as it flies, at body height.
    const img = fxImage(shardUrl);
    if (!img) return;
    const len = 30, hh = len * img.naturalHeight / img.naturalWidth;
    ctx.save(); ctx.translate(x, y - 16); ctx.rotate(Math.atan2(Number(d.vy ?? 0), Number(d.vx ?? 1)));
    ctx.globalAlpha = Math.min(1, (e.ttl ?? 0) / .12, (s.now - e.born) / .06); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -len / 2, -hh / 2, len, hh);
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
    // Ground crack appears the instant the knuckles land, then fades away.
    const crack = fxImage(godCrackUrl);
    if (crack && after > 0) {
      const left = Math.max(0, e.ttl ?? 0);
      const pop = .85 + .15 * Math.min(1, after / .1);
      const w = r * 2.4 * pop, h = w * crack.naturalHeight / crack.naturalWidth;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = STAFF_ART_ALPHA * Math.min(1, left / .5);
      ctx.drawImage(crack, x - w / 2, y - h / 2, w, h);
      ctx.restore();
    }
    // The fist art is pre-rotated so all four knuckles meet the ground together.
    const img = fxImage(godFistUrl);
    if (img) {
      const w = r * 1.3, h = w * img.naturalHeight / img.naturalWidth;
      const rise = Math.max(0, after - .2) / .4; // rests on the ground briefly, then lifts away
      // It drops in from above the top of the screen, accelerating down onto the spot.
      const drop = y + 4 + h * .015 + 20;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = STAFF_ART_ALPHA * (1 - Math.min(1, rise));
      ctx.drawImage(img, x - w / 2, y + 4 - h * .985 - (1 - fall * fall) * drop - Math.min(1, rise) * 30, w, h);
      ctx.restore();
    }
    if (after > 0 && after < .6) {
      const u = Math.min(1, after / .6);
      glow(ctx, x, y, r * (.5 + u), v("light"), .9 * (1 - u), .45);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .45);
      ctx.strokeStyle = v("light"); ctx.globalAlpha = 1 - u; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, r * (.4 + .8 * u), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}

