import { Check, Lock, ShoppingCart } from "lucide-react";
import { evolutionState } from "@/game/shopEvolution";
import { formatCoins } from "@/game/shopCatalog";
export function EvolutionSquares({ evolutions, owned, coins }: {
  evolutions: Array<{ level: number; price: number }>;
  owned: number;
  coins: number;
}) {
  if (evolutions.length !== 3) return null;
  return <span className="shop-evolution-squares">
    {evolutions.map(e => {
      const state = evolutionState(e.level, e.price, owned, coins);
      const label = state === "owned" ? "Owned" : state === "available" ? "Buy now" : state === "unaffordable" ? "Not enough coins" : "Previous evolution required";
      return <span key={e.level} data-state={state} className="shop-evolution-square" title={`Evolution ${e.level}: ${label} · ${formatCoins(e.price)}`} aria-label={`Evolution ${e.level}: ${label}`}>
        <span>{e.level}</span>
        {state === "owned" ? <Check /> : state === "available" ? <ShoppingCart /> : <Lock />}
      </span>;
    })}
  </span>;
}