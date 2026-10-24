import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAMPIONS, WEAPONS, STAFFS } from "./shopCatalog";
import { championBars } from "./shopStats";
import { equipmentArtUrl } from "./equipmentArt";
import { testLoadout, applyTestEquipment } from "./testEquipment";
import { createInitialState } from "./engine";
import { updateEquipment } from "./equipment";
import type { Entity } from "./types";
import { offscreenTargets } from "./offscreenTargets";

test("Miriam I is the lowest damaging starter with one attack bar and two health bars", () => {
  const miriam = CHAMPIONS[0].evolutions[0];
  // Only the starter changes: one point below the weakest existing attacker
  // and health pool, rather than an arbitrary reduction to every champion.
  assert.equal(miriam.attackPct, 89);
  assert.equal(miriam.healthPct, 84);
  assert.equal(CHAMPIONS[1].evolutions[0].attackPct, 90);
  assert.equal(CHAMPIONS[1].evolutions[0].healthPct, 85);
  assert.equal(championBars(miriam, "attack"), 1);
  assert.equal(championBars(miriam, "health"), 2);
  for (const c of CHAMPIONS.slice(1)) {
    assert.ok(c.evolutions[0].healthPct > miriam.healthPct, c.id);
    if (c.evolutions[0].attackPct > 0) assert.ok(c.evolutions[0].attackPct > miriam.attackPct, c.id);
  }
  assert.equal(championBars(CHAMPIONS.find(c => c.id === "puah")?.evolutions[0] ?? miriam, "attack"), 0);
});
test("Every weapon and staff has distinct artwork for levels one through three", () => {
  for (const item of [...WEAPONS, ...STAFFS]) {
    const urls = [1, 2, 3].map(level => equipmentArtUrl(item.category, item.id, level));
    assert.ok(urls.every(Boolean), item.id);
    assert.equal(new Set(urls).size, 3, item.id);
  }
});
test("Default test equipment is branch front and Moses staff rear at level one", () => {
  const lo = testLoadout();
  assert.deepEqual(lo.weapon, { id: "branch", evolution: 1, dmg: .5 });
  assert.deepEqual(lo.staff, { id: "moses", evolution: 1, magicPct: 0 });
});
test("Live test equipment reads unchanged catalog values at levels one through three", () => {
  const config = { maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1 as const };
  const state = createInitialState(config); state.now = 42;
  for (let level = 1; level <= 3; level++) {
    applyTestEquipment(state, { ...config, equipment: { weapon: "mace", weaponLevel: level, staff: "power", staffLevel: level } });
    assert.equal(state.loadout?.weapon.dmg, [1.3, 1.45, 1.6][level - 1]);
    assert.equal(state.loadout?.staff.magicPct, [200, 250, 300][level - 1]);
    assert.equal(state.now, 42);
  }
});
test("Test equipment cannot mutate an ordinary run", () => {
  const config = { maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1 as const };
  const state = createInitialState(config); state.testMap = undefined;
  const before = JSON.stringify(state.loadout);
  applyTestEquipment(state, { ...config, equipment: { weapon: "mace", weaponLevel: 3, staff: "power", staffLevel: 3 } });
  assert.equal(JSON.stringify(state.loadout), before);
});
test("Bronze III special still spawns its existing ring and records the cast beat", () => {
  const state = createInitialState({ maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1, equipment: { weapon: "branch", weaponLevel: 1, staff: "bronze", staffLevel: 3 } });
  state.now = 2;
  const spawned: string[] = [];
  updateEquipment(state, (kind, pos, ttl, data) => {
    spawned.push(kind);
    const e: Entity = { id: 999, kind, team: "hazard", pos, ttl, data, vel: { x: 0, y: 0 }, hp: 1, maxHp: 1, radius: 1, facing: 1, animT: 0, born: 2 };
    assert.equal(data.r, 150); return e;
  }, () => {});
  assert.deepEqual(spawned, ["firering"]);
  assert.equal(state.equipFx?.staffVisualAt, 2);
  assert.equal(state.equipFx?.fireringNext, 22);
});
test("Off-screen targets retain only the registered Ramses, never ordinary allies", () => {
  const state = createInitialState({ maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1, champions: { miriam: true } });
  assert.equal(state.npcs.size, 1);
  assert.deepEqual(offscreenTargets(state), []);
  const boss: Entity = { ...state.player, id: 888, kind: "ramses", team: "enemy" };
  state.entities.set(boss.id, boss); state.ramsesId = boss.id;
  assert.deepEqual(offscreenTargets(state).map(e => e.kind), ["ramses"]);
  boss.kind = "miriam";
  assert.deepEqual(offscreenTargets(state), []);
});