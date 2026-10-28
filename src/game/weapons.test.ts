import { test } from "node:test";
import assert from "node:assert/strict";
import { DAGGER_POISON, RING_BOUNCES, weaponCooldownMul, weaponIsRangedOnly, weaponReachMul } from "./weapons";
import type { GameState } from "./types";

const withWeapon = (id: string, evolution: number) => ({ loadout: { weapon: { id, evolution, dmg: 1 } } }) as unknown as GameState;

test("Ring rebounds 4, 8 and 12 times by level", () => {
  assert.deepEqual([...RING_BOUNCES], [4, 8, 12]);
});

test("Dagger poison chance and strength grow with level", () => {
  assert.ok(DAGGER_POISON[0].chance < DAGGER_POISON[1].chance);
  assert.ok(DAGGER_POISON[1].chance < DAGGER_POISON[2].chance);
  assert.ok(DAGGER_POISON[0].dps < DAGGER_POISON[2].dps);
});

test("Dagger attacks faster than the branch, faster at each level", () => {
  assert.equal(weaponCooldownMul(withWeapon("branch", 1)), 1);
  assert.ok(weaponCooldownMul(withWeapon("dagger", 1)) < 1);
  assert.ok(weaponCooldownMul(withWeapon("dagger", 3)) < weaponCooldownMul(withWeapon("dagger", 2)));
});

test("Sword reach is 1x, 1.5x and 2x by level", () => {
  assert.deepEqual([1, 2, 3].map(l => weaponReachMul(withWeapon("sword", l))), [1, 1.5, 2]);
});

test("Boomerang, ring and harpoon are thrown only; spear is melee", () => {
  assert.equal(weaponIsRangedOnly("boomerang"), true);
  assert.equal(weaponIsRangedOnly("ring"), true);
  assert.equal(weaponIsRangedOnly("harpoon"), true);
  assert.equal(weaponIsRangedOnly("spear"), false);
});
