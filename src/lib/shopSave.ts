// Single source of truth for the shop: coin balance, ownership and equipment.
// Persisted in localStorage; survives reloads, runs and deaths.
import { CATEGORY_ITEMS, CHAMPIONS, findChampion, findItem, type ShopCategory } from "@/game/shopCatalog";

const KEY = "exodus-shop-v1";

export type EquipSlot = { itemId: string; evolution: number };

export type ShopSave = {
  coins: number;
  /** itemId -> highest purchased evolution (food/footwear always 1 when owned) */
  owned: Record<string, number>;
  equipped: Record<ShopCategory, EquipSlot>;
  /** championId -> highest purchased evolution */
  championsOwned: Record<string, number>;
  /** championId -> selected evolution (must be <= championsOwned) */
  championsSelected: Record<string, number>;
  ui?: { category?: ShopCategory; itemId?: string };
};

const DEFAULTS: ShopSave = {
  coins: 0,
  owned: { branch: 1, moses: 1, sandwich: 1, abel: 1, barefoot: 1 },
  equipped: {
    weapon: { itemId: "branch", evolution: 1 },
    staff: { itemId: "moses", evolution: 1 },
    food: { itemId: "sandwich", evolution: 1 },
    shield: { itemId: "abel", evolution: 1 },
    footwear: { itemId: "barefoot", evolution: 1 },
  },
  championsOwned: { miriam: 1 },
  championsSelected: { miriam: 1 },
};

let cache: ShopSave | null = null;

function sanitize(raw: Partial<ShopSave>): ShopSave {
  const s: ShopSave = {
    coins: Math.max(0, Math.floor(Number(raw.coins) || 0)),
    owned: {},
    equipped: { ...DEFAULTS.equipped },
    championsOwned: {},
    championsSelected: {},
    ui: raw.ui,
  };
  // Keep only owned entries that exist in the catalogue, clamped to 1..3.
  for (const [id, lvl] of Object.entries(raw.owned ?? {})) {
    const item = findItem(id);
    if (!item) continue;
    const max = item.hasEvolutions ? 3 : 1;
    const l = Math.min(max, Math.max(1, Math.floor(lvl)));
    s.owned[id] = l;
  }
  // Free starters are always owned.
  Object.assign(s.owned, DEFAULTS.owned);
  for (const cat of Object.keys(CATEGORY_ITEMS) as ShopCategory[]) {
    const eq = raw.equipped?.[cat];
    if (eq && findItem(eq.itemId) && (s.owned[eq.itemId] ?? 0) >= eq.evolution) {
      s.equipped[cat] = { itemId: eq.itemId, evolution: eq.evolution };
    }
  }
  for (const [id, lvl] of Object.entries(raw.championsOwned ?? {})) {
    if (!findChampion(id)) continue;
    s.championsOwned[id] = Math.min(3, Math.max(1, Math.floor(lvl)));
  }
  // Upgrade existing saves as well as new saves without losing paid ranks.
  s.championsOwned.miriam = Math.max(1, s.championsOwned.miriam ?? 0);
  s.championsSelected.miriam = 1;
  for (const [id, lvl] of Object.entries(raw.championsSelected ?? {})) {
    const owned = s.championsOwned[id] ?? 0;
    if (owned > 0) s.championsSelected[id] = Math.min(owned, Math.max(1, Math.floor(lvl)));
  }
  return s;
}

export function loadShop(): ShopSave {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? sanitize(JSON.parse(raw)) : sanitize({});
  } catch {
    cache = sanitize({});
  }
  return cache;
}

export function saveShop(s: ShopSave): void {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable — keep the in-memory copy
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; reason: "owned" | "funds"; shortage?: number };

/** Purchase the next (or a specific) evolution of an equipment item. */
export function purchaseItem(itemId: string, evolution: number): PurchaseResult {
  const s = loadShop();
  const item = findItem(itemId);
  const evo = item?.evolutions.find((e) => e.level === evolution);
  if (!item || !evo) return { ok: false, reason: "owned" };
  if ((s.owned[itemId] ?? 0) >= evolution) return { ok: false, reason: "owned" };
  // Evolutions must be bought in order.
  if ((s.owned[itemId] ?? 0) !== evolution - 1) return { ok: false, reason: "owned" };
  if (s.coins < evo.price) return { ok: false, reason: "funds", shortage: evo.price - s.coins };
  s.coins -= evo.price;
  s.owned[itemId] = evolution;
  // First purchase of a family equips it immediately.
  const slot = s.equipped[item.category];
  if (slot.itemId !== itemId && evolution === 1) {
    s.equipped[item.category] = { itemId, evolution };
  } else if (slot.itemId === itemId) {
    slot.evolution = Math.max(slot.evolution, evolution);
  }
  saveShop(s);
  return { ok: true };
}

/** Purchase a champion evolution (in order). */
export function purchaseChampion(championId: string, evolution: number): PurchaseResult {
  const s = loadShop();
  const champ = findChampion(championId);
  const evo = champ?.evolutions.find((e) => e.level === evolution);
  if (!champ || !evo) return { ok: false, reason: "owned" };
  if ((s.championsOwned[championId] ?? 0) >= evolution) return { ok: false, reason: "owned" };
  if ((s.championsOwned[championId] ?? 0) !== evolution - 1) return { ok: false, reason: "owned" };
  if (s.coins < evo.price) return { ok: false, reason: "funds", shortage: evo.price - s.coins };
  s.coins -= evo.price;
  s.championsOwned[championId] = evolution;
  s.championsSelected[championId] = evolution;
  saveShop(s);
  return { ok: true };
}

/** Equip an owned item/evolution. Free of charge. */
export function equipItem(itemId: string, evolution: number): boolean {
  const s = loadShop();
  const item = findItem(itemId);
  if (!item || (s.owned[itemId] ?? 0) < evolution) return false;
  s.equipped[item.category] = { itemId, evolution };
  saveShop(s);
  return true;
}

export function selectChampionEvolution(championId: string, evolution: number): boolean {
  const s = loadShop();
  if ((s.championsOwned[championId] ?? 0) < evolution) return false;
  s.championsSelected[championId] = evolution;
  saveShop(s);
  return true;
}

export function setShopUi(category: ShopCategory, itemId?: string): void {
  const s = loadShop();
  s.ui = { category, itemId };
  saveShop(s);
}

/** Highest purchased evolution for an item (0 = not owned). */
export function ownedLevel(itemId: string): number {
  return loadShop().owned[itemId] ?? 0;
}

/** Champions the player owns, with their selected evolution. */
export function ownedChampions(): Array<{ id: string; evolution: number }> {
  const s = loadShop();
  return CHAMPIONS.filter((c) => (s.championsOwned[c.id] ?? 0) > 0).map((c) => ({
    id: c.id,
    evolution: s.championsSelected[c.id] ?? s.championsOwned[c.id],
  }));
}

/** Add coins (game rewards). Persisted immediately. */
export function addCoins(amount: number): void {
  const s = loadShop();
  s.coins = Math.max(0, s.coins + Math.floor(amount));
  saveShop(s);
}
