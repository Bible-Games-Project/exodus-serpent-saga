// Every sound file that can be assigned to a game action (built by
// scripts/build-sound-library.ts from public/audio).
import LIBRARY from "./soundLibrary.json";

export type LibrarySound = { path: string; name: string; group: string; source: string };

export const SOUND_LIBRARY: LibrarySound[] = LIBRARY as LibrarySound[];
export const LIBRARY_BY_PATH: Record<string, LibrarySound> = Object.fromEntries(SOUND_LIBRARY.map((s) => [s.path, s]));

/** Library groups in display order (packs first, then the AI sets). */
export const LIBRARY_GROUPS: string[] = [...new Set(SOUND_LIBRARY.map((s) => s.group))].sort(
  (a, b) => Number(a.endsWith("(AI)")) - Number(b.endsWith("(AI)")) || a.localeCompare(b),
);
