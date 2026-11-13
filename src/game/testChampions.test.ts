import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, dismissCompanion, setCompanionLevel, summonCompanion } from "./engine";
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
