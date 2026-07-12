// Single-character palette codes. One character = one pixel in every sprite.
// `.` is transparent. Keeps sprite grids readable and easy to edit.
export const PALETTE: Record<string, string> = {
  ".": "transparent",
  // Neutral / outline
  "K": "#2b1d14", // deep outline (black-ish)
  "W": "#f6efdc", // highlight / linen white
  // Warm skin
  "s": "#e6c39a",
  "S": "#c99a6c",
  // Hair / beard / brown
  "b": "#7a4a2b",
  "B": "#4a2c18",
  // Robes (linen)
  "l": "#f4e2c1",
  "L": "#d8b98a",
  // Wood / staff
  "w": "#8a5a34",
  "d": "#b48355",
  // Serpents / vegetation (greens)
  "g": "#7fa96b",
  "G": "#4d7a3e",
  "y": "#c5d99a", // light green highlight
  "v": "#4b6832", // dark palm
  // Reds — blood / clay / fire
  "r": "#a12b2b",
  "R": "#e05a48",
  "c": "#c76a4a", // clay
  // Frogs / gnats
  "f": "#83a05a",
  "F": "#4a6b34",
  "n": "#3a2f24", // gnat body
  "N": "#645445",
  // Desert / sand
  "a": "#e9c9a1", // sand light
  "A": "#c69a6c", // sand mid
  "H": "#a17048", // sand shadow / dune line
  // Sky wash
  "k": "#f2d9ae",
  // Stone
  "t": "#c9b090",
  "T": "#9a7f5c",
  // Enemy — bronze soldier
  "z": "#b98550",
  "Z": "#7a5230",
  // Enemy — jackal
  "j": "#4a3628",
  "J": "#2a1e14",
  // Gold / xp
  "o": "#e6c261",
  "O": "#b48836",
  // Nile blue
  "u": "#7fa8b8",
  "U": "#4a7688",
  // Aaron / priest robes (warm red-orange)
  "e": "#d06544",
  "E": "#8f3a26",
  // Miriam / soft rose
  "m": "#d97e8c",
  "M": "#8a4753",
  // Jethro / earthy purple
  "p": "#8a6d9e",
  "P": "#4d3a5c",
};

export type ColorCode = keyof typeof PALETTE;
