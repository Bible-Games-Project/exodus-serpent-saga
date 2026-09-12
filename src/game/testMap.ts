// Test Map — an isolated way to *initialise* the existing gameplay systems.
// It creates no new attacks, enemies, animations or rules: it only decides which
// of the already-implemented plagues and enemies are active in the session, and
// which Ramses phase is forced. Normal progression is untouched.
import { ENEMY_DEFS, ENEMY_ORDER, enemyLabel } from "./enemies";
import { PLAGUES, PLAGUE_ORDER } from "./plagues";
import type { PlagueId, TestMapConfig } from "./types";

/**
 * Selectable attack list, numbered from 0. The staff melee is always available
 * (it is Moses' basic attack), so numbering starts with the serpent:
 *   0 = Staff becomes Serpent, 1 = Water into Blood, ... 11 = Parting of the Red Sea.
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

export function defaultTestMapConfig(): TestMapConfig {
  const enemies: Record<string, boolean> = {};
  for (const k of testEnemyKinds()) enemies[k] = true;
  return {
    maxAttackIndex: 0,
    enemies,
    ramses: false,
    ramsesLevel: 2,
  };
}
