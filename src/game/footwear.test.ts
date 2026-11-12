import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, update } from "./engine";
import { makeEnemy } from "./enemies";
import { damagePlayer } from "./bonuses";
import { FOOTWEAR } from "./shopCatalog";
import { footwearAbilityMul, footwearGlow } from "./footwear";
import { speedMultiplier } from "./passives";
import type { GameState } from "./types";

function run(footwear: string): GameState {
  const state = createInitialState({
    maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1,
    equipment: { weapon: "none", weaponLevel: 1, staff: "none", staffLevel: 1, helmet: "none", helmetLevel: 1, footwear },
  });
  for (const id of [...state.entities.keys()]) if (state.entities.get(id)?.team === "enemy") state.entities.delete(id);
  return state;
}
function tick(state: GameState, seconds: number, onFrame?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    state.levelUpPending = null; state.paused = false;
    onFrame?.();
    update(state, 1 / 60);
  }
}

test("Footwear speed grows by 5% per pair, from +5% to +50%", () => {
  assert.deepEqual(FOOTWEAR.map((f) => f.evolutions[0].speedPct), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  const s = run("joshua");
  assert.ok(Math.abs(speedMultiplier(s) - 1.2) < 1e-9);
});

test("Patriarchs, Pilgrim and Joshua give a 1-second burst every 20 / 15 / 10 s", () => {
  for (const [id, every, pct] of [["patriarchs", 20, 10], ["pilgrim", 15, 15], ["joshua", 10, 20]] as const) {
    const s = run(id);
    tick(s, every - .2);
    assert.equal(footwearAbilityMul(s), 1, id);
    tick(s, .4);
    assert.ok(Math.abs(footwearAbilityMul(s) - (1 + pct / 100)) < 1e-9, id);
    assert.ok(footwearGlow(s) > 0, `${id} glows`);
    tick(s, 1);
    assert.equal(footwearAbilityMul(s), 1, id);
  }
});

test("Wind, Messenger and Jordan speed up after 8 / 6 / 5 quiet seconds, until hurt", () => {
  for (const [id, wait, pct] of [["wind", 8, 20], ["messenger", 6, 25], ["jordan", 5, 30]] as const) {
    const s = run(id);
    tick(s, wait - .2);
    assert.equal(footwearAbilityMul(s), 1, id);
    tick(s, .4);
    assert.ok(Math.abs(footwearAbilityMul(s) - (1 + pct / 100)) < 1e-9, id);
    s.shield = 100;
    damagePlayer(s, 1);
    tick(s, 1 / 60);
    assert.equal(footwearAbilityMul(s), 1, `${id} loses it when hit`);
  }
});

test("Teleporting footwear jumps to a visible spot away from enemies, then bursts", () => {
  for (const [id, every, pct] of [["bushb", 20, 10], ["invisible", 15, 20], ["exodus", 10, 30]] as const) {
    const s = run(id);
    s.viewport = { w: 1280, h: 720 };
    const p = s.player.pos;
    const foes = [-40, 40].map((dx) => {
      const e = makeEnemy(s, "soldier", { x: p.x + dx, y: p.y });
      e.hp = e.maxHp = 1e6; s.entities.set(e.id, e); return e;
    });
    const home = { ...p };
    tick(s, every + .05, () => { foes[0].pos = { x: home.x - 40, y: home.y }; foes[1].pos = { x: home.x + 40, y: home.y }; });
    const moved = Math.hypot(p.x - home.x, p.y - home.y);
    assert.ok(moved > 120, `${id} moved ${moved}`);
    assert.ok(Math.abs(p.x - s.camera.x) < 640 && Math.abs(p.y - s.camera.y) < 360, `${id} lands on screen`);
    assert.ok(Math.abs(footwearAbilityMul(s) - (1 + pct / 100)) < 1e-9, id);
  }
});

test("Footprints from the second footwear on, never barefoot", () => {
  for (const [id, expect] of [["barefoot", false], ["patriarchs", true]] as const) {
    const s = run(id);
    tick(s, 1, () => { s.input.x = 1; s.input.y = 0; });
    assert.equal((s.footprints?.length ?? 0) > 0, expect, id);
  }
});
