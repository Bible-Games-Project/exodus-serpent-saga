// Small palette of hand-picked pastel/desert colors used across all sprites.
// Keeping palette central means every entity feels part of the same painting.
export const PALETTE = {
  T: "transparent",
  // Skin & robes
  s1: "#e6c39a", // warm skin light
  s2: "#c99a6c", // warm skin shadow
  r1: "#f4e2c1", // linen light (Moses robe)
  r2: "#d8b98a", // linen shadow
  br: "#7a4a2b", // beard / dark hair
  hi: "#f6efdc", // highlight / eye white
  bl: "#2b1d14", // deep outline
  // Staff / wood
  wd: "#8a5a34",
  wl: "#b48355",
  // Serpent (green)
  g1: "#7fa96b",
  g2: "#4d7a3e",
  g3: "#c5d99a",
  // Blood / fire (red)
  bd: "#a12b2b",
  bl2: "#e05a48",
  // Frog
  fg: "#83a05a",
  fg2: "#4a6b34",
  // Gnat/fly
  gn: "#3a2f24",
  gn2: "#645445",
  // Sand / desert
  sa: "#e9c9a1",
  sd: "#c69a6c",
  sh: "#a17048",
  // Sky
  sk: "#f2d9ae",
  // Palm / vegetation
  pg: "#6b8a4a",
  pd: "#4b6832",
  // Stone / ruins
  st: "#c9b090",
  sd2: "#9a7f5c",
  // Enemy — Egyptian soldier (bronze / white kilt)
  bz: "#b98550",
  bz2: "#7a5230",
  wh: "#efe6cf",
  // Enemy — jackal
  jk: "#4a3628",
  jk2: "#2a1e14",
  // Gold / xp
  go: "#e6c261",
  go2: "#b48836",
  // Blue nile
  nl: "#7fa8b8",
  nl2: "#4a7688",
} as const;

export type Color = keyof typeof PALETTE;
