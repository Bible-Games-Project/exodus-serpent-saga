import { useEffect, useRef } from "react";

export type PixelArt = { grid: string[]; palette: Record<string, string> };

// Pixel-art house — warm mud-brick walls, dark outline, matching the game palette.
export const HOME_ART: PixelArt = {
  palette: { K: "#2b1d14", c: "#c76a4a", r: "#a12b2b", l: "#f4e2c1", L: "#d8b98a", w: "#8a5a34", o: "#e6c261" },
  grid: [
    ".......KK.......",
    "......KrrK......",
    ".....KrrrrK.....",
    "....KrrrrrrK....",
    "...KrrrrrrrrK...",
    "..KrrrrrrrrrrK..",
    ".KccccccccccccK.",
    ".KllllllllllllK.",
    ".KlLllllllLlllK.",
    ".KllllKKKKllllK.",
    ".KlLllKwwoKlLlK.",
    ".KllllKwwwKlllK.",
    ".KlLllKwwwKlLlK.",
    ".KllllKwwwKlllK.",
    ".KKKKKKKKKKKKKK.",
    "................",
  ],
};

// Pixel-art gear — 8 clearly separated teeth, thick bronze ring, open center hole.
export const GEAR_ART: PixelArt = {
  palette: { K: "#2b1d14", z: "#c8944f", Z: "#8a5f33", W: "#f0dcae" },
  grid: [
    "..................",
    "........KK........",
    "........KK........",
    "...KK.KKZZKK.KK...",
    "...KZKZzzzzZKZK...",
    "....KZzKKKKzZK....",
    "...KZzK....KzZK...",
    "...KzK......KzK...",
    ".KKZzK......KzZKK.",
    ".KKZzK......KzZKK.",
    "...KzK......KzK...",
    "...KZzK....KzZK...",
    "....KZzKKKKzZK....",
    "...KZKZzzzzZKZK...",
    "...KK.KKZZKK.KK...",
    "........KK........",
    "........KK........",
    "..................",
  ],

};


export function PixelIcon({ art, size }: { art: PixelArt; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cnv = ref.current;
    if (!cnv) return;
    const gw = art.grid[0].length;
    const gh = art.grid.length;
    const px = Math.max(1, Math.floor((size * 2) / Math.max(gw, gh)));
    cnv.width = gw * px;
    cnv.height = gh * px;
    const ctx = cnv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const c = art.palette[art.grid[y][x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * px, y * px, px, px);
      }
    }
  }, [art, size]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated" }} />;
}
