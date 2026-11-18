// Which of the five alternatives each sound event uses.
//
// The player picks them in Test Map → Sound testing; the picks are saved in
// this browser (localStorage) and used by the game right away. To make them
// the game's own picks for every player, the Sound testing menu has a
// "Copy choices" button: the copied text goes into COMMITTED_CHOICES below.
// Nothing is chosen automatically: an event without a choice is silent.

/** Choices committed to the game (event id → alternative 1-5). */
export const COMMITTED_CHOICES: Record<string, number> = {};

const KEY = "exodus-survivors:sound-choices";
export const CHOICES_EVENT = "exodus-survivors:sound-choices-changed";

let cache: Record<string, number> | null = null;

function local(): Record<string, number> {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    cache = {};
  }
  return cache;
}

/** The chosen alternative (1-5) of an event, or null if none was chosen. */
export function chosenAlternative(id: string): number | null {
  return local()[id] ?? COMMITTED_CHOICES[id] ?? null;
}

export function allChoices(): Record<string, number> {
  return { ...COMMITTED_CHOICES, ...local() };
}

/** Choose alternative `n` for an event (null clears the choice). */
export function chooseAlternative(id: string, n: number | null) {
  const next = { ...local() };
  if (n == null) delete next[id];
  else next[id] = n;
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHOICES_EVENT));
  }
}
