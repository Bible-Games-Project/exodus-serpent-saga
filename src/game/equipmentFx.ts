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
  const at = state.equipFx?.weaponVisualAt;
  const wp = at === undefined ? null : (state.now - at) / .45;
  const sp = latestEquipmentCastProgress(state);
  const css = getComputedStyle(document.documentElement);
  const color = (name: string) => css.getPropertyValue(`--equip-${name}`).trim();
  ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1); ctx.imageSmoothingEnabled = false;
  if (wp !== null && wp >= 0 && wp < 1) {
    const id = lo.weapon.id, rank = lo.weapon.evolution;
    ctx.globalAlpha = (1 - wp) * .65;
    ctx.fillStyle = color(id === "dagger" ? "poison" : id === "harpoon" ? "water" : id === "ring" ? "light" : id === "sword" && rank === 3 ? "fire" : "wood");
    for (let i = 0; i < 4 + rank * 2; i++) {
      const arc = -.9 + i / (3 + rank * 2) * 1.8;
      const r = 24 + wp * (12 + rank * 5);
      let px = 23 + Math.cos(arc) * r, py = -32 + Math.sin(arc) * r;
      if (id === "spear" || id === "harpoon") { px = 27 + i * 5 + wp * 8; py = -31 + (i % 2) * 2; }
      if (id === "mace" || id === "axe") { px = 23 + i * 4; py = -2 + (i % 3) * 3; }
      if (id === "boomerang" || id === "ring") { px = 32 + Math.cos(arc * 3 + wp * 4) * 13; py = -32 + Math.sin(arc * 3 + wp * 4) * 9; }
      ctx.fillRect(Math.round(px), Math.round(py), id === "dagger" ? 2 : 3, rank === 3 ? 3 : 2);
    }
  }
  if (sp !== null) {
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