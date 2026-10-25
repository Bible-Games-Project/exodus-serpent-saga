import type { EquipItem } from "@/game/shopCatalog";
import { equipmentArtUrl } from "@/game/equipmentArt";

// Category-keyed icons ("patriarchs" exists in both food and footwear).
const ICONS = import.meta.glob<{ default: { url: string } }>("@/assets/shop-icon-*.png.asset.json", { eager: true });
const ICON_BY_KEY: Record<string, string> = {};
const STAFF_ART = import.meta.glob<string>("@/assets/shop-staff-v4-*.png", { eager: true, query: "?url", import: "default" });
const STAFF_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(STAFF_ART)) {
  const match = path.match(/shop-staff-v4-([a-z]+)-(\d)\.png$/);
  if (match) STAFF_URLS[`${match[1]}:${match[2]}`] = url;
}
for (const [path, mod] of Object.entries(ICONS)) {
  const m = path.match(/shop-icon-([a-z]+)-([a-z]+)\.png\.asset\.json$/);
  if (m) ICON_BY_KEY[`${m[1]}:${m[2]}`] = mod.default.url;
}

export function shopItemIconUrl(item: EquipItem, evolution = 1): string | undefined {
  return (item.category === "staff" ? STAFF_URLS[`${item.id}:${evolution}`] : undefined) ?? equipmentArtUrl(item.category, item.id, evolution) ?? ICON_BY_KEY[`${item.category}:${item.id}`];
}

export function ShopItemIcon({ item, size, evolution = 1 }: { item: EquipItem; size: number; evolution?: number }) {
  const url = shopItemIconUrl(item, evolution);
  return (
    <span className="shop-icon-box shrink-0" style={{ width: size, height: size }}>
      {url && <img src={url} alt="" loading="lazy" className="shop-item-icon" />}
    </span>
  );
}
