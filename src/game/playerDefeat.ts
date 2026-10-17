import type { GameState } from "./types";
import { shieldLethalSurvive } from "./equipment";

/** Applies the one intentional Test Map exception without touching run state. */
export function resolvePlayerDefeat(state: GameState): void {
  if (state.player.hp > 0) return;
  if (state.testMap) {
    state.player.hp = state.player.maxHp;
    return;
  }
  // Shield of the God of Israel: survive one lethal hit per run.
  const survived = shieldLethalSurvive(state);
  if (survived != null) {
    state.player.hp = survived;
    return;
  }
  // Fruit of the Tree of Life: one resurrection per run, half health, no shield.
  if (state.loadout?.food.resurrect && !state.resurrectUsed) {
    state.resurrectUsed = true;
    state.player.hp = Math.round(state.player.maxHp / 2);
    state.shield = 0;
    return;
  }
  state.gameOver = true;
  state.running = false;
}