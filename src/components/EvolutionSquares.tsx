import { evolutionState } from "@/game/shopEvolution";
import { formatCoins } from "@/game/shopCatalog";
export function EvolutionSquares({ evolutions, owned, coins, onPick }: {
  evolutions: Array<{ level: number; price: number }>;
  owned: number;
  coins: number;
  onPick?: (level: number) => void;
}) {
  if (evolutions.length !== 3) return null;
  return <span className="shop-evolution-squares">
    {evolutions.map(e => {
      const state = evolutionState(e.level, e.price, owned, coins);
      const label = state === "owned" ? "Owned" : state === "available" ? "Buy now" : state === "unaffordable" ? "Not enough coins" : "Previous evolution required";
      return <button type="button" key={e.level} data-state={state} className="shop-evolution-square"
        onClick={() => onPick?.(e.level)}
        title={`Evolution ${e.level}: ${label} · ${formatCoins(e.price)}`} aria-label={`View evolution ${e.level}: ${label}`}>
        {["I", "II", "III"][e.level - 1]}
      </button>;
    })}
  </span>;
}
