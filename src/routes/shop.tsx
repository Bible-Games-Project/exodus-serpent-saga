import { createFileRoute } from "@tanstack/react-router";
import { ShopScreen } from "@/components/ShopScreen";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Exodus Survivors" },
      { name: "description", content: "Equip weapons, evolved staffs, helmets and footwear, and recruit champions for Exodus Survivors." },
      { property: "og:title", content: "Shop — Exodus Survivors" },
      { property: "og:description", content: "Equip weapons, evolved staffs, helmets and footwear, and recruit champions for Exodus Survivors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopScreen,
});
