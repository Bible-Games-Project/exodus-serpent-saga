import { expect, test } from "bun:test";
import { DAGGER_POISON, RING_BOUNCES, weaponCooldownMul, weaponIsRangedOnly, weaponReachMul } from "./weapons";
import type { GameState } from "./types";

const withWeapon = (id: string, evolution: number) => ({ loadout: { weapon: { id, evolution, dmg: 1 } } }) as unknown as GameState;

test("Ring rebounds 4, 8 and 12 times by level", () => {
  expect([...RING_BOUNCES]).toEqual([4, 8, 12]);
});

test("Dagger poison chance and strength grow with level", () => {
  expect(DAGGER_POISON[0].chance).toBeLessThan(DAGGER_POISON[1].chance);
  expect(DAGGER_POISON[1].chance).toBeLessThan(DAGGER_POISON[2].chance);
  expect(DAGGER_POISON[0].dps).toBeLessThan(DAGGER_POISON[2].dps);
});

test("Dagger attacks faster than the branch, faster at each level", () => {
  expect(weaponCooldownMul(withWeapon("branch", 1))).toBe(1);
  expect(weaponCooldownMul(withWeapon("dagger", 1))).toBeLessThan(1);
  expect(weaponCooldownMul(withWeapon("dagger", 3))).toBeLessThan(weaponCooldownMul(withWeapon("dagger", 2)));
});

test("Sword reach is 1x, 1.5x and 2x by level", () => {
  expect([1, 2, 3].map(l => weaponReachMul(withWeapon("sword", l)))).toEqual([1, 1.5, 2]);
});

test("Boomerang, ring and harpoon are thrown only; spear is melee", () => {
  expect(weaponIsRangedOnly("boomerang")).toBe(true);
  expect(weaponIsRangedOnly("ring")).toBe(true);
  expect(weaponIsRangedOnly("harpoon")).toBe(true);
  expect(weaponIsRangedOnly("spear")).toBe(false);
});
