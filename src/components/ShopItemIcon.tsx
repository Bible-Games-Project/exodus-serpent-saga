import type { EquipItem } from "@/game/shopCatalog";
import { PixelIcon } from "./PixelIcon";
import { BONUS_ART } from "@/game/uiIcons";
import branch from "@/assets/shop-icon-branch.png";
import dagger from "@/assets/shop-icon-dagger.png";
import spear from "@/assets/shop-icon-spear.png";
import sword from "@/assets/shop-icon-sword.png";
import harpoon from "@/assets/shop-icon-harpoon.png";
import axe from "@/assets/shop-icon-axe.png";
import boomerang from "@/assets/shop-icon-boomerang.png";
import mace from "@/assets/shop-icon-mace.png";
import ring from "@/assets/shop-icon-ring.png";
import moses from "@/assets/shop-icon-moses.png";
import iron from "@/assets/shop-icon-iron.png";
import crystal from "@/assets/shop-icon-crystal.png";
import diamond from "@/assets/shop-icon-diamond.png";
import bronze from "@/assets/shop-icon-bronze.png";
import fire from "@/assets/shop-icon-fire.png";
import bush from "@/assets/shop-icon-bush.png";
import waters from "@/assets/shop-icon-waters.png";
import light from "@/assets/shop-icon-light.png";
import power from "@/assets/shop-icon-power.png";

const ART: Record<string, string> = { branch, dagger, spear, sword, harpoon, axe, boomerang, mace, ring, moses, iron, crystal, diamond, bronze, fire, bush, waters, light, power };

export function ShopItemIcon({ item, size }: { item: EquipItem; size: number }) {
  const url = ART[item.id];
  if (url) return <img src={url} alt="" width={size} height={size} loading="lazy" className="shop-item-icon shrink-0" style={{ width: size, height: size }} />;
  const art = item.category === "food" ? BONUS_ART.heart : item.category === "shield" ? BONUS_ART.shield : BONUS_ART.lightning;
  return <PixelIcon art={art} size={size} />;
}
