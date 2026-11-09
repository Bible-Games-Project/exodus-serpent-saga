import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAMPIONS, WEAPONS, STAFFS } from "./shopCatalog";
import { championBars } from "./shopStats";
import { equipmentArtUrl } from "./equipmentArt";
import { testLoadout, applyTestEquipment } from "./testEquipment";
import { createInitialState, update } from "./engine";
import { makeEnemy } from "./enemies";
import { updateEquipment, petrify } from "./equipment";
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
for (const [level, cd] of [[1, 20], [2, 15], [3, 10]] as const) test(`Staff special level ${level}: charges 1 s, slams at 0.3 s, then waits ${cd} s`, () => {
  const state = createInitialState({ maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1, equipment: { weapon: "branch", weaponLevel: 1, staff: "moses", staffLevel: level } });
  const spawn = (kind: string, pos: { x: number; y: number }, ttl: number, data: Record<string, unknown>) => ({ id: 999, kind, team: "hazard", pos, ttl, data, vel: { x: 0, y: 0 }, hp: 1, maxHp: 1, radius: 1, facing: 1, animT: 0, born: state.now }) as Entity;
  state.now = 0; updateEquipment(state, spawn, () => {});
  state.now = 3; updateEquipment(state, spawn, () => {});
  assert.equal(state.equipFx?.staffVisualAt, 3);
  state.now = 4.29; updateEquipment(state, spawn, () => {});
  assert.ok(!state.equipFx?.empowered);
  state.now = 4.3; updateEquipment(state, spawn, () => {});
  assert.equal(state.equipFx?.empowered, 1);
  assert.equal(state.equipFx?.staffNext, 4.3 + cd);
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
function staffArena(staff: string, level: number) {
  const state = createInitialState({ maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1, equipment: { weapon: "branch", weaponLevel: 1, staff, staffLevel: level } });
  const spawned: Entity[] = [];
  const spawn = (kind: string, pos: { x: number; y: number }, ttl: number, data: Record<string, unknown>) => {
    const e = { id: 9000 + spawned.length, kind, team: "hazard", pos, ttl, data, vel: { x: 0, y: 0 }, hp: 1, maxHp: 1, radius: 1, facing: 1, animT: 0, born: state.now } as Entity;
    spawned.push(e); return e;
  };
  const foes = [40, 70, 100, 130].map((dx, i) => {
    const e: Entity = { ...state.player, id: 500 + i, kind: "soldier", team: "enemy", pos: { x: state.player.pos.x + dx, y: state.player.pos.y }, hp: 100, maxHp: 100, radius: 10, data: {} };
    state.entities.set(e.id, e); return e;
  });
  return { state, spawn, spawned, foes };
}
function castStaff(a: ReturnType<typeof staffArena>) {
  a.state.now = 0; updateEquipment(a.state, a.spawn, () => {});
  a.state.now = 3; updateEquipment(a.state, a.spawn, () => {});
  a.state.now = 4.3; updateEquipment(a.state, a.spawn, () => {});
}
test("Staff of Moses blesses the next attack at the staff's level", () => {
  for (const level of [1, 2, 3]) {
    const a = staffArena("moses", level); castStaff(a);
    assert.equal(a.state.equipFx?.empowered, 1);
    assert.equal(a.state.equipFx?.blessEvo, level);
  }
});
test("Iron Staff cuts nearby foes' max HP by 25 / 50 / 75 %", () => {
  for (const level of [1, 2, 3]) {
    const a = staffArena("iron", level); castStaff(a);
    assert.equal(a.foes[0].maxHp, 100 * (1 - .25 * level));
    assert.ok(a.foes[0].hp <= a.foes[0].maxHp);
    assert.equal(a.foes[0].data?.metal, 1); // tint stays until death
    assert.ok(!a.state.equipFx?.empowered);
  }
});
test("Stone Staff petrifies a third, two thirds or all of the nearby foes, nearest first", () => {
  for (const [level, count] of [[1, 2], [2, 3], [3, 4]] as const) {
    const a = staffArena("bush", level); castStaff(a);
    const stoned = a.foes.filter(f => f.data?.stoneUntil != null).map(f => f.id);
    assert.deepEqual(stoned, a.foes.slice(0, count).map(f => f.id));
  }
});
test("Diamond Staff throws ten shards in every direction", () => {
  const a = staffArena("diamond", 1); castStaff(a);
  const shards = a.spawned.filter(e => e.kind === "staffshard");
  assert.equal(shards.length, 10);
  const angles = shards.map(e => Math.atan2(Number(e.data?.vy), Number(e.data?.vx))).sort((x, y) => x - y);
  for (let i = 1; i < angles.length; i++) assert.ok(Math.abs(angles[i] - angles[i - 1] - Math.PI / 5) < 1e-6);
});
test("Primordial Waters sends one wave toward the nearest foe", () => {
  const a = staffArena("waters", 1); castStaff(a);
  const waves = a.spawned.filter(e => e.kind === "staffwave");
  assert.equal(waves.length, 1);
  assert.ok(Number(waves[0].data?.vx) > 0 && Math.abs(Number(waves[0].data?.vy)) < 1e-9);
});
test("Divine Light drops one big beam on the nearest foe", () => {
  const a = staffArena("light", 1); castStaff(a);
  const beams = a.spawned.filter(e => e.kind === "stafflight");
  assert.equal(beams.length, 1);
  assert.deepEqual(beams[0].pos, a.foes[0].pos);
  assert.ok(Number(beams[0].data?.h) >= 200);
});
test("A petrified foe stands still: no walking, no animation, no pushing", () => {
  const state = createInitialState({ maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1 });
  const foe = makeEnemy(state, "soldier", { x: state.player.pos.x + 120, y: state.player.pos.y });
  foe.hp = foe.maxHp = 5000;
  state.entities.set(foe.id, foe);
  petrify(foe, state.now);
  const pos = { ...foe.pos }, anim = foe.animT;
  for (let i = 0; i < 60; i++) {
    state.levelUpPending = null; state.paused = false;
    foe.pos.x += 3; // anything that shoves it is undone
    update(state, 1 / 60);
  }
  assert.ok(state.now < Number(foe.data?.stoneUntil));
  assert.deepEqual(foe.pos, pos);
  assert.equal(foe.animT, anim);
});
