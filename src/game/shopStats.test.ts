import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_ITEMS, CHAMPIONS } from "./shopCatalog";
import { POWER_BAR_MAX, areaDamageBars, championBars, equipmentStats, utilityBars } from "./shopStats";
import { evolutionState } from "./shopEvolution";

test("Power bars use a 0–20 scale with the strongest champion reaching 20", () => {
  assert.equal(POWER_BAR_MAX, 20);
  assert.equal(championBars(CHAMPIONS[13].evolutions[2], "attack"), 20);
  assert.equal(championBars(CHAMPIONS[13].evolutions[2], "health"), 20);
  for (const category of Object.values(CATEGORY_ITEMS)) for (const item of category) for (const evo of item.evolutions) {
    for (const stat of equipmentStats(evo, item)) assert.ok(stat.bars >= 0 && stat.bars <= 20);
  }
});
test("Mace, boomerang and ring have greater area coverage than spear", () => {
  const spear = CATEGORY_ITEMS.weapon.find(i => i.id === "spear");
  assert.ok(spear);
  for (const id of ["mace", "boomerang", "ring"]) {
    const item = CATEGORY_ITEMS.weapon.find(i => i.id === id); assert.ok(item);
    for (let n=0;n<3;n++) assert.ok(areaDamageBars(item,item.evolutions[n]) > areaDamageBars(spear,spear.evolutions[n]), id);
  }
});
test("Food, helmets and footwear include utility and footwear always includes speed", () => {
  for (const category of ["food", "shield", "footwear"] as const) for (const item of CATEGORY_ITEMS[category]) {
    const stats=equipmentStats(item.evolutions[0],item);
    assert.ok(stats.some(s => s.label === "Utility"));
    if(category === "footwear") assert.ok(stats.some(s => s.label === "Speed"));
    if(category === "shield") assert.ok(stats.some(s => s.label === "Shield"));
  }
  assert.ok(utilityBars(CHAMPIONS[2].evolutions[2]) > 0);
});
test("Affordable next evolution is available at the exact existing price", () => {
  assert.equal(evolutionState(2,150_000,1,150_000),"available");
  assert.equal(evolutionState(2,150_000,1,149_999),"unaffordable");
});
test("Purchased evolutions remain owned regardless of funds and future levels stay locked", () => {
  assert.equal(evolutionState(1,100,1,0),"owned");
  assert.equal(evolutionState(3,1_000_000,1,2_000_000),"locked");
});