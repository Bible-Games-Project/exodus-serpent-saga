// Lightweight pixel-art visuals for shop champion abilities (championAbilities.ts).
import type { Entity, GameState } from "./types";
import { AMRAM_GROW_SECONDS, isChampionFxKind, PUAH_RING_HALF_W, STONE_FADE, wardShieldPos } from "./championAbilities";
import { ALLIES } from "./allies";
import { drawPixelFlame } from "./plagueFx";
import nadabFireUrl from "@/assets/champion-nadab-fireball.png";
import amramStoneUrl from "@/assets/champion-amram-stone.png";
import amramImpactUrl from "@/assets/champion-amram-impact.png";
import jethroImpactUrl from "@/assets/champion-jethro-impact.png";
import smokeRingUrl from "@/assets/champion-miriam-smoke-ring.png";
import tornadoUrl from "@/assets/champion-miriam-tornado.png";
import puahRingUrl from "@/assets/champion-puah-heal-ring.png";
import puahVialUrl from "@/assets/champion-puah-vial.png";
import puahSplashUrl from "@/assets/champion-puah-splash.png";
import gershomArrowUrl from "@/assets/champion-gershom-arrow.png";
import eliezerSpearUrl from "@/assets/champion-eliezer-spear.png";
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
  spear: ["#c9c2b0", "#6b4a2a", 20, 3],
  vial: ["#7fdc6a", "#3b6a2a", 7, 9],
  heal: ["#5fe08a", "#ffffff", 7, 9],
  fireball: ["#ffd36a", "#ff6a1a", 10, 10],
  flame: ["#ffd36a", "#ff6a1a", 10, 8],
  flameline: ["#ffd36a", "#ff6a1a", 16, 6],
  pyramid: ["#e0c07a", "#8a6a3a", 14, 12],
};

/** Champion visuals that lie on the ground, drawn behind every character
 *  (Puah's vial splash and her healing ring, Abihu's trail of flames). */
export function isGroundChampionFx(e: Entity): boolean {
  return (e.kind === "chaoe" && (!!e.data?.splash || !!e.data?.impact)) || (e.kind === "chzone" && (!!e.data?.puahRing || !!e.data?.trail));
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
      if (d.art === "boulder" && drawAmramStone(ctx, x, y, e, d, life)) break;
      if (d.art === "mist") { drawJethroMist(ctx, x, y, e, d, s); break; }
      if (d.art === "wardorb") { drawWardOrb(ctx, x + ((d.offX as number) ?? 0), y - ((d.curLift as number) ?? 0), e, d, s); break; }
      const projArt = PROJ_ART[(d.art as string) ?? "stone"] ?? PROJ_ART.stone;
      const [a, b, w, hgt] = projArt;
      const lift = (d.lift as number) ?? 0;
      // Zipporah's stones fade out at the end instead of vanishing.
      if (d.art === "stone" && d.liftEnd != null) ctx.globalAlpha = Math.min(1, (e.ttl ?? 0) / STONE_FADE);
      // Straight throws (liftEnd) glide evenly from the hand to body height, so they fly in a straight line.
      ctx.translate(x, y - (d.liftEnd != null ? (d.liftEnd as number) + (lift - (d.liftEnd as number)) * (1 - ((d.prog as number) ?? 1 - life)) : lift * Math.max(0, 1 - (1 - life) * 3)));
      if (d.art === "nadabfire") { drawNadabFire(ctx, e, d, s); break; }
      if (d.art === "arrow" || d.art === "spear" || d.art === "flameline") {
        // Point along the path seen on screen (ground motion plus the even descent of a straight throw).
        const drop = d.liftEnd != null && d.prog == null ? (lift - (d.liftEnd as number)) / ((d.maxTtl as number) || 1) : 0;
        ctx.rotate(Math.atan2(((d.vy as number) ?? 0) + drop, (d.vx as number) ?? 1));
      }
      if (d.art === "spear") {
        // Eliezer's spear: the supplied art; from level 2 it crackles with yellow lightning.
        const img = art(eliezerSpearUrl);
        if (img) {
          const lvl = (d.lvl as number) ?? 1;
          const len = 72, th = len * img.naturalHeight / img.naturalWidth;
          if (lvl >= 2) drawSpearSparks(ctx, len, lvl, true);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, -len / 2, -th / 2, len, th);
          if (lvl >= 2) drawSpearSparks(ctx, len, lvl, false);
          break;
        }
      }
      if (d.art === "arrow") {
        // Gershom's arrow: the supplied art, pointing where it flies.
        const img = art(gershomArrowUrl);
        if (img) {
          const len = 28, ah = len * img.naturalHeight / img.naturalWidth;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, -len / 2, -ah / 2, len, ah);
          break;
        }
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
      if (d.trail) { drawAbihuFlames(ctx, x, y, e, d, s); break; }
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
      drawEleazarRay(ctx, e, d, camX, camY, s, life);
      break;
    }
    case "chaoe": {
      if (d.impact === "amram" && drawAmramImpact(ctx, x, y, e, d, life)) break;
      if (d.burst === "convert") { drawConversionBurst(ctx, e, d, camX, camY, s, life); break; }
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
      // Eliezer's chain lightning: jagged yellow bolts jumping between the enemies it struck.
      const pts = ((d.pts as Array<{ x: number; y: number }>) ?? []).map((p) => ({ x: p.x - camX, y: p.y - camY - 16 }));
      const strong = ((d.lvl as number) ?? 2) >= 3;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (let pass = 0; pass < (strong ? 2 : 1); pass++) {
        const path = jagged(pts, strong ? 9 : 6);
        strokePath(ctx, path, "#ffb020", (strong ? 8 : 5), 0.35 * life);
        strokePath(ctx, path, "#ffe23a", (strong ? 3.5 : 2.5), 0.9 * life);
        strokePath(ctx, path, "#fffbe0", 1, life);
      }
      ctx.globalAlpha = life;
      for (const p of pts.slice(1)) {
        ctx.fillStyle = "#ffe23a";
        const n = strong ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (strong ? 12 : 8);
          ctx.fillRect(Math.round(p.x + Math.cos(a) * r) - 1, Math.round(p.y + Math.sin(a) * r) - 1, 2, 2);
        }
      }
      break;
    }
    case "chward": {
      const o = s.entities.get(d.ownerId as number);
      if (!o) break;
      const p = wardShieldPos(o);
      drawWardShield(ctx, Math.round(p.x - camX), Math.round(p.y - camY), e, d, s);
      break;
    }
    case "chshatter": {
      drawShieldShatter(ctx, x, y - ((d.lift as number) ?? 0), d, life);
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

/** Random zig-zag through the given points (fresh every frame, so it flickers like lightning). */
function jagged(pts: Array<{ x: number; y: number }>, amp: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  pts.forEach((p, i) => {
    if (i === 0) { out.push(p); return; }
    const q = pts[i - 1], dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy) || 1;
    const steps = Math.max(2, Math.round(l / 14));
    for (let k = 1; k < steps; k++) {
      const t = k / steps, off = (Math.random() * 2 - 1) * amp;
      out.push({ x: q.x + dx * t - (dy / l) * off, y: q.y + dy * t + (dx / l) * off });
    }
    out.push(p);
  });
  return out;
}

function strokePath(ctx: CanvasRenderingContext2D, path: Array<{ x: number; y: number }>, color: string, width: number, alpha: number) {
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

/** Yellow electricity around Eliezer's flying spear (drawn in the spear's frame, the spear along +x).
 *  The glow goes behind the spear, the crackling arcs over it; level 3 is bigger and busier. */
function drawSpearSparks(ctx: CanvasRenderingContext2D, len: number, lvl: number, behind: boolean) {
  const strong = lvl >= 3;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const alpha = ctx.globalAlpha;
  if (behind) {
    const r = strong ? 16 : 10;
    const g = ctx.createRadialGradient(len * 0.3, 0, 0, len * 0.3, 0, len * 0.5 + r);
    g.addColorStop(0, `rgba(255,226,58,${strong ? 0.55 : 0.35})`);
    g.addColorStop(1, "rgba(255,176,32,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(len * 0.1, 0, len * 0.6 + r * 0.4, r, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    const arcs = strong ? 4 : 2, amp = strong ? 7 : 4.5;
    for (let i = 0; i < arcs; i++) {
      const x0 = -len / 2 + Math.random() * len * 0.4, x1 = len / 2 - Math.random() * len * 0.15;
      const path = jagged([{ x: x0, y: 0 }, { x: x1, y: 0 }], amp);
      ctx.globalAlpha = alpha;
      strokePath(ctx, path, "#ffb020", strong ? 3.5 : 2.5, alpha * 0.45);
      strokePath(ctx, path, "#ffe86a", 1.2, alpha);
    }
    // Sparks crackling off the tip (and trailing behind at level 3).
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff6b0";
    const n = strong ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const x = len / 2 - Math.random() * (strong ? len : len * 0.3), y = (Math.random() * 2 - 1) * (strong ? 10 : 6);
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }
  ctx.restore();
}

/** Amram's stone in flight: his held stone, lobbed in an arc onto the target with a shadow
 *  on the ground; at levels 2 and 3 it swells to its final size in the first 0.2 s. */
function drawAmramStone(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, d: Record<string, unknown>, life: number): boolean {
  const img = art(amramStoneUrl);
  if (!img) return false;
  const maxTtl = (d.maxTtl as number) || 1, p = 1 - life;
  const grow = (d.grow as number) ?? 1;
  const k = 1 + (grow - 1) * Math.min(1, (maxTtl - (e.ttl ?? 0)) / AMRAM_GROW_SECONDS);
  const w = 25 * k, hgt = w * img.naturalHeight / img.naturalWidth;
  const height = ((d.lift as number) ?? 0) * (1 - p) + ((d.lob as number) ?? 0) * 4 * p * (1 - p);
  ctx.globalAlpha = 0.18 + 0.12 * p;
  ctx.fillStyle = "#28190a";
  ctx.beginPath(); ctx.ellipse(x, y, w * 0.45, w * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.translate(x, y - height);
  ctx.rotate(p * 1.6 * Math.sign((d.vx as number) || 1));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, -w / 2, -hgt / 2, w, hgt);
  return true;
}

/** Amram's impact: the supplied cracked-ground burst, popping open and then fading away. */
/**
 * Jethro's cloud of green mist: a few soft, churning green puffs that drift
 * from the staff down to the enemy's chest, leaving a thin trail of wisps.
 */
function drawJethroMist(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, d: Record<string, unknown>, s: GameState) {
  const p = (d.prog as number) ?? 0;
  const h = ((d.lift as number) ?? 40) * (1 - p) + 18 * p;
  const cy = y - h;
  const vx = (d.vx as number) ?? 0, vy = (d.vy as number) ?? 0;
  const vl = Math.hypot(vx, vy) || 1;
  const ux = vx / vl, uy = vy / vl;
  const fade = d.fading ? Math.max(0, (e.ttl ?? 0) / 0.25) : Math.min(1, p * 6 + 0.4);
  const t = s.now;
  // Trail of wisps behind the cloud.
  for (let i = 1; i <= 6; i++) {
    const k = i / 6;
    const wob = Math.sin(t * 9 + i * 1.7) * 3;
    ctx.globalAlpha = fade * (1 - k) * 0.55;
    ctx.fillStyle = i % 2 ? "#b0f010" : "#50b010";
    const z = i < 3 ? 3 : 2;
    ctx.fillRect(Math.round(x - ux * i * 6 - uy * wob), Math.round(cy - uy * i * 6 + ux * wob * 0.6), z, z);
  }
  // Churning puffs.
  for (let i = 0; i < 5; i++) {
    const ang = t * 3 + i * 1.257;
    const ox = Math.cos(ang) * 5, oy = Math.sin(ang) * 3;
    const r = 6 + (i % 2) * 2;
    const g = ctx.createRadialGradient(x + ox, cy + oy, 0, x + ox, cy + oy, r);
    g.addColorStop(0, i === 0 ? "rgba(240,250,120,0.9)" : "rgba(150,235,20,0.75)");
    g.addColorStop(1, "rgba(60,170,16,0)");
    ctx.globalAlpha = fade;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x + ox, cy + oy, r, 0, Math.PI * 2); ctx.fill();
  }
  // Specks glinting inside the mist.
  for (let i = 0; i < 4; i++) {
    const ang = -t * 5 + i * 1.57;
    ctx.globalAlpha = fade * (0.6 + 0.4 * Math.sin(t * 12 + i));
    ctx.fillStyle = "#f0f878";
    ctx.fillRect(Math.round(x + Math.cos(ang) * 6), Math.round(cy + Math.sin(ang) * 4), 2, 2);
  }
  ctx.globalAlpha = 1;
}

/**
 * Jethro turns an enemy: the supplied green blast pops on its chest, turns a
 * little and swells as it fades, over a soft green glow, with green sparks
 * flying out and wisps of mist rising. Follows the converted enemy.
 */
function drawConversionBurst(ctx: CanvasRenderingContext2D, e: Entity, d: Record<string, unknown>, camX: number, camY: number, s: GameState, life: number) {
  const t = d.targetId != null ? s.entities.get(d.targetId as number) : undefined;
  let fx = e.pos.x, fy = e.pos.y;
  if (t && t.hp > 0) {
    fx += t.pos.x - e.pos.x - Math.round((t.pos.x - e.pos.x) / s.worldW) * s.worldW;
    fy += t.pos.y - e.pos.y - Math.round((t.pos.y - e.pos.y) / s.worldH) * s.worldH;
  }
  const x = Math.round(fx - camX), cy = Math.round(fy - camY - 10);
  const g = 1 - life; // 0 → 1 over the burst
  const R = (d.r as number) ?? 44;
  const h01 = (i: number) => { const v = Math.sin((e.id * 7.13 + i) * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const fade = g < 0.55 ? 1 : 1 - (g - 0.55) / 0.45;
  // Soft green glow under the blast.
  const gl = ctx.createRadialGradient(x, cy, 0, x, cy, R * (0.8 + g * 0.6));
  gl.addColorStop(0, `rgba(176,240,16,${0.45 * fade})`);
  gl.addColorStop(1, "rgba(60,170,16,0)");
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(x, cy, R * (0.8 + g * 0.6), 0, Math.PI * 2); ctx.fill();
  // The blast itself: pops in, overshoots, then slowly swells and turns while fading.
  const img = art(jethroImpactUrl);
  if (img) {
    const pop = g < 0.1 ? 0.35 + 0.8 * (g / 0.1) : g < 0.2 ? 1.15 - 0.15 * ((g - 0.1) / 0.1) : 1 + 0.18 * (g - 0.2);
    const w = R * 1.7 * pop, hgt = w * img.naturalHeight / img.naturalWidth;
    ctx.save();
    ctx.translate(x, cy);
    ctx.rotate((h01(1) < 0.5 ? -1 : 1) * 0.35 * g);
    ctx.globalAlpha = fade;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -w / 2, -hgt / 2, w, hgt);
    ctx.restore();
  }
  // Green sparks flying out and falling.
  for (let i = 0; i < 12; i++) {
    const a = h01(i) * Math.PI * 2;
    const sp = R * (0.6 + h01(i + 30) * 0.7);
    const px = Math.round(x + Math.cos(a) * sp * Math.sqrt(g));
    const py = Math.round(cy + Math.sin(a) * sp * 0.7 * Math.sqrt(g) + g * g * 18);
    ctx.globalAlpha = fade * (0.7 + 0.3 * Math.sin((g * 8 + i) * 2));
    ctx.fillStyle = i % 3 === 0 ? "#f0f878" : i % 2 ? "#b0f010" : "#50b010";
    ctx.fillRect(px, py, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2);
  }
  // Wisps of green mist rising after the pop.
  for (let i = 0; i < 6; i++) {
    const k = Math.max(0, g - 0.15 - h01(i + 60) * 0.2);
    if (k <= 0) continue;
    const px = x + (h01(i + 80) - 0.5) * R * 1.1 + Math.sin(k * 10 + i) * 3;
    const py = cy + 6 - k * 46;
    const pr = 4 + k * 6;
    const wg = ctx.createRadialGradient(px, py, 0, px, py, pr);
    wg.addColorStop(0, `rgba(150,235,20,${0.55 * fade})`);
    wg.addColorStop(1, "rgba(60,170,16,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawAmramImpact(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, d: Record<string, unknown>, life: number): boolean {
  const img = art(amramImpactUrl);
  if (!img) return false;
  const t = 1 - life;
  const pop = t < 0.12 ? 0.55 + 0.45 * (t / 0.12) : 1;
  const w = (d.r as number) * 2.3 * pop, hgt = w * img.naturalHeight / img.naturalWidth * 0.8;
  ctx.globalAlpha = Math.min(1, life / 0.4);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, x - w / 2, y - hgt * 0.55, w, hgt);
  return true;
}

// ---------------------------------------------------------------- Ithamar
/** Ithamar's shield in pixels: G gold rim, B blue field, Y gold cross. */
const SHIELD_ROWS = [".GGGGG.", "GBBYBBG", "GYYYYYG", "GBBYBBG", "GBBYBBG", ".GBYBG.", "..GBG..", "...G..."];
const SHIELD_COL: Record<string, string> = { G: "#f2c443", B: "#2f6fd8", Y: "#ffe08a" };

/** A semi-transparent shield anchored in a champion's hand, with one pip per hit it can still take. */
function drawWardShield(ctx: CanvasRenderingContext2D, cx: number, cy: number, e: Entity, d: Record<string, unknown>, s: GameState) {
  const age = s.now - e.born;
  const pop = Math.min(1, age / 0.2);
  const px = 2;
  const flash = d.flash != null && s.now - (d.flash as number) < 0.18;
  // Soft blue halo behind the shield.
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
  halo.addColorStop(0, `rgba(150,200,255,${0.35 * pop})`);
  halo.addColorStop(1, "rgba(80,140,255,0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
  const sc = 0.6 + 0.4 * pop;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(sc, sc);
  ctx.globalAlpha = (0.55 + 0.1 * Math.sin(s.now * 5)) * pop;
  const x0 = -3.5 * px, y0 = -4 * px;
  SHIELD_ROWS.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const k = row[c];
      if (k === ".") continue;
      ctx.fillStyle = flash ? "#ffffff" : SHIELD_COL[k];
      ctx.fillRect(x0 + c * px, y0 + r * px, px, px);
    }
  });
  ctx.restore();
  // Pips: hits the shield can still absorb.
  const max = (d.maxHits as number) ?? (d.hits as number) ?? 0, left = (d.hits as number) ?? 0;
  ctx.globalAlpha = 0.9 * pop;
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < left ? "#ffe08a" : "rgba(60,60,80,0.6)";
    ctx.fillRect(Math.round(cx - max * 2 + i * 4), cy - 13, 3, 3);
  }
  // Sparkle ring when it appears.
  if (age < 0.35) {
    const k = age / 0.35;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = "#e8f4ff";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * (6 + 12 * k)) - 1, Math.round(cy + Math.sin(a) * (6 + 12 * k)) - 1, 2, 2);
    }
  }
}

/** Ithamar's magic orb flying to a champion: blue-white core, gold motes and a short trail. */
function drawWardOrb(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, d: Record<string, unknown>, s: GameState) {
  const vx = (d.vx as number) ?? 0, vy = (d.vy as number) ?? 0, v = Math.hypot(vx, vy) || 1;
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.18 * (4 - i);
    ctx.fillStyle = "#7fb4ff";
    const z = 6 - i;
    ctx.fillRect(Math.round(x - (vx / v) * i * 5 - z / 2), Math.round(y - (vy / v) * i * 5 - z / 2), z, z);
  }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(140,190,255,0.85)");
  g.addColorStop(1, "rgba(60,110,230,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffe08a";
  for (let i = 0; i < 3; i++) {
    const a = s.now * 9 + i * 2.1 + e.id;
    ctx.fillRect(Math.round(x + Math.cos(a) * 7) - 1, Math.round(y + Math.sin(a) * 5) - 1, 2, 2);
  }
}

/** A shield breaking: a white flash and blue / gold shards flying out and falling. */
function drawShieldShatter(ctx: CanvasRenderingContext2D, x: number, y: number, d: Record<string, unknown>, life: number) {
  const k = 1 - life;
  if (k < 0.3) {
    ctx.globalAlpha = 1 - k / 0.3;
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 6 + 20 * k, 0, Math.PI * 2); ctx.stroke();
  }
  const seed = (d.seed as number) ?? 1;
  const cols = ["#2f6fd8", "#f2c443", "#ffe08a", "#7fb4ff"];
  ctx.globalAlpha = Math.min(1, life * 2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + ((seed * (i + 3)) % 7) * 0.12;
    const sp = 30 + ((seed * (i + 1)) % 5) * 8;
    const px = x + Math.cos(a) * sp * k;
    const py = y + Math.sin(a) * sp * 0.7 * k + 60 * k * k;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, i % 3 === 0 ? 3 : 2, 2);
  }
}

// ---------------------------------------------------------------- Nadab
/** Nadab's thrown flame: the flame from his hand, flickering, fading out at the end. */
function drawNadabFire(ctx: CanvasRenderingContext2D, e: Entity, d: Record<string, unknown>, s: GameState) {
  const img = art(nadabFireUrl);
  ctx.globalAlpha = Math.min(1, (e.ttl ?? 0) / STONE_FADE);
  // Embers left behind.
  const vx = (d.vx as number) ?? 0, vy = (d.vy as number) ?? 0, v = Math.hypot(vx, vy) || 1;
  for (let i = 1; i <= 3; i++) {
    ctx.fillStyle = i === 1 ? "#ffd050" : "#ff6a14";
    const j = Math.sin(s.now * 23 + i * 2 + e.id) * 2;
    ctx.fillRect(Math.round(-(vx / v) * i * 7 + j) - 1, Math.round(-(vy / v) * i * 7 + 4 - i) - 1, 3 - (i > 2 ? 1 : 0), 2);
  }
  if (!img) { drawPixelFlame(ctx, 0, 8, s.now + e.id, 1.2, 1); return; }
  const hgt = 30 * (1 + 0.06 * Math.sin(s.now * 18 + e.id)), w = hgt * img.naturalWidth / img.naturalHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, -w / 2, -hgt * 0.7, w, hgt);
}

// ---------------------------------------------------------------- Abihu
/** One patch of Abihu's trail: a scorch mark and pixel flames that die down before it ends. */
function drawAbihuFlames(ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, d: Record<string, unknown>, s: GameState) {
  const k = Math.min(1, (e.ttl ?? 0) / 0.5, (s.now - e.born) / 0.12);
  const seed = (d.seed as number) ?? 0;
  ctx.globalAlpha = 0.3 * k;
  ctx.fillStyle = "#2a1408";
  ctx.beginPath(); ctx.ellipse(x, y, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  const size = 0.55 + 0.25 * k;
  drawPixelFlame(ctx, x - 4 + Math.sin(seed) * 3, y + 1, s.now + seed, size, k);
  drawPixelFlame(ctx, x + 5 + Math.cos(seed) * 2, y + 2, s.now * 1.2 + seed * 0.7, size * 0.75, k * 0.95);
}

// ---------------------------------------------------------------- Eleazar
function hash01(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Eleazar's ray: a jagged pixel bolt of light from the top of his staff to its enemy. */
function drawEleazarRay(ctx: CanvasRenderingContext2D, e: Entity, d: Record<string, unknown>, camX: number, camY: number, s: GameState, life: number) {
  const o = s.entities.get(d.ownerId as number), t = s.entities.get(d.targetId as number);
  const def = o && ALLIES[o.kind];
  if (!o || !t || !def) return;
  const sp = def.sprite, sc = sp.scale ?? 1;
  const sx = o.pos.x - camX + (sp.FX.x - sp.CX) * sc * o.facing;
  const sy = o.pos.y - camY + 10 - (sp.H - sp.FX.y) * sc;
  let dx = t.pos.x - o.pos.x, dy = t.pos.y - o.pos.y;
  if (Math.abs(dx) > s.worldW / 2) dx -= Math.sign(dx) * s.worldW;
  if (Math.abs(dy) > s.worldH / 2) dy -= Math.sign(dy) * s.worldH;
  const ex = o.pos.x - camX + dx, ey = o.pos.y - camY + dy - 14;
  const lvl = (d.lvl as number) ?? 1;
  const len = Math.hypot(ex - sx, ey - sy) || 1;
  const nx = -(ey - sy) / len, ny = (ex - sx) / len;
  const frame = Math.floor(s.now * 16);
  const segs = Math.max(3, Math.round(len / 18));
  const pts: Array<{ x: number; y: number }> = [{ x: sx, y: sy }];
  for (let i = 1; i < segs; i++) {
    const f = i / segs;
    const j = (hash01(frame * 31 + i * 7 + ((d.idx as number) ?? 0) * 101 + e.id) * 2 - 1) * (7 + 2 * lvl);
    pts.push({ x: sx + (ex - sx) * f + nx * j, y: sy + (ey - sy) * f + ny * j });
  }
  pts.push({ x: ex, y: ey });
  const fade = Math.min(1, life * 5, (1 - life) * 12 + 0.2);
  const plot = (size: number, color: string, alpha: number) => {
    ctx.globalAlpha = alpha * fade;
    ctx.fillStyle = color;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 2));
      for (let k = 0; k <= n; k++) {
        const px = a.x + (b.x - a.x) * (k / n), py = a.y + (b.y - a.y) * (k / n);
        ctx.fillRect(Math.round(px - size / 2), Math.round(py - size / 2), size, size);
      }
    }
  };
  plot(4 + 2 * lvl, "#ffd66a", 0.35);
  plot(2 + lvl, "#fff3b0", 0.85);
  plot(2, "#ffffff", 1);
  // Bursts of light at the staff and on the enemy.
  ctx.globalAlpha = fade;
  for (const [cx, cy, r] of [[sx, sy, 3 + lvl], [ex, ey, 4 + lvl]] as const) {
    ctx.fillStyle = "#fff3b0";
    ctx.fillRect(Math.round(cx - r), Math.round(cy) - 1, r * 2, 2);
    ctx.fillRect(Math.round(cx) - 1, Math.round(cy - r), 2, r * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4);
  }
  ctx.fillStyle = "#ffe680";
  for (let i = 0; i < 3 + lvl; i++) {
    const a = hash01(frame * 13 + i * 5 + e.id) * Math.PI * 2, r = 4 + hash01(frame * 7 + i) * (6 + 2 * lvl);
    ctx.fillRect(Math.round(ex + Math.cos(a) * r) - 1, Math.round(ey + Math.sin(a) * r) - 1, 2, 2);
  }
}
