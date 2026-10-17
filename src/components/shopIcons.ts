// Pixel-art icons for the shop: one icon per equipment family, plus the coin.
// Final per-item icons come later; these set the art direction.
import type { PixelArt } from "./PixelIcon";

export const COIN_ART: PixelArt = {
  palette: { K: "#5a2b13", G: "#e6c261", L: "#fbd98f", D: "#b8862f" },
  grid: [
    "...KKKK...",
    "..KGGGGK..",
    ".KGLGGDGK.",
    "KGLGGGGDGK",
    "KGGKGGKGGK",
    "KGGKGGKGGK",
    "KGLGGGGDGK",
    ".KGLGGDGK.",
    "..KGGGGK..",
    "...KKKK...",
  ],
};

export const SWORD_ICON: PixelArt = {
  palette: { K: "#2b1d14", B: "#cfd6dd", L: "#f4f8fb", G: "#e6c261", W: "#8a5a34" },
  grid: [
    "...........K",
    "..........KBK",
    ".........KLBK",
    "........KLBK.",
    ".......KLBK..",
    "..K...KLBK...",
    ".KGK.KLBK....",
    "..KGKLBK.....",
    "...KGGK......",
    "..KWKGGK.....",
    ".KWWK..KGK...",
    "KWWK....K....",
    ".KK.........",
  ],
};

export const STAFF_ICON: PixelArt = {
  palette: { K: "#2b1d14", W: "#8a5a34", L: "#d8b98a", G: "#e6c261" },
  grid: [
    "...KK.....",
    "..KGGK....",
    "..KGGK....",
    "...KWKGK..",
    "...KWKGK..",
    "...KWK....",
    "...KWK....",
    "...KWK....",
    "...KWK....",
    "...KWK....",
    "...KLK....",
    "...KLK....",
    "...KK.....",
  ],
};

export const HEART_ICON: PixelArt = {
  palette: { K: "#2b1d14", R: "#a12b2b", L: "#d95f4b" },
  grid: [
    ".KK..KK.",
    "KRRK KR RK".replace(/ /g, ""),
    "KLR RRK".replace(/ /g, ""),
    "KLRRRRRK",
    "KRRRRRRK",
    ".KRRRRK.",
    "..KRRK..",
    "...KK...",
  ],
};

export const SHIELD_ICON: PixelArt = {
  palette: { K: "#2b1d14", B: "#4a7fbf", L: "#8fb8e6", G: "#e6c261" },
  grid: [
    "KKKKKKKK",
    "KLLBBBHK".replace("H", "B"),
    "KLBBBBBK",
    "KBBBBBBK",
    "KBBBBBBK",
    ".KBBBBK.",
    "..KBBK..",
    "...KK...",
  ],
};

export const BOOT_ICON: PixelArt = {
  palette: { K: "#2b1d14", W: "#8a5a34", L: "#d8b98a", G: "#e6c261" },
  grid: [
    "..KK....",
    ".KWWK...",
    ".KWWK...",
    ".KWWK...",
    ".KWWK...",
    ".KWWKKK.",
    ".KWWWWWK",
    "KLLWWWWK",
    "KGGGGGGK",
    ".KKKKKK.",
  ],
};

// Champion portrait placeholder: a plain bust silhouette frame — deliberately
// neutral, not a face, until the final PNGs arrive.
export const PORTRAIT_PLACEHOLDER: PixelArt = {
  palette: { K: "#5a2b13", S: "#d8b98a", D: "#b59a6a" },
  grid: [
    "KKKKKKKKKKKK",
    "KSSSSSSSSSSK",
    "KSSSDDDSSSSK",
    "KSSDDDDDSSSK",
    "KSSDDDDDSSSK",
    "KSSSDDDSSSSK",
    "KSSSSSSSSSSK",
    "KSSDDDDDSSSK",
    "KSDDDDDDDSSK",
    "KDDDDDDDDDDS".slice(0, 12).replace(/S/g, "D").replace(/^KDDDDDDDDDDD$/, "KDDDDDDDDDDK"),
    "KDDDDDDDDDDK",
    "KKKKKKKKKKKK",
  ],
};
