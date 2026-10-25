export type EvolutionState = "owned" | "available" | "unaffordable" | "locked";
export function evolutionState(level: number, price: number, owned: number, coins: number): EvolutionState {
  if (level <= owned) return "owned";
  if (level !== owned + 1) return "locked";
  return coins >= price ? "available" : "unaffordable";
}