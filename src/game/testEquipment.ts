import { CATEGORY_ITEMS } from "./shopCatalog";
import type { GameState, TestMapConfig } from "./types";
import type { Loadout } from "./loadout";
export type TestEquipment = { weapon: string; weaponLevel: number; staff: string; staffLevel: number; helmet?: string; footwear?: string };
export const DEFAULT_TEST_EQUIPMENT: TestEquipment = { weapon: "branch", weaponLevel: 1, staff: "moses", staffLevel: 1, helmet: "abel", footwear: "barefoot" };
export function testLoadout(input: TestEquipment = DEFAULT_TEST_EQUIPMENT): Loadout {
  const weapon = CATEGORY_ITEMS.weapon.find(i => i.id === input.weapon) ?? CATEGORY_ITEMS.weapon[0];
  const staff = CATEGORY_ITEMS.staff.find(i => i.id === input.staff) ?? CATEGORY_ITEMS.staff[0];
  const wl = Math.max(1, Math.min(3, Math.floor(input.weaponLevel)));
  const sl = Math.max(1, Math.min(3, Math.floor(input.staffLevel)));
  const helmet = CATEGORY_ITEMS.shield.find(i => i.id === input.helmet) ?? CATEGORY_ITEMS.shield[0];
  const footwear = CATEGORY_ITEMS.footwear.find(i => i.id === input.footwear) ?? CATEGORY_ITEMS.footwear[0];
  return {
    weapon: { id: weapon.id, evolution: wl, dmg: weapon.evolutions[wl - 1].dmg ?? .5 },
    staff: { id: staff.id, evolution: sl, magicPct: staff.evolutions[sl - 1].magicPct ?? 0 },
    food: { id: "sandwich", hpPct: 1, regen: 0, resurrect: false },
    shield: { id: helmet.id, evolution: 1, capPct: helmet.evolutions[0].capPct ?? 1 },
    footwear: { id: footwear.id, speedPct: footwear.evolutions[0].speedPct ?? 0 },
  };
}
export function applyTestEquipment(state: GameState, config: TestMapConfig): void {
  if (!state.testMap) return;
  state.loadout = testLoadout(config.equipment);
  // New staff specials are eligible immediately; no shop saves are touched.
  state.equipFx = {};
}