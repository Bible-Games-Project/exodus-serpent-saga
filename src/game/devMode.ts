/**
 * Developer-only test harness.
 *
 * `DEV_ENABLED` is a compile-time constant: in a production build
 * `import.meta.env.DEV` is statically false, so every dev branch (and the dev
 * panel import inside it) is dropped by the bundler. Players can never reach
 * these controls, not even by editing localStorage.
 */
export const DEV_ENABLED: boolean = !!import.meta.env.DEV;

export type DevConfig = {
  /** Player level the run starts at (drives the existing enemy unlock system). */
  startLevel: number;
  /**
   * Plague progression: a player level whose unlocks are granted, "all" for
   * every implemented plague/power, or "none" for the normal starting state.
   */
  plagues: number | "all" | "none";
};

export const DEFAULT_DEV_CONFIG: DevConfig = { startLevel: 1, plagues: "none" };
