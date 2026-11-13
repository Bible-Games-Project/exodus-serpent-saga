// Lightweight pixel-art visuals for shop champion abilities (championAbilities.ts).
import type { Entity, GameState } from "./types";
import { isChampionFxKind, PUAH_RING_HALF_W, STONE_FADE } from "./championAbilities";
import smokeRingUrl from "@/assets/champion-miriam-smoke-ring.png";
import tornadoUrl from "@/assets/champion-miriam-tornado.png";
import puahRingUrl from "@/assets/champion-puah-heal-ring.png";
import puahVialUrl from "@/assets/champion-puah-vial.png";
import puahSplashUrl from "@/assets/champion-puah-splash.png";
import shiphrahVialUrl from "@/assets/champion-shiphrah-vial.png";
import shiphrahSplashUrl from "@/assets/champion-shiphrah-splash.png";

const images = new Map<string, HTMLImageElement>();
function art(url: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = images.get(url);
  if (!img) { img = new Image(); img.src = url; images.set(url, img); }
  return img.complete && img.naturalWidth ? img : null;
}
/** Shades of Miriam's tornado art, used for its swirling streaks and motes. */
/** Shades of Puah's healing art (the greens and pale crosses of her ring, vial and splash). */
const PUAH_TINT = ["#2fa82a", "#78e758", "#c6f78e", "#f6fbc8"];
const TORNADO_TINT = ["#a39591", "#d4c8bf", "#f5ece2"];

const COLORS: Record<string, [string, string]> = {
  fire: ["#ff8a2a", "#ffd36a"],
  crack: ["#7a5a32", "#c9a46a"],
  vial: ["#7fdc6a", "#d8ffb8"],
  heal: ["#5fe08a", "#d6ffe0"],
  convert: ["#b58cff", "#efe0ff"],
  water: ["#5fa8d8", "#c8ecff"],
  whirl: ["#d8c294", "#f3e6c4"],
};

const PROJ_ART: Record<string, [string, string, number, number]> = {
  stone: ["#8f8b80", "#5b5850", 6, 6],
  arrow: ["#d8c294", "#6b4a2a", 14, 3],
  firearrow: ["#ffb347", "#ff6a1a", 14, 3],
  spear: ["#c9c2b0", "#6b4a2a", 20, 3],
  espear: ["#bfe8ff", "#4aa8ff", 20, 3],
  vial: ["#7fdc6a", "#3b6a2a", 7, 9],
  heal: ["#5fe08a", "#ffffff", 7, 9],
  fireball: ["#ffd36a", "#ff6a1a", 10, 10],
  flame: ["#ffd36a", "#ff6a1a", 10, 8],
  flameline: ["#ffd36a", "#ff6a1a", 16, 6],
  pyramid: ["#e0c07a", "#8a6a3a", 14, 12],
};

/** Champion visuals that lie on the ground, drawn behind every character
 *  (Puah's vial splash and her healing ring). */
export function isGroundChampionFx(e: Entity): boolean {
  return (e.kind === "chaoe" && !!e.data?.splash) || (e.kind === "chzone" && !!e.data?.puahRing);
}

/** Returns true when the entity is a champion ability visual and was drawn. */
export function drawChampionFx(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState): boolean {
  if (!isChampionFxKind(e.kind)) return false;
  const d = e.data ?? {};
  const x = Math.round(e.pos.x - camX), y = Math.round(e.pos.y - camY);
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / ((d.maxTtl as number) || 1)));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  switch (e.kind) {
    case "chproj": {
      const projArt = PROJ_ART[(d.art as string) ?? "stone"] ?? PROJ_ART.stone;
      const [a, b, w, hgt] = projArt;
      const lift = (d.lift as number) ?? 0;
      // Zipporah's stones fade out at the end instead of vanishing.
      if (d.art === "stone" && d.liftEnd != null) ctx.globalAlpha = Math.min(1, (e.ttl ?? 0) / STONE_FADE);
      // Straight throws (liftEnd) glide evenly from the hand to body height, so they fly in a straight line.
      ctx.translate(x, y - (d.liftEnd != null ? (d.liftEnd as number) + (lift - (d.liftEnd as number)) * (1 - ((d.prog as number) ?? 1 - life)) : lift * Math.max(0, 1 - (1 - life) * 3)));
      if (d.art === "arrow" || d.art === "firearrow" || d.art === "spear" || d.art === "espear" || d.art === "flameline") {
        ctx.rotate(Math.atan2((d.vy as number) ?? 0, (d.vx as number) ?? 1));
      }
      if (d.art === "heal" || d.art === "vial") {
        // Puah's / Shiphrah's vial: their supplied art, tumbling a little, bigger at each level.
        const img = art(d.art === "heal" ? puahVialUrl : shiphrahVialUrl);
        if (img) {
          const vh = 20 * ((d.size as number) ?? 1), vw = vh * img.naturalWidth / img.naturalHeight;
          ctx.imageSmoothingEnabled = true;
          ctx.rotate(Math.sin(e.animT * 9) * 0.45);
          ctx.drawImage(img, -vw / 2, -vh / 2, vw, vh);
          break;
        }
      }
      if (d.art === "pyramid") {
        ctx.fillStyle = b;
        ctx.beginPath(); ctx.moveTo(-w / 2, hgt / 2); ctx.lineTo(w / 2, hgt / 2); ctx.lineTo(0, -hgt / 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = a; ctx.fillRect(-2, -hgt / 2 + 3, 4, hgt - 4);
      } else if (d.art === "stone") {
        ctx.rotate(e.animT * 8);
        ctx.fillStyle = b; ctx.fillRect(-4, -2, 8, 5); ctx.fillRect(-2, -4, 5, 8);
        ctx.fillStyle = a; ctx.fillRect(-2, -2, 5, 4);
      } else {
        ctx.fillStyle = b; ctx.fillRect(-w / 2 - 1, -hgt / 2 - 1, w + 2, hgt + 2);
        ctx.fillStyle = a; ctx.fillRect(-w / 2, -hgt / 2, w, hgt);
      }
      break;
    }
    case "chzone": {
      if (d.tornado) { drawMiriamTornado(ctx, x, y, e, s, life); break; }
      if (d.puahRing) { drawPuahRing(ctx, x, y, e, s, life); break; }
      const [a, b] = COLORS[(d.color as string) ?? "fire"] ?? COLORS.fire;
      const r = d.r as number;
      ctx.globalAlpha = 0.25 + 0.25 * Math.min(1, life * 3);
      ctx.fillStyle = a;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8 * Math.min(1, life * 3);
      ctx.fillStyle = b;
      const n = 10;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + s.now * (d.color === "whirl" ? 6 : 1.5);
        ctx.fillRect(Math.round(x + Math.cos(ang) * r * 0.9) - 2, Math.round(y + Math.sin(ang) * r * 0.45) - 4, 4, 6);
      }
      break;
    }
    case "chbeam": {
      const a = d.angle as number, len = d.len as number;
      ctx.translate(x, y); ctx.rotate(a);
      ctx.globalAlpha = 0.45 * Math.min(1, life * 4);
      ctx.fillStyle = "#fff3b0"; ctx.fillRect(0, -(d.w as number) / 2, len, d.w as number);
      ctx.globalAlpha = 0.9 * Math.min(1, life * 4);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, -2, len, 4);
      break;
    }
    case "chaoe": {
      if (d.splash === "shiphrah") { drawShiphrahSplash(ctx, x, y, e, life); break; }
      if (d.splash) { drawPuahSplash(ctx, x, y, e, life); break; }
      const [a, b] = COLORS[(d.color as string) ?? "fire"] ?? COLORS.fire;
      const r = (d.r as number) * (0.4 + 0.6 * (1 - life));
      ctx.globalAlpha = life;
      ctx.strokeStyle = a; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = b; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "chbolt": {
      const pts = (d.pts as Array<{ x: number; y: number }>) ?? [];
      ctx.globalAlpha = life;
      ctx.strokeStyle = "#bfe8ff"; ctx.lineWidth = 3;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const px = p.x - camX, py = p.y - camY - 16;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
      break;
    }
    case "chward": {
      const pulse = 0.5 + 0.2 * Math.sin(s.now * 6);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y - 26, 34, 42, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#3a2a10"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
      ctx.fillText(String(d.hits ?? ""), x, y - 72);
      break;
    }
    case "chbird": {
      if (d.hidden) break;
      const f = (d.face as number) === -1 ? -1 : 1;
      ctx.fillStyle = "#f2efe6";
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = "#cfc8b4";
      if (d.diving) {
        // Diving at a foe: wings swept back.
        ctx.fillRect(x - f * 5 - 2, y - 3, 4, 2); ctx.fillRect(x - f * 5 - 2, y + 1, 4, 2);
      } else if (Math.sin(s.now * 18 + (d.idx as number)) > 0) { ctx.fillRect(x - 6, y - 4, 4, 2); ctx.fillRect(x + 2, y - 4, 4, 2); }
      else { ctx.fillRect(x - 6, y, 4, 2); ctx.fillRect(x + 2, y, 4, 2); }
      ctx.fillStyle = "#e0a030"; ctx.fillRect(f > 0 ? x + 2 : x - 4, y - 1, 2, 2);
      break;
    }
    case "chpeck": {
      // A peck: a few feathers bursting from the struck foe.
      ctx.globalAlpha = life;
      const k = 1 - life, seed = (d.seed as number) ?? 0;
      for (let i = 0; i < 5; i++) {
        const a = seed + i * 1.26;
        ctx.fillStyle = i % 2 ? "#cfc8b4" : "#f2efe6";
        ctx.fillRect(Math.round(x + Math.cos(a) * 14 * k) - 1, Math.round(y - 16 + Math.sin(a) * 8 * k + k * 6) - 1, 3, 2);
      }
      break;
    }
  }
  ctx.restore();
  return true;
}

/** Miriam's tornado: a smoke ring spinning flat on the ground as its base, the
 *  tornado art writhing above it, and streaks and motes in the tornado's colours. */
function drawMiriamTornado(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, s: GameState, life: number): void {
  const d = e.data ?? {};
  const maxTtl = (d.maxTtl as number) || 2.5;
  const age = (1 - life) * maxTtl, left = life * maxTtl;
  const fade = Math.max(0, Math.min(1, age / .25, left / .45));
  const grow = 1 - (1 - Math.min(1, age / .3)) ** 3;
  const t = s.now + ((d.seed as number) ?? 0);
  const R = ((d.r as number) ?? 42) * 1.15; // ring radius on screen
  ctx.imageSmoothingEnabled = true;
  ctx.translate(x, y);

  // Ground: soft shadow, then the ring turning around its centre (seen in perspective).
  ctx.globalAlpha = .22 * fade;
  ctx.fillStyle = "#3a3632";
  ctx.beginPath(); ctx.ellipse(0, 0, R * .9 * grow, R * .4 * grow, 0, 0, Math.PI * 2); ctx.fill();
  const ring = art(smokeRingUrl);
  if (ring) {
    ctx.save();
    ctx.scale(1, .5);
    ctx.rotate(t * 3.2);
    ctx.globalAlpha = .62 * fade;
    const rw = R * 2 * grow, rh = rw * ring.naturalHeight / ring.naturalWidth;
    ctx.drawImage(ring, -rw / 2, -rh / 2, rw, rh);
    ctx.restore();
  }

  const H = 118 * grow; // tornado height
  const B = H * .075; // the dust at the tornado's foot sits right on the ring's centre
  // Motes spiralling up around the funnel: the far half first, behind it.
  const motes = 14;
  const mote = (front: boolean) => {
    for (let i = 0; i < motes; i++) {
      const k = ((t * .55 + i / motes) % 1); // 0 at the base, 1 at the top
      const ang = t * 7 + i * 2.4 + k * 5;
      if ((Math.sin(ang) > 0) !== front) continue;
      const rad = (R * .45 + k * R * .55) * grow;
      const mx = Math.cos(ang) * rad + Math.sin(t * 9 - k * 5) * 8 * k;
      const my = Math.sin(ang) * rad * .35 + B * (1 - k) - k * H;
      ctx.globalAlpha = fade * (front ? .85 : .45) * Math.sin(k * Math.PI);
      ctx.fillStyle = TORNADO_TINT[i % 3];
      const sz = front ? 3 + (i % 2) : 2;
      ctx.fillRect(Math.round(mx - sz / 2), Math.round(my - sz / 2), sz, sz);
    }
  };
  // Wind streaks: short arcs whipping around the funnel at a few heights.
  const streaks = (front: boolean) => {
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const k = .12 + i * .19;
      const rad = (R * .5 + k * R * .6) * grow;
      const a0 = t * (9 - i) + i * 1.7;
      const from = front ? a0 % (Math.PI * 2) : a0 % (Math.PI * 2) + Math.PI;
      const cy = B * (1 - k) - k * H, sway = Math.sin(t * 9 - k * 5) * 10 * k;
      ctx.globalAlpha = fade * (front ? .55 : .25);
      ctx.strokeStyle = TORNADO_TINT[front ? 2 : 0];
      ctx.lineWidth = front ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.ellipse(sway, cy, rad, rad * .3, 0, from, from + 1.4);
      ctx.stroke();
    }
  };
  streaks(false);
  mote(false);

  // The tornado, sliced into strips that sway out of phase so it twists and writhes.
  const img = art(tornadoUrl);
  if (img) {
    const w = H * img.naturalWidth / img.naturalHeight;
    const strips = 14, sh = img.naturalHeight / strips, dh = H / strips;
    ctx.globalAlpha = .85 * fade;
    for (let i = 0; i < strips; i++) {
      const k = 1 - i / strips; // 1 at the top, 0 at the base
      const sway = Math.sin(t * 9 - i * .55) * 9 * k + Math.sin(t * 3.1) * 5 * k;
      const squeeze = 1 + .07 * Math.sin(t * 14 - i * .8);
      ctx.drawImage(img, 0, i * sh, img.naturalWidth, sh, -w * squeeze / 2 + sway, B - H + i * dh, w * squeeze, dh + .6);
    }
  }

  streaks(true);
  mote(true);
  // Dust kicked up at the base.
  for (let i = 0; i < 6; i++) {
    const k = (t * 1.3 + i / 6) % 1;
    const ang = i * 1.05 + t * 4;
    ctx.globalAlpha = fade * .5 * (1 - k);
    ctx.fillStyle = TORNADO_TINT[1];
    const rr = 4 + k * 7;
    ctx.beginPath();
    ctx.ellipse(Math.cos(ang) * R * (.6 + k * .5) * grow, Math.sin(ang) * R * .3 * grow + B * .6 - k * 10, rr, rr * .6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** How see-through the vial splashes are at most (1 = solid). */
const SPLASH_ALPHA = 0.7;
/** Shades of Shiphrah's blue splash art, deep to bright. */
const SHIPHRAH_TINT = ["#1f4fe0", "#2f9bff", "#7fd8ff", "#e8f8ff"];

/** Shiphrah's blast: her supplied splash art opening on the ground over the whole
 *  reach, half see-through, with a bright copy shimmering over it, ripples
 *  running out, drops flying and bubbles rising in its blues. */
function drawShiphrahSplash(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, life: number): void {
  const d = e.data ?? {};
  const r = (d.r as number) ?? 55;
  const seed = (d.seed as number) ?? 0;
  const k = 1 - life;
  const fade = Math.min(1, life * 2.2);
  ctx.imageSmoothingEnabled = true;
  ctx.translate(x, y);
  const img = art(shiphrahSplashUrl);
  const open = 0.5 + 0.5 * (1 - (1 - Math.min(1, k * 3)) ** 3);
  if (img) {
    const sw = r * 2.2 * open, sh = sw * img.naturalHeight / img.naturalWidth;
    ctx.globalAlpha = fade * SPLASH_ALPHA;
    ctx.save(); ctx.rotate(Math.sin(seed) * 0.3 + k * 0.35);
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    // A brighter copy shimmering and turning the other way.
    ctx.globalCompositeOperation = "lighter";
    ctx.rotate(-k * 0.7);
    ctx.globalAlpha = fade * 0.22 * (0.5 + 0.5 * Math.sin(k * 18));
    ctx.drawImage(img, -sw * 0.47, -sh * 0.47, sw * 0.94, sh * 0.94);
    ctx.restore();
  }
  // Ripples running out over the ground.
  for (let i = 0; i < 2; i++) {
    const p = Math.min(1, k * 1.6 - i * 0.3);
    if (p <= 0) continue;
    ctx.globalAlpha = (1 - p) * 0.8 * fade;
    ctx.strokeStyle = SHIPHRAH_TINT[i ? 2 : 1]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * (0.4 + 0.75 * p), r * (0.3 + 0.55 * p), 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Drops flying out and falling back.
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 + seed;
    const dist = r * (0.4 + 0.8 * k);
    ctx.globalAlpha = Math.max(0, life * 1.4 - 0.2);
    ctx.fillStyle = SHIPHRAH_TINT[i % 2 ? 1 : 3];
    ctx.beginPath(); ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist * 0.8 - Math.sin(k * Math.PI) * 10, (i % 2 ? 2.4 : 1.7) * Math.sqrt(r / 55), 0, Math.PI * 2); ctx.fill();
  }
  // Bubbles rising from the puddle, with a bright spot.
  for (let i = 0; i < 8; i++) {
    const p = (k * 1.3 + i / 8) % 1;
    const a = seed * 3 + i * 2.4;
    const bx = Math.cos(a) * r * 0.55 * ((i * 7) % 5 + 1) / 5 + Math.sin(k * 9 + i) * 3, by = Math.sin(a) * r * 0.35 - p * 26;
    const br = (1.5 + (i % 3)) * Math.sqrt(r / 55);
    ctx.globalAlpha = fade * Math.sin(p * Math.PI) * 0.9;
    ctx.strokeStyle = SHIPHRAH_TINT[2]; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = SHIPHRAH_TINT[3]; ctx.fillRect(Math.round(bx - br * 0.4), Math.round(by - br * 0.4), 1, 1);
  }
}

/** Puah's vial splash: her supplied splash art bursting open and fading, with drops flying out. */
function drawPuahSplash(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, life: number): void {
  const d = e.data ?? {};
  const r = (d.r as number) ?? 26;
  const k = 1 - life;
  ctx.imageSmoothingEnabled = true;
  ctx.translate(x, y - 14);
  const img = art(puahSplashUrl);
  if (img) {
    const sw = r * 2.4 * (0.45 + 0.65 * (1 - (1 - Math.min(1, k * 2.5)) ** 3)), sh = sw * img.naturalHeight / img.naturalWidth;
    ctx.globalAlpha = Math.min(1, life * 2) * SPLASH_ALPHA;
    ctx.rotate(((d.seed as number) ?? 0) + k * 0.8);
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    ctx.rotate(-(((d.seed as number) ?? 0) + k * 0.8));
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + ((d.seed as number) ?? 0);
    const dist = r * (0.5 + 1.1 * k);
    ctx.globalAlpha = Math.max(0, life * 1.4 - 0.2);
    ctx.fillStyle = PUAH_TINT[i % 2 ? 1 : 3];
    ctx.beginPath(); ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist * 0.6 + k * k * 10, (i % 2 ? 2.2 : 1.6) * (r / 26), 0, Math.PI * 2); ctx.fill();
  }
}

/** Puah's healing area: her supplied ring exactly as drawn, breathing, with waves of
 *  light rippling out of it, a soft glow, twinkles and crosses rising in the ring's greens. */
function drawPuahRing(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, s: GameState, life: number): void {
  const d = e.data ?? {};
  const maxTtl = (d.maxTtl as number) || 10;
  const age = (1 - life) * maxTtl, left = life * maxTtl;
  const fade = Math.max(0, Math.min(1, age / .4, left / .6));
  const grow = 1 - (1 - Math.min(1, age / .45)) ** 3;
  const t = s.now + ((d.seed as number) ?? 0);
  const R = ((d.r as number) ?? 80) * 1.1 * grow * (1 + .03 * Math.sin(t * 3));
  ctx.imageSmoothingEnabled = true;
  ctx.translate(x, y);
  const ring = art(puahRingUrl);
  const rw = (R / 1.1) * PUAH_RING_HALF_W * 2, rh = ring ? rw * ring.naturalHeight / ring.naturalWidth : rw / 1.5;
  // Middle of the ring band, for the effects that run along it.
  const ex = rw * .4, ey = rh * .39;

  // Soft green glow filling the area, breathing.
  ctx.globalAlpha = fade * (.22 + .08 * Math.sin(t * 2.4));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ex);
  g.addColorStop(0, PUAH_TINT[2]); g.addColorStop(.7, PUAH_TINT[1]); g.addColorStop(1, "rgba(120,231,88,0)");
  ctx.save(); ctx.scale(1, ey / ex); ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, ex, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  if (ring) {
    ctx.globalAlpha = fade;
    ctx.drawImage(ring, -rw / 2, -rh / 2, rw, rh);
    // Two waves of light leaving the ring outwards, one after the other.
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 2; i++) {
      const k = (t * .55 + i * .5) % 1;
      const sc = 1 + k * .18;
      ctx.globalAlpha = fade * .32 * Math.sin(k * Math.PI);
      ctx.drawImage(ring, -rw * sc / 2, -rh * sc / 2, rw * sc, rh * sc);
    }
    // The ring itself shimmers.
    ctx.globalAlpha = fade * .18 * (.5 + .5 * Math.sin(t * 3.3));
    ctx.drawImage(ring, -rw / 2, -rh / 2, rw, rh);
    ctx.globalCompositeOperation = "source-over";
  }

  // Twinkles running around the ring band.
  for (let i = 0; i < 10; i++) {
    const a = t * .7 + i * Math.PI / 5;
    const tw = Math.max(0, Math.sin(t * 5 + i * 1.9));
    ctx.globalAlpha = fade * tw;
    ctx.fillStyle = PUAH_TINT[3];
    const px = Math.cos(a) * ex, py = Math.sin(a) * ey;
    ctx.fillRect(Math.round(px) - 1, Math.round(py) - 3, 2, 6);
    ctx.fillRect(Math.round(px) - 3, Math.round(py) - 1, 6, 2);
  }
  // Crosses and motes rising from the area and fading as they go.
  for (let i = 0; i < 14; i++) {
    const k = (t * .35 + i / 14) % 1;
    const a = i * 2.39 + Math.floor(t * .35 + i / 14) * 1.3;
    const rr = .25 + .75 * ((i * 37) % 10) / 10;
    const px = Math.cos(a) * ex * rr + Math.sin(t * 2 + i) * 4, py = Math.sin(a) * ey * rr - k * 60;
    ctx.globalAlpha = fade * Math.sin(k * Math.PI) * .95;
    if (i % 3 === 0) {
      // A small plus outlined in green, like the ones on the ring.
      ctx.fillStyle = PUAH_TINT[0];
      ctx.fillRect(Math.round(px) - 4, Math.round(py) - 2, 8, 4); ctx.fillRect(Math.round(px) - 2, Math.round(py) - 4, 4, 8);
      ctx.fillStyle = PUAH_TINT[3];
      ctx.fillRect(Math.round(px) - 3, Math.round(py) - 1, 6, 2); ctx.fillRect(Math.round(px) - 1, Math.round(py) - 3, 2, 6);
    } else {
      ctx.fillStyle = PUAH_TINT[i % 2 ? 2 : 1];
      ctx.beginPath(); ctx.arc(px, py, i % 2 ? 2 : 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
