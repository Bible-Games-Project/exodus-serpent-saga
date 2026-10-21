// Shop screen: header, equipment categories, item detail and champion panels.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PixelIcon } from "./PixelIcon";
import { Button } from "./ui/button";
import { ShopItemIcon } from "./ShopItemIcon";
import { BONUS_ART, SWORD_ART, STAFF_ART } from "@/game/uiIcons";
import cover from "@/assets/Fondo_Pantalla_Main_Menu.png.asset.json";
import { ChampionArt, MOSES_PORTRAIT } from "./ChampionArt";
import {
  COIN_ART,
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
  weapon: SWORD_ART,
  staff: STAFF_ART,
  food: BONUS_ART.heart,
  shield: BONUS_ART.shield,
  footwear: BONUS_ART.lightning,
} as const;

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
    <main ref={useNoZoom()} className="sub-screen shop-screen flex flex-col px-4 py-4">
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
          <Button variant="ghost" size="sm"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 font-display"
          >
            ×
          </Button>
        </div>
      )}

      <div className="shop-layout relative mx-auto mt-4 grid w-full max-w-6xl flex-1 gap-4">
        {/* Left: categories + item list */}
        <section className="sub-panel shop-list-panel flex min-h-0 flex-col p-3" aria-label="Equipment">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
            {(Object.keys(CATEGORY_ITEMS) as ShopCategory[]).map((c) => (
              <Button variant="ghost" size="sm"
                key={c}
                role="tab"
                aria-selected={category === c}
                title={CATEGORY_LABELS[c]}
                onClick={() => pickCategory(c)}
                className={`pixel-btn-press rounded-none flex h-10 w-10 items-center justify-center border-3 ${
                  category === c ? "bg-[var(--title-mid)]" : "bg-[var(--title-light)]"
                } border-[var(--title-ink)]`}
              >
                <PixelIcon art={CATEGORY_ICONS[c]} size={22} />
              </Button>
            ))}
          </div>
          <h2 className="sub-head mt-3 px-2 py-1 font-display text-xs uppercase">{CATEGORY_LABELS[category]}</h2>
          <ul className="mt-2 min-h-0 flex-1 shop-scroll space-y-2.5 overflow-y-auto p-1 pr-2">
            {items.map((it) => {
              const owned = save.owned[it.id] ?? 0;
              const equipped = save.equipped[category].itemId === it.id;
              const next = it.evolutions[owned];
              return (
                <li key={it.id}>
                  <Button variant="ghost" size="sm"
                    onClick={() => pickItem(it.id)}
                    data-active={selectedItem === it.id}
                    className="shop-card pixel-btn-press flex h-auto w-full items-center justify-start gap-2 whitespace-normal rounded-none p-2 text-left"
                  >
                    <ShopItemIcon item={it} size={64} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[11px] uppercase">{it.name}</span>
                      <span className="mt-0.5 block text-[11px]">
                        {equipped ? <span className="shop-tag">Equipped</span> : owned > 0 ? <span className="shop-tag shop-tag-gold">Owned · Ev {owned}</span> : next ? (next.price === 0 ? "FREE" : formatCoins(next.price)) : "—"}
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Middle: detail panel */}
        <section className="sub-panel shop-detail min-h-0 overflow-y-auto p-4" aria-label="Details">
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
            <div>
              <div className="shop-stage"><ChampionArt url={MOSES_PORTRAIT} alt="Moses" /></div>
              <h3 className="shop-name mt-3 font-display uppercase">Moses</h3>
              <p className="text-xs">Choose equipment or a champion to prepare for the journey.</p>
            </div>
          )}
        </section>

        {/* Right: champions */}
        <section className="sub-panel shop-list-panel flex min-h-0 flex-col p-3" aria-label="Champions">
          <h2 className="sub-head px-2 py-1 font-display text-xs uppercase">Champions</h2>
          <ul className="mt-2 min-h-0 flex-1 shop-scroll space-y-2.5 overflow-y-auto p-1 pr-2">
            {CHAMPIONS.map((c) => {
              const owned = save.championsOwned[c.id] ?? 0;
              const sel = save.championsSelected[c.id];
              return (
                <li key={c.id}>
                  <Button variant="ghost" size="sm"
                    onClick={() => {
                      setSelectedChampion(c.id);
                      setSelectedItem(null);
                    }}
                    data-active={selectedChampion === c.id}
                    className="shop-card pixel-btn-press flex h-auto w-full items-center justify-start gap-2 whitespace-normal rounded-none p-2 text-left"
                  >
                    <ChampionArt id={c.id} face size={64} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[11px] uppercase">{c.name}</span>
                      <span className="block text-[11px]">
                        {owned > 0
                          ? <span className="shop-tag">Owned · Ev {sel ?? owned} · Summonable</span>
                          : <><span className="shop-tag shop-tag-gold">Locked</span> {formatCoins(c.evolutions[0].price)}</>}
                      </span>
                    </span>
                  </Button>
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
        <ShopItemIcon item={item} size={64} />
        <div>
          <h3 className="font-display text-sm uppercase">{item.name}</h3>
          <p className="text-xs">{item.description}</p>
        </div>
      </div>

      {item.hasEvolutions && (
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Evolutions">
          {item.evolutions.map((e) => (
            <Button variant="ghost" size="sm"
              key={e.level}
              role="tab"
              aria-selected={shown === e.level}
              onClick={() => onSelectEvo(e.level)}
              className={`pixel-btn-press rounded-none border-3 border-[var(--title-ink)] px-3 py-1 font-display text-[11px] uppercase ${
                shown === e.level ? "bg-[var(--title-mid)]" : "bg-[var(--title-light)]"
              }`}
            >
              Ev {e.level}
              {owned >= e.level ? " ✓" : ""}
            </Button>
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
            <Button variant="ghost" size="sm"
              disabled={!canBuy}
              onClick={() => onBuy(item, shown)}
              className="cover-button cover-button-primary pixel-btn-press font-display uppercase disabled:opacity-50"
            >
              Purchase
            </Button>
          )}
          {isOwned && !isEquipped && (
            <Button variant="ghost" size="sm"
              onClick={() => onEquip(item.id, shown)}
              className="cover-button pixel-btn-press font-display uppercase"
            >
              Equip
            </Button>
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
      <div className="shop-stage"><ChampionArt id={champ.id} alt={champ.name} /></div>
      <div className="mt-3 flex items-center gap-3">
        <div>
          <h3 className="shop-name font-display uppercase">{champ.name}</h3>
          <p className="text-xs">{champ.relationship}</p>
          <p className="mt-1 text-xs font-bold">{owned > 0 ? "OWNED — can be summoned" : "LOCKED — cannot be summoned"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Evolutions">
        {champ.evolutions.map((e) => (
          <Button variant="ghost" size="sm"
            key={e.level}
            role="tab"
            aria-selected={shown === e.level}
            onClick={() => onSelectEvo(e.level)}
            className={`pixel-btn-press rounded-none border-3 border-[var(--title-ink)] px-3 py-1 font-display text-[11px] uppercase ${
              shown === e.level ? "bg-[var(--title-mid)]" : "bg-[var(--title-light)]"
            }`}
          >
            Ev {e.level}
            {owned >= e.level ? " ✓" : ""}
          </Button>
        ))}
      </div>

      <div className="mt-3 border-3 border-[var(--title-ink)] bg-[var(--title-light)] p-3">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Attack" value={evo.attackPct} />
          <Stat label="Health" value={evo.healthPct} />
        </div>
        <p className="mt-1 text-[10px]">Relative to Miriam, evolution I (100%).</p>
        <p className="mt-1 text-sm">{evo.ability}</p>
        <p className="mt-2 text-sm">Price: {evo.price === 0 ? "FREE" : formatCoins(evo.price)}</p>
        <p className="mt-1 text-xs font-bold">
          {isSelected ? "SELECTED EVOLUTION" : isOwned ? "OWNED" : canBuy ? "AVAILABLE" : owned !== shown - 1 ? "LOCKED" : `NOT ENOUGH COINS — ${formatCoins(shortage)} more needed`}
        </p>
        <div className="mt-3 flex gap-2">
          {!isOwned && (
            <Button variant="ghost" size="sm"
              disabled={!canBuy}
              onClick={() => onBuy(champ, shown)}
              className="cover-button cover-button-primary pixel-btn-press font-display uppercase disabled:opacity-50"
            >
              Purchase
            </Button>
          )}
          {isOwned && !isSelected && (
            <Button variant="ghost" size="sm"
              onClick={() => onSelect(champ.id, shown)}
              className="cover-button pixel-btn-press font-display uppercase"
            >
              Select
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const STAT_MAX = Math.max(...CHAMPIONS.flatMap((c) => c.evolutions.flatMap((e) => [e.attackPct, e.healthPct])));
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] uppercase">{label}</p>
      <p className="font-display text-2xl leading-none">{value}%</p>
      <div className="shop-stat-bar mt-1"><span style={{ width: `${(value / STAT_MAX) * 100}%` }} /></div>
    </div>
  );
}

/** Blocks accidental pinch and Ctrl+wheel zoom while the shop is open; scrolling still works. */
function useNoZoom() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const wheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    const gesture = (e: Event) => e.preventDefault();
    const touch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchmove", touch, { passive: false });
    document.addEventListener("gesturestart", gesture);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchmove", touch);
      document.removeEventListener("gesturestart", gesture);
    };
  }, []);
  return ref;
}
