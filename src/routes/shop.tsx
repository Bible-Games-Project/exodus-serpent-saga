import { createFileRoute } from "@tanstack/react-router";
import { ShopScreen } from "@/components/ShopScreen";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Exodus Survivors" },
      { name: "description", content: "Spend your coins on weapons, staffs, food, shields, footwear and champions." },
      { property: "og:title", content: "Shop — Exodus Survivors" },
      { property: "og:description", content: "Spend your coins on weapons, staffs, food, shields, footwear and champions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopScreen,
});
