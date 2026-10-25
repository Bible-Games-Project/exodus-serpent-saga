import { CATEGORY_ITEMS, CHAMPIONS, type ChampionEvo, type Evolution, type EquipItem } from "./shopCatalog";
export const POWER_BAR_MAX = 20;
const bars = (value: number) => Math.max(0, Math.min(POWER_BAR_MAX, Math.ceil(value)));
export function championBars(evo: ChampionEvo, stat: "attack" | "health"): number {
  const value = stat === "attack" ? evo.attackPct : evo.healthPct;
  const base = CHAMPIONS[0].evolutions[0];
  const baseline = stat === "attack" ? base.attackPct : base.healthPct;
  if (value <= 0) return 0;
  const floor = stat === "attack" ? 1 : 2;
  const maximum = Math.max(...CHAMPIONS.flatMap(c => c.evolutions.map(e => stat === "attack" ? e.attackPct : e.healthPct)));
  return bars(floor + Math.max(0, Math.log2(value / baseline)) / Math.log2(maximum / baseline) * (POWER_BAR_MAX - floor));
}
const fields = ["dmg", "magicPct", "hpPct", "capPct", "speedPct"] as const;
const labels = { dmg: "Damage", magicPct: "Magic", hpPct: "Health", capPct: "Shield", speedPct: "Speed" };

// Presentation-only capability scores. Never consumed by combat or save logic.
// Area measures damaging coverage (not single-hit damage); utility measures
// existing survival/control/mobility capabilities, not price or rarity.
export function utilityBars(evo: Evolution | ChampionEvo): number {
  const text = evo.ability.toLowerCase();
  const groups = [
    /heal|regenerat|resurrect|survive/,
    /shield|absorbs?|blocks?|projectile damage|keeps melee/,
    /slow|blind|confus|convert/,
    /push|knockback|repel|launches affected/,
    /speed|teleport|attract|flees/,
    /poison|burn|fire trail|fire archer|electric|lightning/,
    /pierc|rebound|chain|whirlwind|explos|several|multiple|two |three |five |nine |fifteen /,
  ];
  const capabilities = groups.reduce((n, pattern) => n + Number(pattern.test(text)), 0);
  const survival = "hpPct" in evo ? (evo.hpPct ?? 0) / 200 : 0;
  const protection = "capPct" in evo ? (evo.capPct ?? 0) / 300 : 0;
  const mobility = "speedPct" in evo ? (evo.speedPct ?? 0) / 50 : 0;
  return bars((capabilities / groups.length + Math.max(survival, protection, mobility) / 2) * POWER_BAR_MAX);
}

export function areaDamageBars(item: EquipItem, evo: Evolution): number {
  const level = evo.level;
  if (item.category === "weapon") {
    // Geometry and projectile counts mirror weapons.ts; radius coverage is
    // normalized against the 90px mace impact, with repeats counted separately.
    switch (item.id) {
      case "mace": return bars(([48, 70, 90][level - 1] / 90) ** 2 * 16 + (level === 3 ? 4 : 0));
      case "axe": return bars([150 * 22, 200 * 34, 260 * 46][level - 1] / (Math.PI * 90 ** 2) * 20);
      case "boomerang": return bars(level / 3 * 20);
      case "ring": return bars((level >= 2 ? 5 : 3) / 5 * 16 + (level >= 2 ? 4 : 0));
      case "spear": return bars((level >= 2 ? 4 : 1) / 5 * 5);
      case "harpoon": return bars(level === 1 ? 1 : (60 * (level === 3 ? 1.6 : 1) / 90) ** 2 * 16);
      case "branch": return level === 3 ? 16 : level * 2;
      case "dagger": return level === 3 ? 9 : level === 2 ? 5 : 2;
      case "sword": return level * 3;
      default: return 0;
    }
  }
  if (item.category !== "staff" || level === 1) return 0;
  switch (item.id) {
    case "bronze": return bars(([0, 110, 150][level - 1] / 260) ** 2 * 20);
    case "waters": return bars(([0, 180, 260][level - 1] / 260) ** 2 * 20);
    case "bush": case "light": case "power": return level === 3 ? 20 : 12;
    case "fire": return level === 3 ? 20 : 12;
    default: return 0;
  }
}

export function equipmentStats(evo: Evolution, item?: EquipItem): Array<{ label: string; bars: number }> {
  const result = fields.flatMap((field) => {
    const value = evo[field];
    if (value === undefined) return [];
    const max = Math.max(...Object.values(CATEGORY_ITEMS).flatMap(items => items.flatMap(item => item.evolutions.map(e => e[field] ?? 0))));
    return [{ label: labels[field], bars: value > 0 ? Math.max(1, Math.ceil(value / max * POWER_BAR_MAX)) : 0 }];
  });
  if (item?.category === "footwear" && evo.speedPct === undefined) result.push({ label: "Speed", bars: 0 });
  if (item?.category === "weapon" || item?.category === "staff") result.push({ label: "Area damage", bars: areaDamageBars(item, evo) });
  result.push({ label: "Utility", bars: utilityBars(evo) });
  return result;
}