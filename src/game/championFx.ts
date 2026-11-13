// Lightweight pixel-art visuals for shop champion abilities (championAbilities.ts).
import type { Entity, GameState } from "./types";
import { isChampionFxKind } from "./championAbilities";
import smokeRingUrl from "@/assets/champion-miriam-smoke-ring.png";
import tornadoUrl from "@/assets/combat-staff-tornado.png";

const images = new Map<string, HTMLImageElement>();
function art(url: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = images.get(url);
  if (!img) { img = new Image(); img.src = url; images.set(url, img); }
  return img.complete && img.naturalWidth ? img : null;
}
/** Shades of Miriam's tornado art, used for its swirling streaks and motes. */
const TORNADO_TINT = ["#aeb3c0", "#d6d9e2", "#f4f6fa"];

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
      const art = PROJ_ART[(d.art as string) ?? "stone"] ?? PROJ_ART.stone;
      const [a, b, w, hgt] = art;
      ctx.translate(x, y - ((d.lift as number) ?? 0) * Math.max(0, 1 - (1 - life) * 3));
      if (d.art === "arrow" || d.art === "firearrow" || d.art === "spear" || d.art === "espear" || d.art === "flameline") {
        ctx.rotate(Math.atan2((d.vy as number) ?? 0, (d.vx as number) ?? 1));
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
      const flap = Math.sin(s.now * 18 + (d.idx as number)) > 0;
      ctx.fillStyle = "#f2efe6";
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = "#cfc8b4";
      if (flap) { ctx.fillRect(x - 6, y - 4, 4, 2); ctx.fillRect(x + 2, y - 4, 4, 2); }
      else { ctx.fillRect(x - 6, y, 4, 2); ctx.fillRect(x + 2, y, 4, 2); }
      ctx.fillStyle = "#e0a030"; ctx.fillRect(x + 2, y - 1, 2, 2);
      break;
    }
    case "chpeck": {
      ctx.globalAlpha = life;
      ctx.strokeStyle = "#f2efe6"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo((d.fx as number) - camX, (d.fy as number) - camY); ctx.lineTo(x, y - 16); ctx.stroke();
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
  const R = ((d.r as number) ?? 42) * 1.35; // ring radius on screen
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
  // Motes spiralling up around the funnel: the far half first, behind it.
  const motes = 14;
  const mote = (front: boolean) => {
    for (let i = 0; i < motes; i++) {
      const k = ((t * .55 + i / motes) % 1); // 0 at the base, 1 at the top
      const ang = t * 7 + i * 2.4 + k * 5;
      if ((Math.sin(ang) > 0) !== front) continue;
      const rad = (R * .45 + k * R * .55) * grow;
      const mx = Math.cos(ang) * rad + Math.sin(t * 9 - k * 5) * 8 * k;
      const my = Math.sin(ang) * rad * .35 - k * H;
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
      const cy = -k * H, sway = Math.sin(t * 9 - k * 5) * 10 * k;
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
      ctx.drawImage(img, 0, i * sh, img.naturalWidth, sh, -w * squeeze / 2 + sway, -H + i * dh + 4, w * squeeze, dh + .6);
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
    ctx.ellipse(Math.cos(ang) * R * (.6 + k * .5) * grow, Math.sin(ang) * R * .3 * grow - k * 10, rr, rr * .6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
