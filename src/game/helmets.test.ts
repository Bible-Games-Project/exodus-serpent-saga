import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, update } from "./engine";
import { makeEnemy } from "./enemies";
import { damagePlayer, BONUSES } from "./bonuses";
import { PASSIVES } from "./passives";
import { SHIELDS } from "./shopCatalog";
import { sealedAllies, HELMET } from "./helmets";
import type { Entity, GameState } from "./types";

function arena(helmet: string, helmetLevel = 1): GameState {
  const state = createInitialState({
    maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1,
    equipment: { weapon: "none", weaponLevel: 1, staff: "none", staffLevel: 1, helmet, helmetLevel, footwear: "barefoot" },
  });
  for (const id of [...state.entities.keys()]) if (state.entities.get(id)?.team === "enemy") state.entities.delete(id);
  return state;
}

function foe(state: GameState): Entity {
  const e = makeEnemy(state, "soldier", { x: state.player.pos.x + 30, y: state.player.pos.y });
  state.entities.set(e.id, e);
  return e;
}

/** One blow of `dmg` from `src`, landing on HP only (the shield is emptied). */
function blow(state: GameState, src: Entity, dmg = 10): number {
  state.shield = 0;
  state.player.hp = state.player.maxHp;
  state.now += 1; // a new, separate blow
  damagePlayer(state, dmg, false, src);
  return state.player.maxHp - state.player.hp;
}

test("Helmet capacities follow the shop table and paint a separate bonus", () => {
  const caps: Record<string, number[]> = {
    abel: [10, 20, 30], noah: [10, 20, 30], abraham: [15, 25, 35], jacobm: [15, 25, 35], joseph: [25, 35, 45],
    bushp: [50, 75, 100], promise: [50, 75, 100], cloud: [75, 100, 125], covenant: [100, 150, 200], israel: [150, 200, 250],
  };
  assert.deepEqual(SHIELDS.map((s) => s.id), Object.keys(caps));
  for (const s of SHIELDS) assert.deepEqual(s.evolutions.map((e) => e.capPct), caps[s.id], s.id);
  const state = arena("abel", 3);
  assert.equal(state.shieldBonus, 15);
  assert.equal(state.maxShield, 65);
  assert.equal(state.shield, 65);
});

test("Protection of Noah blocks one blow every 15 seconds", () => {
  const state = arena("noah");
  const e = foe(state);
  assert.equal(blow(state, e), 0);
  assert.equal(blow(state, e), 10);
  state.now += HELMET.noahEvery;
  assert.equal(blow(state, e), 0);
});

test("Every frame of the same blow gets the same treatment", () => {
  const state = arena("noah");
  const e = foe(state);
  state.shield = 0;
  for (let i = 0; i < 10; i++) { damagePlayer(state, 1, false, e); state.now += 1 / 60; }
  assert.equal(state.player.hp, state.player.maxHp);
});

test("Shield of Abraham halves the next 3 blows", () => {
  const state = arena("abraham");
  const e = foe(state);
  assert.deepEqual([blow(state, e), blow(state, e), blow(state, e), blow(state, e)], [5, 5, 5, 10]);
  state.now += HELMET.abrahamEvery;
  assert.equal(blow(state, e), 5);
});

test("Mantle of Jacob blocks the next 3 blows, then recharges in 20 seconds", () => {
  const state = arena("jacobm");
  const e = foe(state);
  assert.deepEqual([blow(state, e), blow(state, e), blow(state, e), blow(state, e)], [0, 0, 0, 10]);
  state.now += HELMET.jacobEvery;
  assert.equal(blow(state, e), 0);
});

test("Joseph and the Burning Bush heal after 15 quiet seconds", () => {
  // Moses also regenerates a little on his own: compare with a helmet without healing.
  const run = (id: string) => {
    const state = arena(id);
    const e = foe(state);
    blow(state, e, 50);
    state.entities.delete(e.id);
    const hp = state.player.hp;
    for (let i = 0; i < 60 * 16; i++) { state.levelUpPending = null; state.paused = false; update(state, 1 / 60); }
    return { gain: state.player.hp - hp, max: state.player.maxHp };
  };
  const base = run("abel").gain;
  for (const [id, pct] of [["joseph", HELMET.josephHeal], ["bushp", HELMET.bushHeal]] as const) {
    const r = run(id);
    assert.ok(Math.abs(r.gain - base - r.max * pct) < 0.5, id);
  }
});

test("Shield of the Promise grants 1 second of invincibility", () => {
  const state = arena("promise");
  const a = foe(state), b = foe(state);
  assert.equal(blow(state, a), 0);
  state.now += 0.2;
  state.shield = 0;
  damagePlayer(state, 10, false, b);
  assert.equal(state.player.hp, state.player.maxHp);
  assert.equal(blow(state, b), 10);
});

test("Mantle of the Cloud turns attackers to dust", () => {
  const state = arena("cloud");
  const e = foe(state);
  assert.equal(blow(state, e), 0);
  state.levelUpPending = null; state.paused = false;
  update(state, 1 / 60);
  assert.ok(!state.entities.has(e.id));
});

test("Light of the Covenant seals the attacker as an ally", () => {
  const state = arena("covenant");
  const e = foe(state);
  assert.equal(blow(state, e), 0);
  assert.ok(e.data?.sealed);
  assert.deepEqual(sealedAllies(state).map((x) => x.id), [e.id]);
  // Moses' side can never kill it.
  e.hp = -5;
  state.levelUpPending = null; state.paused = false;
  update(state, 1 / 60);
  assert.ok(state.entities.has(e.id) && e.hp > 0);
});

test("Shield of the God of Israel: angels take every blow for 1 second", () => {
  const state = arena("israel");
  const a = foe(state), b = foe(state);
  assert.equal(blow(state, a), 0);
  state.now += 0.5;
  state.shield = 0;
  damagePlayer(state, 10, false, b);
  damagePlayer(state, 4); // even poison
  assert.equal(state.player.hp, state.player.maxHp);
  assert.equal(blow(state, b), 10);
});

test("Moses' bars flash blue when the shield takes a hit and red when health does", () => {
  const state = arena("none");
  state.shield = 5; state.maxShield = 50; state.now = 10;
  damagePlayer(state, 3);
  assert.ok((state.player.data?.shieldHitFxUntil as number) > state.now);
  assert.ok(!((state.player.data?.hurtFxUntil as number) > state.now));
  damagePlayer(state, 10);
  assert.ok((state.player.data?.hurtFxUntil as number) > state.now);
});

test("Pickups and upgrades light the matching part of Moses for a second", () => {
  const state = arena("none"); state.now = 20;
  const pd = () => state.player.data ?? {};
  BONUSES.heart.apply(state); assert.ok((pd().healFxUntil as number) > state.now);
  BONUSES.shield.apply(state); assert.ok((pd().shieldUpFxUntil as number) > state.now);
  PASSIVES.speed.apply(state); assert.ok((pd().shoeFxUntil as number) > state.now);
  PASSIVES.magnet.apply(state); assert.ok((pd().magnetFxUntil as number) > state.now);
  PASSIVES.damage.apply(state); assert.ok((state.equipFx?.empowerGlowUntil ?? 0) > state.now);
  state.now = 30; PASSIVES.shield.apply(state); assert.equal(pd().shieldUpFxUntil, 31);
  PASSIVES.maxHp.apply(state); assert.equal(pd().healFxUntil, 31);
});
