// Every sound file that can be assigned to a game action (built by
// scripts/build-sound-library.ts from public/audio).
import LIBRARY from "./soundLibrary.json";

/** action: the game action a sound was made for (listed first in its picker). */
export type LibrarySound = { path: string; name: string; group: string; source: string; action?: string };

export const SOUND_LIBRARY: LibrarySound[] = LIBRARY as LibrarySound[];
export const LIBRARY_BY_PATH: Record<string, LibrarySound> = Object.fromEntries(SOUND_LIBRARY.map((s) => [s.path, s]));

/** Library groups in display order (Claude's sounds, other packs, then the AI sets). */
const groupRank = (g: string) => (g.endsWith("(Claude)") ? 0 : g.endsWith("(AI)") ? 2 : 1);
export const LIBRARY_GROUPS: string[] = [...new Set(SOUND_LIBRARY.map((s) => s.group))].sort(
  (a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b),
);
