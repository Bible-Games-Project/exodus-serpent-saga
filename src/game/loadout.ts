// Applies the shop loadout to a run. Reads the saved equipment once at run
// start and exposes the multipliers the engine consults every frame.
import { findItem, type Evolution } from "./shopCatalog";
import { loadShop, ownedChampions } from "@/lib/shopSave";
import type { GameState } from "./types";

export type Loadout = {
  weapon: { id: string; evolution: number; dmg: number };
  staff: { id: string; evolution: number; magicPct: number };
  food: { id: string; hpPct: number; regen: number; resurrect: boolean };
  shield: { id: string; evolution: number; capPct: number };
  footwear: { id: string; speedPct: number };
};

function equippedEvo(category: keyof ReturnType<typeof loadShop>["equipped"]): Evolution | null {
  const slot = loadShop().equipped[category];
  const item = findItem(slot.itemId);
  return item?.evolutions.find((e) => e.level === slot.evolution) ?? null;
}

export function getLoadout(): Loadout {
  const w = equippedEvo("weapon");
  const st = equippedEvo("staff");
  const f = equippedEvo("food");
  const sh = equippedEvo("shield");
  const fw = equippedEvo("footwear");
  const s = loadShop();
  return {
    weapon: { id: s.equipped.weapon.itemId, evolution: s.equipped.weapon.evolution, dmg: w?.dmg ?? 0.5 },
    staff: { id: s.equipped.staff.itemId, evolution: s.equipped.staff.evolution, magicPct: st?.magicPct ?? 0 },
    food: { id: s.equipped.food.itemId, hpPct: f?.hpPct ?? 1, regen: f?.regen ?? 0, resurrect: f?.resurrect ?? false },
    shield: { id: s.equipped.shield.itemId, evolution: s.equipped.shield.evolution, capPct: sh?.capPct ?? 1 },
    footwear: { id: s.equipped.footwear.itemId, speedPct: fw?.speedPct ?? 0 },
  };
}

/** Apply the loadout to a fresh run state (normal game only, not the Test Map). */
export function applyLoadout(state: GameState): void {
  const lo = getLoadout();
  state.loadout = lo;
  // Food: maximum health (the bar keeps its dimensions; only the number grows).
  state.player.maxHp = Math.round(state.player.maxHp * (1 + lo.food.hpPct / 100));
  state.player.hp = state.player.maxHp;
  // Shield: capacity modifier — maxShield = base × (1 + bonus). Never a refill.
  const base = state.maxShield ?? 50;
  state.maxShield = Math.round(base * (1 + lo.shield.capPct / 100));
  state.shield = Math.min(state.shield ?? base, state.maxShield);
}

/** Magical (plague) damage multiplier from the equipped staff. */
export function magicMultiplier(state: GameState): number {
  return 1 + (state.loadout?.staff.magicPct ?? 0) / 100;
}

/** Physical weapon damage value from the equipped weapon evolution. */
export function weaponDamage(state: GameState): number {
  return state.loadout?.weapon.dmg ?? 0.5;
}

/** Movement speed bonus from the equipped footwear. */
export function footwearSpeedMul(state: GameState): number {
  return 1 + (state.loadout?.footwear.speedPct ?? 0) / 100;
}

/** Food regeneration in HP per second. */
export function foodRegen(state: GameState): number {
  return state.loadout?.food.regen ?? 0;
}

/** Champions the player owns in the shop and may summon (id + selected evolution). */
export function summonableChampions(): Array<{ id: string; evolution: number }> {
  return ownedChampions();
}
