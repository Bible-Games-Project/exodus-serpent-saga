// Test Map: inventory of the run icons, each shown at the size and on the
// background it has in the game (level-up card, level-up stats row, bonus
// pickup on the ground, run HUD), new painted v2 icon next to the old pixel one.
import type { ReactNode } from "react";
import { ICON_V2 } from "@/game/iconArt";
import { BONUS_ART, STAFF_ART, SWORD_ART } from "@/game/uiIcons";
import plaguesBar from "@/assets/ui-plagues-bar.png";
import commandmentsBar from "@/assets/ui-commandments-bar.png";
import {
  CLOCK_ART,
  ICON_PASSIVE,
  MEDAL_ART,
  SKULL_ART,
  PixelIcon as GridIcon,
  StatPixelIcon,
} from "@/game/GameCanvas";

type Art = { grid: string[]; palette: Record<string, string> };
type Row = {
  name: string;
  icon: string;
  /** level-up blessing card (72 px) — old grid */
  card?: string[];
  /** level-up stats row (22 px) — old art */
  stats?: Art;
  /** bonus pickup on the ground (44 px) — old art */
  pickup?: Art;
  /** run HUD (38 px) — old art */
  hud?: Art;
  /** places the new icon is used that have no old art */
  alsoIn?: Array<"card" | "stats" | "pickup" | "hud">;
};

const ROWS: Row[] = [
  { name: "Sword (plague damage)", icon: ICON_V2.sword, card: ICON_PASSIVE.damage, stats: SWORD_ART },
  { name: "Serpent (staff becomes serpent)", icon: ICON_V2.serpent, alsoIn: ["card"] },
  { name: "Lightning (speed)", icon: ICON_V2.lightning, card: ICON_PASSIVE.speed, stats: BONUS_ART.lightning, pickup: BONUS_ART.lightning },
  { name: "Heart (health)", icon: ICON_V2.heart, card: ICON_PASSIVE.maxHp, stats: BONUS_ART.heart, pickup: BONUS_ART.heart },
  { name: "Shield", icon: ICON_V2.shield, card: ICON_PASSIVE.shield, stats: BONUS_ART.shield, pickup: BONUS_ART.shield },
  { name: "Magnet", icon: ICON_V2.magnet, card: ICON_PASSIVE.magnet, stats: BONUS_ART.magnet, pickup: BONUS_ART.magnet },
  { name: "Star", icon: ICON_V2.star, pickup: BONUS_ART.star },
  { name: "Level", icon: ICON_V2.level, hud: MEDAL_ART },
  { name: "Clock (time)", icon: ICON_V2.clock, hud: CLOCK_ART },
  { name: "Skull (kills)", icon: ICON_V2.skull, hud: SKULL_ART },
  { name: "Staff (staff level)", icon: ICON_V2.staff, stats: STAFF_ART, alsoIn: ["card"] },
  { name: "Champions (level-up card)", icon: ICON_V2.champions, alsoIn: ["card"] },
  { name: "Champion face (champions recruited)", icon: ICON_V2.championFace, alsoIn: ["stats"] },
];

const COLS = [
  { key: "card", title: "Level up card", size: 72, bg: "#f6e2ad" },
  { key: "stats", title: "Level up stats", size: 22, bg: "#f6e2ad" },
  { key: "pickup", title: "Pickup in game", size: 44, bg: "#d6bc86" },
  { key: "hud", title: "Run HUD", size: 38, bg: "rgba(40,26,12,0.85)" },
] as const;

function Img({ src, size }: { src: string; size: number }) {
  return <img src={src} alt="" width={size} height={size} draggable={false} style={{ width: size, height: size }} />;
}

function Tile({ bg, label, children }: { bg: string; label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="flex h-[84px] w-[84px] items-center justify-center border-[3px] border-[#3a2412]" style={{ background: bg }}>
        {children}
      </span>
      <span className="font-pixel text-[9px] uppercase tracking-wider text-[#8a5a2c]">{label}</span>
    </span>
  );
}

function Old({ row, col }: { row: Row; col: (typeof COLS)[number] }) {
  if (col.key === "card") return row.card ? <GridIcon grid={row.card} size={col.size} /> : null;
  const art = row[col.key];
  return art ? <StatPixelIcon art={art} size={col.size} /> : null;
}

export function IconInventory() {
  return (
    <section className="pixel-panel mb-5 bg-[#f6e2ad] p-5" aria-label="Icon inventory">
      <h2 className="font-display mb-1 text-sm uppercase tracking-[0.16em] text-[#4a2c10]">Icon inventory</h2>
      <p className="font-pixel mb-4 text-[11px] leading-relaxed text-[#7a5a30]">
        Each icon at its real size and background: new painted icon (in use) and the old pixel icon (kept as a fallback).
      </p>
      <div className="space-y-4">
        {ROWS.map((row) => (
          <div key={row.name} className="border-t-2 border-[#d8b878] pt-3">
            <h3 className="font-pixel mb-2 text-[11px] uppercase tracking-[0.18em] text-[#4a2f16]">{row.name}</h3>
            <div className="flex flex-wrap gap-4">
              {COLS.filter((col) => row[col.key] || row.alsoIn?.includes(col.key)).map((col) => (
                <div key={col.key} className="flex flex-col items-center gap-1">
                  <span className="font-display text-[10px] uppercase tracking-[0.14em] text-[#7a5a30]">{col.title}</span>
                  <div className="flex gap-2">
                    <Tile bg={col.bg} label="New"><Img src={row.icon} size={col.size} /></Tile>
                    {row[col.key] && <Tile bg={col.bg} label="Old"><Old row={row} col={col} /></Tile>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="border-t-2 border-[#d8b878] pt-3">
          <h3 className="font-pixel mb-2 text-[11px] uppercase tracking-[0.18em] text-[#4a2f16]">Bars</h3>
          <div className="flex flex-col gap-3">
            <span className="font-display text-[10px] uppercase tracking-[0.14em] text-[#7a5a30]">Ten plagues (level up)</span>
            <img src={plaguesBar} alt="Ten plagues bar" draggable={false} className="w-full max-w-[480px]" />
            <span className="font-display text-[10px] uppercase tracking-[0.14em] text-[#7a5a30]">Ten commandments (not in the game yet)</span>
            <img src={commandmentsBar} alt="Ten commandments bar" draggable={false} className="w-full max-w-[480px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
