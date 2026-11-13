// Footwear visuals: coloured footprints on the ground, the shoes' glow while
// an ability is running and the teleport flashes. Logic lives in footwear.ts.
import type { GameState } from "./types";
import { PRINT_FADE, footwearColor, footwearGlow } from "./footwear";
import { glow, rgba, shade } from "./helmetFx";

const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** Ground pass: small sandal soles in the footwear's colour, fading out. */
export function drawFootprints(ctx: CanvasRenderingContext2D, s: GameState, camX: number, camY: number): void {
  const prints = s.footprints;
  if (!prints?.length) return;
  const col = footwearColor(s.loadout?.footwear.id);
  const dark = shade(col, -.35), light = shade(col, .35);
  ctx.save();
  prints.forEach((p) => {
    // Full while in the trail, then a smooth fade-out once it leaves it.
    const out = p.fadeAt == null ? 0 : (s.now - p.fadeAt) / PRINT_FADE;
    if (out >= 1) return;
    const a = Math.min(1, (s.now - p.at) / .08) * (1 - out) ** 1.5 * .6;
    ctx.save();
    ctx.translate(Math.round(p.x - camX), Math.round(p.y - camY));
    // Ground perspective: squash vertically, then turn the sole along the walk.
    ctx.scale(1, .6); ctx.rotate(p.a);
    ctx.globalAlpha = a; ctx.fillStyle = dark;
    ctx.fillRect(-1, -3, 7, 6); // forefoot
    ctx.fillRect(-6, -2, 4, 4); // heel
    ctx.globalAlpha = a * .9; ctx.fillStyle = col;
    ctx.fillRect(0, -2, 5, 4);
    ctx.fillRect(-5, -1, 2, 2);
    ctx.globalAlpha = a * .7; ctx.fillStyle = light;
    ctx.fillRect(2, -1, 2, 2);
    ctx.restore();
  });
  ctx.restore();
}

/** Glow around Moses' feet while an ability is running. `layer` back: on the
 *  ground under him; front: light and motes over the shoes. */
export function drawFootwearAura(ctx: CanvasRenderingContext2D, s: GameState, x: number, y: number, layer: "back" | "front"): void {
  const k = footwearGlow(s);
  if (k <= 0) return;
  const col = footwearColor(s.loadout?.footwear.id);
  ctx.save();
  if (layer === "back") {
    glow(ctx, x, y - 1, 26, col, .55 * k, .35);
    ctx.globalAlpha = .5 * k; ctx.strokeStyle = shade(col, .3); ctx.lineWidth = 1.5;
    const r = 15 + 3 * Math.sin(s.now * 8);
    ctx.beginPath(); ctx.ellipse(x, y - 1, r, r * .32, 0, 0, Math.PI * 2); ctx.stroke();
  } else {
    glow(ctx, x - 4, y - 4, 11, col, .75 * k);
    glow(ctx, x + 4, y - 4, 11, col, .75 * k);
    // Motes rising from the shoes.
    for (let i = 0; i < 6; i++) {
      const r1 = hash(i * 3.7 + 1), r2 = hash(i * 9.3 + 4);
      const t = (s.now * (.9 + r2) + r1) % 1;
      ctx.globalAlpha = k * (1 - t) * .9;
      ctx.fillStyle = i % 2 ? shade(col, .6) : col;
      ctx.fillRect(x + (r1 - .5) * 22 - 1, y - 3 - t * 20, 2, 2);
    }
  }
  ctx.restore();
}

/** Teleport: the spot Moses leaves fades in a column of his shoes' colour,
 *  and the spot he arrives at bursts with a ring. Drawn over everything. */
export function drawFootwearTeleport(ctx: CanvasRenderingContext2D, s: GameState, camX: number, camY: number): void {
  const f = s.equipFx;
  if (!f || f.shoeTeleAt == null) return;
  const u = (s.now - f.shoeTeleAt) / .6;
  if (u < 0 || u >= 1) return;
  const col = footwearColor(s.loadout?.footwear.id);
  ctx.save();
  const column = (x: number, y: number, a: number, grow: number) => {
    const g = ctx.createLinearGradient(0, y - 90, 0, y);
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(.7, rgba(col, .55)); g.addColorStop(1, rgba(col, .85));
    ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    const w = 26 * grow;
    ctx.fillRect(x - w / 2, y - 90, w, 90);
    ctx.globalCompositeOperation = "source-over";
  };
  // Departure.
  const fx0 = Number(f.shoeTeleFromX) - camX, fy0 = Number(f.shoeTeleFromY) - camY + 8;
  column(fx0, fy0, (1 - u) * .8, 1 - u * .7);
  glow(ctx, fx0, fy0 - 2, 30, col, (1 - u) * .7, .4);
  for (let i = 0; i < 10; i++) {
    const r1 = hash(i * 2.1 + 7), r2 = hash(i * 5.3 + 2);
    ctx.globalAlpha = (1 - u) * .9; ctx.fillStyle = i % 2 ? shade(col, .6) : col;
    ctx.fillRect(fx0 + (r1 - .5) * 30, fy0 - 10 - r2 * 60 - u * 30, 2, 3);
  }
  // Arrival (follows Moses).
  const x = s.player.pos.x - camX, y = s.player.pos.y - camY + 8;
  column(x, y, (1 - u) * .7, .4 + u * .8);
  ctx.globalAlpha = (1 - u) * .9; ctx.strokeStyle = shade(col, .4); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y - 1, 8 + 34 * u, (8 + 34 * u) * .35, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
