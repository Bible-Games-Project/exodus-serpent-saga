import type { GameState } from "./types";

/** Visual-only cast beat shared by the rear hand and its local power mark. */
export function latestEquipmentCastProgress(state: GameState): number | null {
  const at = state.equipFx?.staffVisualAt;
  if (at === undefined || state.now - at > .65) return null;
  return Math.max(0, (state.now - at) / .65);
}
export function drawEquipmentPower(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number, flip: number): void {
  const lo = state.loadout;
  if (!lo) return;
  const sp = latestEquipmentCastProgress(state);
  const css = getComputedStyle(document.documentElement);
  const color = (name: string) => css.getPropertyValue(`--equip-${name}`).trim();
  ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1); ctx.imageSmoothingEnabled = false;
  // A serpent release has no decorative particles beside Moses' head.
  const serpentRelease = [...state.entities.values()].some(e => e.kind === 'serpent' && state.now - e.born < .65);
  if (sp !== null && !serpentRelease) {
    const id = lo.staff.id, rank = lo.staff.evolution;
    ctx.globalAlpha = Math.sin(Math.PI * sp) * .65;
    ctx.fillStyle = color(["bronze", "fire", "bush"].includes(id) ? "fire" : id === "waters" ? "water" : ["crystal", "diamond"].includes(id) ? "ice" : ["light", "power"].includes(id) ? "light" : id === "iron" ? "iron" : "wood");
    const count = 3 + rank;
    for (let i = 0; i < count; i++) {
      let px = -13 + (i - count / 2) * 3, py = -72 - Math.sin(sp * Math.PI) * 6;
      if (["light", "power"].includes(id)) { px = -16 + (i % 2) * 4; py += i * 4; }
      else if (id === "waters") { py += Math.sin(i + sp * 5) * 3; px += sp * 8; }
      else if (["bronze", "fire", "bush"].includes(id)) { py -= i % 3 * 3 + sp * 4; }
      else if (["crystal", "diamond"].includes(id)) { px = -14 + Math.cos(i / count * Math.PI * 2) * (5 + rank); py += Math.sin(i / count * Math.PI * 2) * 5; }
      else if (id === "iron") { py += i * 4; }
      ctx.fillRect(Math.round(px), Math.round(py), 2, rank === 3 ? 4 : 2);
    }
  }
  ctx.restore();
}