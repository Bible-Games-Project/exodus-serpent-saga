import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, update } from './engine';
import { ALLIES } from './allies';
import { resolveChampionAttack, updateChampionEntities, wardAbsorb, championCooldownMul } from './championAbilities';
import type { ChampHelpers } from './championAbilities';
import type { Entity } from './types';

function arena(kind: string, evo: number) {
  const state = createInitialState({ maxAttackIndex: -1, abilities: {}, enemies: {}, ramses: false, ramsesLevel: 1, champions: {} });
  state.obstacles = []; state.entities = new Map([[state.player.id, state.player]]);
  state.viewport = { w: 1280, h: 1800 };
  const ally: Entity = { id: state.nextId++, kind, team: 'ally', pos: { ...state.player.pos }, vel: { x: 0, y: 0 }, hp: 1000, maxHp: 1000, radius: 12, facing: 1, animT: 0, born: 0, data: { evo, atkCd: 0, attackDir: { x: 1, y: 0 }, attackTarget: { x: state.player.pos.x + 120, y: state.player.pos.y } } };
  state.entities.set(ally.id, ally); state.npcs.set(ALLIES[kind].id, ally.id);
  const spawned: Entity[] = [];
  const h: ChampHelpers = {
    wrapDelta: (a, b, size) => ((a - b + size / 2) % size + size) % size - size / 2,
    killEnemy: e => { state.entities.delete(e.id); },
    spawn: (k, pos, ttl, data) => {
      const e: Entity = { id: state.nextId++, kind: k, team: 'hazard', pos: { ...pos }, vel: { x: 0, y: 0 }, hp: 1, maxHp: 1, radius: 1, facing: 1, animT: 0, born: state.now, ttl, data };
      spawned.push(e); state.entities.set(e.id, e); return e;
    },
  };
  function enemy(x: number, y = 0) {
    const e: Entity = { ...ally, id: state.nextId++, team: 'enemy', kind: 'soldier', pos: { x: ally.pos.x + x, y: ally.pos.y + y }, hp: 1000, data: {} };
    state.entities.set(e.id, e); return e;
  }
  return { state, ally, spawned, h, enemy, cast: () => resolveChampionAttack(state, ally, ALLIES[kind], 100, h) };
}

test('Zipporah I throws one non-piercing stone and deals real collision damage', () => {
  const a = arena('zipporah', 1); const first = a.enemy(100); const second = a.enemy(150);
  a.cast(); assert.equal(a.spawned.length, 1); assert.equal(a.spawned[0].data?.pierce, 1);
  updateChampionEntities(a.state, .35, a.h); assert.equal(first.hp, 900); assert.equal(second.hp, 1000);
});
test('Zipporah II throws two piercing stones with the established faster cooldown', () => {
  const a = arena('zipporah', 2); const enemies = [a.enemy(100), a.enemy(140), a.enemy(180)];
  a.cast(); assert.equal(a.spawned.length, 2); assert.equal(championCooldownMul(a.ally), .7);
  assert.deepEqual(a.spawned.map(e => e.data?.pierce), [3, 3]);
  updateChampionEntities(a.state, .4, a.h); assert.deepEqual(enemies.map(e => e.hp), [800, 800, 800]);
});
test('Zipporah III releases eight directional stones on every third attack', () => {
  const a = arena('zipporah', 3); a.ally.data = { ...a.ally.data, atkCount: 2 }; const e = a.enemy(100);
  a.cast(); assert.equal(a.spawned.length, 8); updateChampionEntities(a.state, .25, a.h); assert.equal(e.hp, 900);
});
test('Puah heals Moses through the real attack timeline without enemies', () => {
  const a = arena('puah', 1); a.state.player.hp = 40; a.state.plagues.clear();
  for (let i = 0; i < 120; i++) update(a.state, 1 / 60);
  assert.ok(a.state.player.hp >= 46, `Expected healing, received ${a.state.player.hp}`);
});
test('Ithamar wards without enemies and absorbs two melee hits at evolution I', () => {
  const a = arena('ithamar', 1); a.state.plagues.clear();
  for (let i = 0; i < 60; i++) update(a.state, 1 / 60);
  assert.equal(a.state.player.data?.wardHits, 2);
  assert.equal(wardAbsorb(a.state, a.state.player, true), false);
  assert.equal(wardAbsorb(a.state, a.state.player, false), true); a.state.now += .5;
  assert.equal(wardAbsorb(a.state, a.state.player, false), true); a.state.now += .5;
  assert.equal(wardAbsorb(a.state, a.state.player, false), false);
});
test('Ithamar II and III protect against projectiles for five and eight hits', () => {
  for (const [evo, hits] of [[2, 5], [3, 8]]) {
    const a = arena('ithamar', evo); a.cast(); assert.equal(a.ally.data?.wardHits, hits);
    assert.equal(wardAbsorb(a.state, a.ally, true), true);
  }
});
test('Shiphrah vials explode on their target and damage enemies at every evolution', () => {
  for (const evo of [1, 2, 3]) { const a = arena('shiphrah', evo); const e = a.enemy(120); a.cast(); updateChampionEntities(a.state, .5, a.h); assert.equal(e.hp, evo === 3 ? 840 : 900); }
});
test('Gershom fires one arrow then fire arrows then three explosive fire arrows', () => {
  for (const [evo, count, art] of [[1, 1, 'arrow'], [2, 1, 'firearrow'], [3, 3, 'firearrow']] as const) {
    const a = arena('gershom', evo); const e = a.enemy(120); a.cast(); assert.equal(a.spawned.length, count);
    assert.equal(a.spawned[0].data?.art, art); updateChampionEntities(a.state, .3, a.h); assert.ok(e.hp < 1000);
  }
});
test('Eliezer evolution chains use seven and fifteen additional targets', () => {
  for (const [evo, chains] of [[1, 0], [2, 7], [3, 15]]) { const a = arena('eliezer', evo); a.cast(); assert.equal(a.spawned[0].data?.chainN, chains); }
});
test('Amram casts one, two and three ground-cracking impacts', () => {
  for (const evo of [1, 2, 3]) { const a = arena('amram', evo); const e = a.enemy(120); a.cast(); assert.equal(a.spawned.length, evo); updateChampionEntities(a.state, .7, a.h); assert.ok(e.hp < 1000); }
});
test('Jethro converts ordinary enemies but never Ramses', () => {
  const a = arena('jethro', 3); const boss = a.enemy(20); boss.kind = 'ramses'; const soldier = a.enemy(50); a.cast();
  assert.equal(boss.data?.convertedUntil, undefined); assert.equal(boss.data?.confusedUntil, undefined);
  assert.equal(soldier.data?.convertedUntil, 10);
});