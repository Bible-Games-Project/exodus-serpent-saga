import { CATEGORY_ITEMS, CHAMPIONS, type ChampionEvo, type Evolution } from "./shopCatalog";
export const POWER_BAR_MAX = 8;
export function championBars(evo: ChampionEvo, stat: "attack" | "health"): number {
  const value = stat === "attack" ? evo.attackPct : evo.healthPct;
  const base = CHAMPIONS[0].evolutions[0];
  const baseline = stat === "attack" ? base.attackPct : base.healthPct;
  if (value <= 0) return 0;
  return Math.min(POWER_BAR_MAX, (stat === "attack" ? 1 : 2) + Math.max(0, Math.ceil(Math.log2(value / baseline) * 2)));
}
const fields = ["dmg", "magicPct", "hpPct", "capPct", "speedPct"] as const;
const labels = { dmg: "Damage", magicPct: "Magic", hpPct: "Health", capPct: "Protection", speedPct: "Speed" };
export function equipmentStats(evo: Evolution): Array<{ label: string; bars: number }> {
  return fields.flatMap((field) => {
    const value = evo[field];
    if (value === undefined) return [];
    const max = Math.max(...Object.values(CATEGORY_ITEMS).flatMap(items => items.flatMap(item => item.evolutions.map(e => e[field] ?? 0))));
    return [{ label: labels[field], bars: value > 0 ? Math.max(1, Math.ceil(value / max * POWER_BAR_MAX)) : 0 }];
  });
}