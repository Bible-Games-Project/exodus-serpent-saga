import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, dismissCompanion, setCompanionLevel, summonCompanion, update } from "./engine";
import type { NpcId } from "./types";

test("Test Map champions join at their chosen level, change level live and can be dismissed", () => {
  const state = createInitialState({ maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1, champions: {}, championLevels: { aaron: 3 } });
  const id = "aaron" as NpcId;
  summonCompanion(state, id);
  const ally = state.entities.get(state.npcs.get(id)!)!;
  assert.equal(ally.data?.evo, 3);
  const hp3 = ally.maxHp;
  setCompanionLevel(state, id, 1);
  assert.equal(ally.data?.evo, 1);
  assert.ok(ally.maxHp <= hp3);
  // A level-bound helper owned by the champion is dropped on level change / dismissal.
  state.entities.set(9999, { ...ally, id: 9999, kind: "chbird", team: "hazard", data: { ownerId: ally.id } });
  dismissCompanion(state, id);
  assert.ok(!state.npcs.has(id));
  assert.ok(!state.entities.has(ally.id) && !state.entities.has(9999));
});

test("Aaron's birds peck only foes near him that are going for him", async () => {
  const { makeEnemy } = await import("./enemies");
  const state = createInitialState({ maxAttackIndex: -1, enemies: {}, ramses: false, ramsesLevel: 1, champions: {}, championLevels: { aaron: 2 } });
  const id = "aaron" as NpcId;
  summonCompanion(state, id);
  const aaron = state.entities.get(state.npcs.get(id)!)!;
  aaron.data!.summonUntil = 0;
  aaron.data!.lastDmg = 10;
  const foe = makeEnemy(state, "soldier", { x: aaron.pos.x + 120, y: aaron.pos.y });
  state.entities.set(foe.id, foe);
  foe.maxHp = foe.hp = 1e6;
  let pecks = 0;
  const run = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      if ([...state.entities.values()].some((e) => e.kind === "chpeck")) pecks++;
      state.levelUpPending = null; state.paused = false;
      // Hold the foe in place with its target fixed.
      foe.pos.x = aaron.pos.x + 120; foe.pos.y = aaron.pos.y;
      update(state, 1 / 60);
    }
  };
  // Going for Moses: the birds stay with Aaron.
  const watch = () => { foe.data = { ...(foe.data ?? {}), tgtId: state.player.id, tgtAt: 1e9 }; };
  for (let i = 0; i < 120; i++) { watch(); run(1); }
  const birds = [...state.entities.values()].filter((e) => e.kind === "chbird");
  assert.equal(birds.length, 3);
  assert.equal(pecks, 0);
  // Going for Aaron: the birds fly at it and peck.
  for (let i = 0; i < 180; i++) { foe.data = { ...(foe.data ?? {}), tgtId: aaron.id, tgtAt: 1e9 }; run(1); }
  assert.ok(pecks > 0);
});
