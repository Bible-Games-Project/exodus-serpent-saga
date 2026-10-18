import { expect, test } from 'bun:test';
import { CHAMPIONS } from '@/game/shopCatalog';
test('Miriam starter is free; paid evolutions unchanged', () => expect(CHAMPIONS.find((c) => c.id === 'miriam')?.evolutions.map((e) => e.price)).toEqual([0, 600000, 1500000]));
test('Existing saves receive free Miriam without losing purchases or currency', async () => {
  let stored = JSON.stringify({ coins: 987, championsOwned: { aaron: 2 }, championsSelected: { aaron: 2 } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } } });
  const { loadShop, purchaseChampion, setShopUi } = await import('./shopSave');
  const save = loadShop(); expect(save.championsOwned.miriam).toBe(1); expect(save.championsSelected.miriam).toBe(1);
  expect(save.coins).toBe(987); expect(save.championsOwned.aaron).toBe(2);
  expect(purchaseChampion('miriam', 1)).toEqual({ ok: false, reason: 'owned' }); expect(loadShop().coins).toBe(987);
  setShopUi('staff'); expect(JSON.parse(stored).championsOwned.miriam).toBe(1);
});
