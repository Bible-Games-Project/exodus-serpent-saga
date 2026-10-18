// Lightweight pixel-art visuals for shop champion abilities (championAbilities.ts).
import type { Entity, GameState } from "./types";
import { isChampionFxKind } from "./championAbilities";

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
