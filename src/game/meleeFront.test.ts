import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, update } from "./engine";
import { makeEnemy } from "./enemies";

for (const weapon of ["mace", "axe", "spear", "branch"]) {
  test(`Moses' ${weapon} melee never hits a foe behind him`, () => {
    const state = createInitialState({
      maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1,
      equipment: { weapon, weaponLevel: 1, staff: "none", staffLevel: 1, helmet: "none", helmetLevel: 1, footwear: "barefoot" },
    });
    for (const id of [...state.entities.keys()]) if (state.entities.get(id)?.team === "enemy") state.entities.delete(id);
    const p = state.player.pos;
    const front = makeEnemy(state, "soldier", { x: p.x + 30, y: p.y });
    const back = makeEnemy(state, "soldier", { x: p.x - 34, y: p.y });
    for (const e of [front, back]) { e.hp = e.maxHp = 1e6; e.vel = { x: 0, y: 0 }; state.entities.set(e.id, e); }
    for (let i = 0; i < 60 * 3; i++) {
      state.levelUpPending = null; state.paused = false;
      front.pos = { x: p.x + 30, y: p.y }; back.pos = { x: p.x - 34, y: p.y };
      update(state, 1 / 60);
    }
    assert.ok(front.hp < front.maxHp, "the foe in front is hit");
    assert.equal(back.hp, back.maxHp, "the foe behind is untouched");
  });
}

for (const level of [1, 3]) {
  test(`Tree of Life Branch ${level === 3 ? "III" : "I"} never touches a nearer foe behind Moses`, () => {
    const state = createInitialState({
      maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1,
      equipment: { weapon: "branch", weaponLevel: level, staff: "none", staffLevel: 1, helmet: "none", helmetLevel: 1, footwear: "barefoot" },
    });
    for (const id of [...state.entities.keys()]) if (state.entities.get(id)?.team === "enemy") state.entities.delete(id);
    state.player.facing = 1;
    const p = state.player.pos;
    const back = makeEnemy(state, "soldier", { x: p.x - 30, y: p.y });
    back.hp = back.maxHp = 1e6; state.entities.set(back.id, back);
    for (let i = 0; i < 60 * 3; i++) {
      state.levelUpPending = null; state.paused = false; state.player.facing = 1;
      back.pos = { x: p.x - 30, y: p.y };
      update(state, 1 / 60);
      for (const e of state.entities.values()) if (e.kind === "branchwind") assert.ok(Math.cos(Number(e.data?.angle)) > 0, "the gust leaves forward");
    }
    assert.equal(back.hp, back.maxHp);
    assert.ok(!back.data?.knockUntil, "the gust never pushes it");
  });
}
