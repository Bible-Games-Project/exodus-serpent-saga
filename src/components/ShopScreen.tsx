// Shop screen: header, equipment categories, item detail and champion panels.
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PixelIcon } from "./PixelIcon";
import cover from "@/assets/Fondo_Pantalla_Main_Menu.png.asset.json";
import pAaron from "@/assets/shop-portrait-aaron.png.asset.json";
import pJochebed from "@/assets/shop-portrait-jochebed.png.asset.json";
import pMiriam from "@/assets/shop-portrait-miriam.png.asset.json";
import fAaron from "@/assets/shop-full-aaron.png.asset.json";
import fJochebed from "@/assets/shop-full-jochebed.png.asset.json";
import fMiriam from "@/assets/shop-full-miriam.png.asset.json";
import {
  BOOT_ICON, COIN_ART, HEART_ICON, PORTRAIT_PLACEHOLDER, SHIELD_ICON, STAFF_ICON, SWORD_ICON,
} from "./shopIcons";
import {
  CATEGORY_ITEMS, CATEGORY_LABELS, CHAMPIONS, formatCoins,
  type ChampionDef, type EquipItem, type ShopCategory,
} from "@/game/shopCatalog";
import {
  equipItem, loadShop, purchaseChampion, purchaseItem,
  selectChampionEvolution, setShopUi, type ShopSave,
} from "@/lib/shopSave";

const CATEGORY_ICONS = {
  weapon: SWORD_ICON,
  staff: STAFF_ICON,
  food: HEART_ICON,
  shield: SHIELD_ICON,
  footwear: BOOT_ICON,
} as const;

// Shop artwork per champion. Champions without an entry show the neutral
// placeholder until their final PNGs are supplied.
const CHAMPION_ART: Record<string, { portrait: string; full: string }> = {
  aaron: { portrait: pAaron.url, full: fAaron.url },
  jochebed: { portrait: pJochebed.url, full: fJochebed.url },
  miriam: { portrait: pMiriam.url, full: fMiriam.url },
};

function ChampionPortrait({ id, size }: { id: string; size: number }) {
  const art = CHAMPION_ART[id];
  if (!art) return <PixelIcon art={PORTRAIT_PLACEHOLDER} size={size} />;
  return <img src={art.portrait} alt="" width={size} height={size} className="shop-portrait shrink-0" style={{ width: size, height: size }} />;
}

type Notice = { kind: "ok" | "err"; text: string } | null;

export function ShopScreen() {
  const [save, setSave] = useState<ShopSave>(() => loadShop());
  const [category, setCategory] = useState<ShopCategory>(() => loadShop().ui?.category ?? "weapon");
  const [selectedItem, setSelectedItem] = useState<string | null>(() => loadShop().ui?.itemId ?? null);
  const [selectedChampion, setSelectedChampion] = useState<string | null>(null);
  const [evoSel, setEvoSel] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const busy = useRef(false);

  const refresh = () => setSave({ ...loadShop() });

  const pickCategory = (c: ShopCategory) => {
    setCategory(c);
    setSelectedItem(null);
    setSelectedChampion(null);
    setShopUi(c);
    refresh();
  };

  const pickItem = (id: string) => {
    setSelectedItem(id);
    setSelectedChampion(null);
    setShopUi(category, id);
  };

  const guarded = (fn: () => Notice) => {
    if (busy.current) return;
    busy.current = true;
    try {
      setNotice(fn());
      refresh();
    } finally {
      busy.current = false;
    }
  };

  const buyItem = (item: EquipItem, evoLevel: number) =>
    guarded(() => {
      const r = purchaseItem(item.id, evoLevel);
      if (r.ok) return { kind: "ok", text: `${item.name} — evolution ${evoLevel} purchased.` };
      if (r.reason === "funds")
        return { kind: "err", text: `Not enough coins — you need ${formatCoins(r.shortage ?? 0)} more.` };
      return { kind: "err", text: "Already owned." };
    });

  const buyChampion = (champ: ChampionDef, evoLevel: number) =>
    guarded(() => {
      const r = purchaseChampion(champ.id, evoLevel);
      if (r.ok) return { kind: "ok", text: `${champ.name} — evolution ${evoLevel} purchased.` };
      if (r.reason === "funds")
        return { kind: "err", text: `Not enough coins — you need ${formatCoins(r.shortage ?? 0)} more.` };
      return { kind: "err", text: "Already owned." };
    });

  const items = CATEGORY_ITEMS[category];
  const currentItem = items.find((i) => i.id === selectedItem) ?? null;
  const currentChampion = CHAMPIONS.find((c) => c.id === selectedChampion) ?? null;

  return (
    <main className="sub-screen flex flex-col px-4 py-4">
      <img src={cover.url} alt="" aria-hidden className="sub-bg" />
      <div className="shop-veil" aria-hidden />
      {/* Header */}
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <Link to="/" className="cover-button pixel-btn-press font-display uppercase">← Menu</Link>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <h1 className="sub-title font-display text-3xl uppercase sm:text-4xl">Shop</h1>
            <p className="sub-sub hidden text-[11px] uppercase sm:block">Prepare for the journey</p>
          </div>
          <div className="sub-panel flex items-center gap-2 px-3 py-1.5" aria-label="Coin balance">
            <PixelIcon art={COIN_ART} size={20} />
            <span className="font-display text-sm">{formatCoins(save.coins)}</span>
          </div>
        </div>
        <Link to="/play" className="cover-button cover-button-primary pixel-btn-press font-display uppercase">Play ▶</Link>
      </header>

      {notice && (
        <div
          role="status"
          className={`sub-panel relative mx-auto mt-3 w-full max-w-6xl px-4 py-2 text-center text-sm ${
            notice.kind === "err" ? "font-bold" : ""
          }`}
        >
          {notice.text}
          <button
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 font-display"
          >
            ×
          </button>
        </div>
      )}

      <div className="relative mx-auto mt-4 grid w-full max-w-6xl flex-1 gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
        {/* Left: categories + item list */}
        <section className="sub-panel flex min-h-0 flex-col p-3" aria-label="Equipment">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
            {(Object.keys(CATEGORY_ITEMS) as ShopCategory[]).map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={category === c}
                title={CATEGORY_LABELS[c]}
                onClick={() => pickCategory(c)}
                className={`pixel-btn-press flex h-10 w-10 items-center justify-center border-3 ${
                  category === c ? "bg-[var(--title-mid)]" : "bg-[var(--title-light)]"
                } border-[var(--title-ink)]`}
              >
                <PixelIcon art={CATEGORY_ICONS[c]} size={22} />
              </button>
            ))}
          </div>
          <h2 className="sub-head mt-3 px-2 py-1 font-display text-xs uppercase">{CATEGORY_LABELS[category]}</h2>
          <ul className="mt-2 min-h-0 flex-1 shop-scroll space-y-2.5 overflow-y-auto p-1 pr-2" style={{ maxHeight: "55vh" }}>
            {items.map((it) => {
              const owned = save.owned[it.id] ?? 0;
              const equipped = save.equipped[category].itemId === it.id;
              const next = it.evolutions[owned];
              return (
                <li key={it.id}>
                  <button
                    onClick={() => pickItem(it.id)}
                    data-active={selectedItem === it.id}
                    className="shop-card pixel-btn-press flex w-full items-center gap-2 p-2 text-left"
                  >
                    <PixelIcon art={CATEGORY_ICONS[category]} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[11px] uppercase">{it.name}</span>
                      <span className="mt-0.5 block text-[11px]">
                        {equipped ? <span className="shop-tag">Equipped</span> : owned > 0 ? <span className="shop-tag shop-tag-gold">Owned · Ev {owned}</span> : next ? (next.price === 0 ? "FREE" : formatCoins(next.price)) : "—"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Middle: detail panel */}
        <section className="sub-panel min-h-0 overflow-y-auto p-4" style={{ maxHeight: "70vh" }} aria-label="Details">
          {currentItem ? (
            <ItemDetail
              item={currentItem}
              save={save}
              evoSel={evoSel[currentItem.id] ?? null}
              onSelectEvo={(l) => setEvoSel((p) => ({ ...p, [currentItem.id]: l }))}
              onBuy={buyItem}
              onEquip={(id, l) => guarded(() => (equipItem(id, l) ? { kind: "ok", text: "Equipped." } : { kind: "err", text: "Not owned." }))}
            />
          ) : currentChampion ? (
            <ChampionDetail
              champ={currentChampion}
              save={save}
              evoSel={evoSel[currentChampion.id] ?? null}
              onSelectEvo={(l) => setEvoSel((p) => ({ ...p, [currentChampion.id]: l }))}
              onBuy={buyChampion}
              onSelect={(id, l) =>
                guarded(() => (selectChampionEvolution(id, l) ? { kind: "ok", text: "Evolution selected." } : { kind: "err", text: "Not owned." }))
              }
            />
          ) : (
            <p className="p-4 text-center text-sm">Select an item or a champion to inspect it.</p>
          )}
        </section>

        {/* Right: champions */}
        <section className="sub-panel flex min-h-0 flex-col p-3" aria-label="Champions">
          <h2 className="sub-head px-2 py-1 font-display text-xs uppercase">Champions</h2>
          <ul className="mt-2 min-h-0 flex-1 shop-scroll space-y-2.5 overflow-y-auto p-1 pr-2" style={{ maxHeight: "62vh" }}>
            {CHAMPIONS.map((c) => {
              const owned = save.championsOwned[c.id] ?? 0;
              const sel = save.championsSelected[c.id];
              return (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setSelectedChampion(c.id);
                      setSelectedItem(null);
                    }}
                    data-active={selectedChampion === c.id}
                    className="shop-card pixel-btn-press flex w-full items-center gap-2 p-2 text-left"
                  >
                    <ChampionPortrait id={c.id} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[11px] uppercase">{c.name}</span>
                      <span className="block text-[11px]">
                        {owned > 0
                          ? <span className="shop-tag">Owned · Ev {sel ?? owned} · Summonable</span>
                          : <span className="shop-tag shop-tag-gold">Locked</span> <span> · {formatCoins(c.evolutions[0].price)}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}

function ItemDetail({
  item, save, evoSel, onSelectEvo, onBuy, onEquip,
}: {
  item: EquipItem;
  save: ShopSave;
  evoSel: number | null;
  onSelectEvo: (l: number) => void;
  onBuy: (item: EquipItem, evo: number) => void;
  onEquip: (id: string, evo: number) => void;
}) {
  const owned = save.owned[item.id] ?? 0;
  const equippedSlot = save.equipped[item.category];
  const shown = evoSel ?? Math.min(Math.max(owned, 1), 3);
  const evo = item.evolutions[shown - 1];
  const isOwned = owned >= shown;
  const isEquipped = equippedSlot.itemId === item.id && equippedSlot.evolution === shown;
  const canBuy = !isOwned && owned === shown - 1 && save.coins >= evo.price;
  const shortage = evo.price - save.coins;

  return (
    <div>
      <div className="flex items-center gap-3">
        <PixelIcon art={CATEGORY_ICONS[item.category]} size={48} />
        <div>
          <h3 className="font-display text-sm uppercase">{item.name}</h3>
          <p className="text-xs">{item.description}</p>
        </div>
      </div>

      {item.hasEvolutions && (
        <div className="mt-3 flex gap-2" role="tablist" aria-label="Evolutions">
          {item.evolutions.map((e) => (
            <button
              key={e.level}
              role="tab"
              aria-selected={shown === e.level}
              onClick={() => onSelectEvo(e.level)}
              className={`pixel-btn-press border-3 border-[var(--title-ink)] px-3 py-1 font-display text-[11px] uppercase ${
                shown === e.level ? "bg-[var(--title-mid)]" : "bg-[var(--title-light)]"
              }`}
            >
              Ev {e.level}
              {owned >= e.level ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 border-3 border-[var(--title-ink)] bg-[var(--title-light)] p-3">
        <p className="font-display text-xs uppercase">{evo.name}</p>
        <p className="mt-1 text-sm font-bold">{evo.stat}</p>
        {evo.ability && <p className="mt-1 text-sm">{evo.ability}</p>}
        <p className="mt-2 text-sm">
          Price: {evo.price === 0 ? "FREE" : formatCoins(evo.price)}
        </p>
        <p className="mt-1 text-xs font-bold">
          {isEquipped ? "EQUIPPED" : isOwned ? "OWNED" : canBuy ? "AVAILABLE" : owned !== shown - 1 ? "LOCKED" : `NOT ENOUGH COINS — ${formatCoins(shortage)} more needed`}
        </p>
        <div className="mt-3 flex gap-2">
          {!isOwned && (
            <button
              disabled={!canBuy}
              onClick={() => onBuy(item, shown)}
              className="cover-button cover-button-primary pixel-btn-press font-display uppercase disabled:opacity-50"
            >
              Purchase
            </button>
          )}
          {isOwned && !isEquipped && (
            <button
              onClick={() => onEquip(item.id, shown)}
              className="cover-button pixel-btn-press font-display uppercase"
            >
              Equip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChampionDetail({
  champ, save, evoSel, onSelectEvo, onBuy, onSelect,
}: {
  champ: ChampionDef;
  save: ShopSave;
  evoSel: number | null;
  onSelectEvo: (l: number) => void;
  onBuy: (c: ChampionDef, evo: number) => void;
  onSelect: (id: string, evo: number) => void;
}) {
  const owned = save.championsOwned[champ.id] ?? 0;
  const selected = save.championsSelected[champ.id];
  const shown = evoSel ?? Math.min(Math.max(owned, 1), 3);
  const evo = champ.evolutions[shown - 1];
  const isOwned = owned >= shown;
  const isSelected = selected === shown;
  const canBuy = !isOwned && owned === shown - 1 && save.coins >= evo.price;
  const shortage = evo.price - save.coins;

  return (
    <div>
      <div className="shop-stage flex h-56 items-end justify-center overflow-hidden p-2 sm:h-72">
        {CHAMPION_ART[champ.id] ? (
          <img src={CHAMPION_ART[champ.id].full} alt={`${champ.name}, full body`} className="h-full w-auto object-contain" style={{ imageRendering: "pixelated" }} />
        ) : (
          <div className="flex flex-col items-center gap-2 pb-6">
            <PixelIcon art={PORTRAIT_PLACEHOLDER} size={96} />
            <span className="shop-tag">Artwork coming soon</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div>
          <h3 className="font-display text-base uppercase">{champ.name}</h3>
          <p className="text-xs">{champ.relationship}</p>
          <p className="mt-1 text-xs font-bold">{owned > 0 ? "OWNED — can be summoned" : "LOCKED — cannot be summoned"}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2" role="tablist" aria-label="Evolutions">
        {champ.evolutions.map((e) => (
          <button
            key={e.level}
            role="tab"
            aria-selected={shown === e.level}
            onClick={() => onSelectEvo(e.level)}
            className={`pixel-btn-press border-3 border-[var(--title-ink)] px-3 py-1 font-display text-[11px] uppercase ${
              shown === e.level ? "bg-[var(--title-mid)]" : "bg-[var(--title-light)]"
            }`}
          >
            Ev {e.level}
            {owned >= e.level ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div className="mt-3 border-3 border-[var(--title-ink)] bg-[var(--title-light)] p-3">
        <p className="text-sm font-bold">Attack {evo.attackPct}% · Health {evo.healthPct}%</p>
        <p className="mt-1 text-sm">{evo.ability}</p>
        <p className="mt-2 text-sm">Price: {formatCoins(evo.price)}</p>
        <p className="mt-1 text-xs font-bold">
          {isSelected ? "SELECTED EVOLUTION" : isOwned ? "OWNED" : canBuy ? "AVAILABLE" : owned !== shown - 1 ? "LOCKED" : `NOT ENOUGH COINS — ${formatCoins(shortage)} more needed`}
        </p>
        <div className="mt-3 flex gap-2">
          {!isOwned && (
            <button
              disabled={!canBuy}
              onClick={() => onBuy(champ, shown)}
              className="cover-button cover-button-primary pixel-btn-press font-display uppercase disabled:opacity-50"
            >
              Purchase
            </button>
          )}
          {isOwned && !isSelected && (
            <button
              onClick={() => onSelect(champ.id, shown)}
              className="cover-button pixel-btn-press font-display uppercase"
            >
              Select
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
