import { test } from "node:test";
import assert from "node:assert/strict";
import { COMBAT_HEADWEAR } from "./combatEquipmentArt";
test("Front-only combat headwear stays on the hairline above Moses's eyes", () => {
  assert.equal(COMBAT_HEADWEAR.x,13);
  assert.equal(COMBAT_HEADWEAR.y,3);
  assert.ok(COMBAT_HEADWEAR.y + COMBAT_HEADWEAR.height <= 7);
});