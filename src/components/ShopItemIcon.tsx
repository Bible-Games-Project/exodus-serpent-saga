import type { EquipItem } from "@/game/shopCatalog";
import { PixelIcon } from "./PixelIcon";
import { BONUS_ART } from "@/game/uiIcons";
import branch from "@/assets/shop-pixel-branch.png.asset.json";
import dagger from "@/assets/shop-pixel-dagger.png.asset.json";
import spear from "@/assets/shop-pixel-spear.png.asset.json";
import sword from "@/assets/shop-pixel-sword.png.asset.json";
import harpoon from "@/assets/shop-pixel-harpoon.png.asset.json";
import axe from "@/assets/shop-pixel-axe.png.asset.json";
import boomerang from "@/assets/shop-pixel-boomerang.png.asset.json";
import mace from "@/assets/shop-pixel-mace.png.asset.json";
import ring from "@/assets/shop-pixel-ring.png.asset.json";
import moses from "@/assets/shop-pixel-moses.png.asset.json";
import iron from "@/assets/shop-pixel-iron.png.asset.json";
import crystal from "@/assets/shop-pixel-crystal.png.asset.json";
import diamond from "@/assets/shop-pixel-diamond.png.asset.json";
import bronze from "@/assets/shop-pixel-bronze.png.asset.json";
import fire from "@/assets/shop-pixel-fire.png.asset.json";
import bush from "@/assets/shop-pixel-bush.png.asset.json";
import waters from "@/assets/shop-pixel-waters.png.asset.json";
import light from "@/assets/shop-pixel-light.png.asset.json";
import power from "@/assets/shop-pixel-power.png.asset.json";

const ART: Record<string, { url: string }> = { branch, dagger, spear, sword, harpoon, axe, boomerang, mace, ring, moses, iron, crystal, diamond, bronze, fire, bush, waters, light, power };

export function ShopItemIcon({ item, size }: { item: EquipItem; size: number }) {
  const url = ART[item.id];
  if (url) return <img src={url.url} alt="" width={size} height={size} loading="lazy" className="shop-item-icon shrink-0" style={{ width: size, height: size }} />;
  const art = item.category === "food" ? BONUS_ART.heart : item.category === "shield" ? BONUS_ART.shield : BONUS_ART.lightning;
  return <PixelIcon art={art} size={size} />;
}
