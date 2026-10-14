// Test Map — an isolated way to *initialise* the existing gameplay systems.
// It creates no new attacks, enemies, animations or rules: it only decides which
// of the already-implemented plagues and enemies are active in the session, and
// which Ramses phase is forced. Normal progression is untouched.
import { ENEMY_DEFS, ENEMY_ORDER, enemyLabel } from "./enemies";
import { PLAGUES, PLAGUE_ORDER } from "./plagues";
import { ALLY_POOL, allyDef } from "./allies";
import type { PlagueId, TestMapConfig } from "./types";

/**
 * Selectable attack list, numbered from 0. The staff melee is always available
 * (it is Moses' basic attack), so numbering starts with the serpent:
 *   0 = Staff becomes Serpent, 1 = White Leprosy, 2 = Water into Blood, ...
 */
export const TEST_ATTACK_ORDER: PlagueId[] = PLAGUE_ORDER.filter((id) => id !== "staff");

export function testAttackName(index: number): string {
  const id = TEST_ATTACK_ORDER[index];
  return id ? PLAGUES[id].name : "";
}

/**
 * Every enemy the game currently implements, taken straight from the registry so
 * newly added enemies appear here automatically with no extra wiring.
 */
export function testEnemyKinds(): string[] {
  const extra = Object.keys(ENEMY_DEFS).filter((k) => !ENEMY_ORDER.includes(k));
  return [...ENEMY_ORDER, ...extra];
}

export function testEnemyLabel(kind: string): string {
  return enemyLabel(kind);
}

/** Every registered champion, straight from the ally registry. */
export function testChampionIds(): string[] {
  return [...ALLY_POOL];
}

export function testChampionInfo(id: string): { name: string; url: string } {
  const d = allyDef(id);
  return { name: d?.name ?? id, url: d?.sprite.url ?? "" };
}

/** The ten biblical plagues in order, then the additional abilities. */
export const TEST_PLAGUE_IDS: PlagueId[] = ["blood", "frogs", "gnats", "flies", "livestock", "boils", "hail", "locusts", "darkness", "firstborn"];
export const TEST_EXTRA_IDS: PlagueId[] = ["redsea", "pillar", "leprosy", "serpent"];

/** Abilities enabled by a cumulative "up to index" preset. */
export function abilitiesUpTo(index: number): Partial<Record<PlagueId, boolean>> {
  const out: Partial<Record<PlagueId, boolean>> = {};
  TEST_ATTACK_ORDER.forEach((id, i) => (out[id] = i <= index));
  return out;
}

export function defaultTestMapConfig(): TestMapConfig {
  const enemies: Record<string, boolean> = {};
  for (const k of testEnemyKinds()) enemies[k] = true;
  return {
    maxAttackIndex: 0,
    abilities: abilitiesUpTo(0),
    enemies,
    ramses: false,
    ramsesLevel: 2,
    champions: Object.fromEntries(testChampionIds().map((id) => [id, false])),
  };
}
