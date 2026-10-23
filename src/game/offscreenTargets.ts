import type { Entity, GameState } from "./types";
/** Identity is the registered boss ID AND Ramses kind, never an ally name. */
export function offscreenTargets(state: GameState): Entity[] {
  const boss = state.ramsesId === undefined ? undefined : state.entities.get(state.ramsesId);
  return boss?.kind === "ramses" ? [boss] : [];
}