import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS } from '@/game/shopCatalog';
test('Miriam starter is free; paid evolutions unchanged', () => assert.deepEqual(CHAMPIONS.find((c) => c.id === 'miriam')?.evolutions.map((e) => e.price), [0, 600000, 1500000]));
test('Existing saves receive free Miriam without losing purchases or currency', async () => {
  let stored = JSON.stringify({ coins: 987, championsOwned: { aaron: 2 }, championsSelected: { aaron: 2 } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } } });
  const { loadShop, purchaseChampion, setShopUi } = await import('./shopSave');
  const save = loadShop(); assert.equal(save.championsOwned.miriam, 1); assert.equal(save.championsSelected.miriam, 1);
  assert.equal(save.coins, 987); assert.equal(save.championsOwned.aaron, 2);
  assert.deepEqual(purchaseChampion('miriam', 1), { ok: false, reason: 'owned' }); assert.equal(loadShop().coins, 987);
  setShopUi('staff'); assert.equal(JSON.parse(stored).championsOwned.miriam, 1);
});
