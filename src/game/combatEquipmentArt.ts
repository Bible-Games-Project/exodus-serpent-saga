// In-hand art uses the original stick's native pixel scale, never shop images.
// Coordinates are relative to the grip; the hand overlay shares the pivot.
import { drawWeaponPng } from './combatWeaponPng';
import { spearAttack } from './weaponAttack';
const paletteCache: Record<string, string> = {};
function color(token: string): string {
  if (!paletteCache[token]) paletteCache[token] = getComputedStyle(document.documentElement).getPropertyValue(`--equip-${token}`).trim();
  return paletteCache[token];
}

// Smooth, outlined art in the original stick's weight (2-3px shafts, dark wood
// outline) for the weapons whose blocky versions did not fit the game.
type Pal = { fill: string; light: string; dark: string };
const OUT = "#3b2414";
const WOOD: Pal = { fill: "#8a5a32", light: "#b07a46", dark: "#5a3a20" };
const METAL: Record<number, Pal> = {
  1: { fill: "#9aa3ab", light: "#e3e8ec", dark: "#5d656c" },
  2: { fill: "#b9925a", light: "#f0d9a0", dark: "#7a5a2e" },
  3: { fill: "#e0b64a", light: "#fff3c2", dark: "#9a7420" },
};
function smoothShape(ctx: CanvasRenderingContext2D, draw: () => void, fill: string | CanvasGradient, outline = OUT, width = 1.2): void {
  ctx.beginPath(); draw(); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineJoin = "round"; ctx.strokeStyle = outline; ctx.lineWidth = width; ctx.stroke();
}
function handle(ctx: CanvasRenderingContext2D, top: number, bottom: number, w = 2.6): void {
  smoothShape(ctx, () => { ctx.rect(-w / 2, top, w, bottom - top); }, WOOD.fill);
  ctx.fillStyle = WOOD.light; ctx.fillRect(-w / 2 + .5, top + 1, .9, bottom - top - 2);
}
function drawSmoothWeapon(ctx: CanvasRenderingContext2D, id: string, evo: number): boolean {
  const m = METAL[evo] ?? METAL[1];
  ctx.imageSmoothingEnabled = true;
  if (id === "dagger") {
    const blade = [ { fill: "#a9b2b8", light: "#eef2f4", dark: "#5f686e" }, { fill: "#7fae6a", light: "#d7f0c4", dark: "#3f6a34" }, { fill: "#5e9b5a", light: "#c9ffb0", dark: "#2c4f2a" } ][evo - 1] ?? m;
    handle(ctx, -3, 7, 2.6);
    smoothShape(ctx, () => { ctx.moveTo(-2.6, -4); ctx.quadraticCurveTo(-3, -16, 0, -27); ctx.quadraticCurveTo(3, -16, 2.6, -4); }, blade.fill);
    ctx.strokeStyle = blade.light; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(-.6, -6); ctx.lineTo(-.4, -22); ctx.stroke();
    smoothShape(ctx, () => { ctx.ellipse(0, -3.5, 5, 1.6, 0, 0, Math.PI * 2); }, evo === 3 ? METAL[3].fill : WOOD.dark);
    if (evo >= 2) { ctx.fillStyle = evo === 3 ? "#b8ff7a" : "#8fd36e"; ctx.beginPath(); ctx.arc(0, -3.5, 1.1, 0, Math.PI * 2); ctx.fill(); }
    return true;
  }
  if (id === "sword") {
    const len = 36 * ([1, 1.5, 2][evo - 1] ?? 1);
    const tip = -4 - len;
    const blade = evo === 3 ? { fill: "#f0a24a", light: "#fff0b8", dark: "#a8501e" } : evo === 2 ? { fill: "#c9d3dc", light: "#ffffff", dark: "#6e7a86" } : METAL[1];
    if (evo === 3) {
      const g = ctx.createLinearGradient(0, -4, 0, tip);
      g.addColorStop(0, "rgba(255,140,40,0)"); g.addColorStop(1, "rgba(255,190,80,0.45)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, (tip - 4) / 2, 6, -tip / 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    handle(ctx, -3, 8, 2.8);
    smoothShape(ctx, () => { ctx.moveTo(-2.8, -5); ctx.lineTo(-2.6, tip + 7); ctx.lineTo(0, tip); ctx.lineTo(2.6, tip + 7); ctx.lineTo(2.8, -5); }, blade.fill);
    ctx.strokeStyle = blade.light; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-.4, -7); ctx.lineTo(-.3, tip + 8); ctx.stroke();
    smoothShape(ctx, () => { ctx.moveTo(-7, -5.5); ctx.quadraticCurveTo(0, -3, 7, -5.5); ctx.lineTo(7, -3.5); ctx.quadraticCurveTo(0, -1.5, -7, -3.5); }, evo >= 2 ? METAL[3].fill : WOOD.dark);
    smoothShape(ctx, () => { ctx.arc(0, 8.5, 1.8, 0, Math.PI * 2); }, evo >= 2 ? METAL[3].fill : WOOD.dark);
    return true;
  }
  if (id === "axe") {
    const head = [ METAL[1], { fill: "#c08a52", light: "#f3d2a0", dark: "#7a4e26" }, { fill: "#9fb7c9", light: "#f2fbff", dark: "#4d6476" } ][evo - 1] ?? m;
    handle(ctx, -40, 8, 2.8);
    const size = 1 + (evo - 1) * .12;
    ctx.save(); ctx.translate(1, -35); ctx.scale(size, size);
    smoothShape(ctx, () => { ctx.moveTo(0, -5); ctx.lineTo(6, -7); ctx.quadraticCurveTo(13, -6, 13, 1); ctx.quadraticCurveTo(13, 8, 6, 8); ctx.lineTo(0, 5); }, head.fill);
    ctx.strokeStyle = evo === 3 ? METAL[3].light : head.light; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(11.3, -4.5); ctx.quadraticCurveTo(12.2, 1, 11.3, 6); ctx.stroke();
    ctx.fillStyle = head.dark; ctx.fillRect(1, -3, 3, 6);
    ctx.restore();
    return true;
  }
  if (id === "mace") {
    const head = [ METAL[1], { fill: "#b98a4e", light: "#f2d39a", dark: "#6e4c22" }, METAL[3] ][evo - 1] ?? m;
    handle(ctx, -30, 8, 2.8);
    const r = 6 + evo;
    if (evo >= 2) {
      ctx.fillStyle = head.dark;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        smoothShape(ctx, () => { ctx.moveTo(Math.cos(a - .25) * r * .9, -34 + Math.sin(a - .25) * r * .9); ctx.lineTo(Math.cos(a) * (r + 3.2), -34 + Math.sin(a) * (r + 3.2)); ctx.lineTo(Math.cos(a + .25) * r * .9, -34 + Math.sin(a + .25) * r * .9); }, head.light, OUT, .8);
      }
    }
    const g = ctx.createRadialGradient(-2, -37, 1, 0, -34, r);
    g.addColorStop(0, head.light); g.addColorStop(.55, head.fill); g.addColorStop(1, head.dark);
    smoothShape(ctx, () => { ctx.arc(0, -34, r, 0, Math.PI * 2); }, g);
    smoothShape(ctx, () => { ctx.rect(-3.2, -28, 6.4, 2.4); }, head.dark, OUT, .8);
    return true;
  }
  if (id === "ring") {
    const pal = [ METAL[3], { fill: "#b9cde0", light: "#ffffff", dark: "#5b7389" }, { fill: "#ffe48a", light: "#ffffff", dark: "#b88a1e" } ][evo - 1] ?? m;
    if (evo === 3) { ctx.fillStyle = "rgba(255,240,170,0.35)"; ctx.beginPath(); ctx.arc(0, -7, 13, 0, Math.PI * 2); ctx.fill(); }
    ctx.lineWidth = 5.2; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.arc(0, -7, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3.4; ctx.strokeStyle = pal.fill; ctx.beginPath(); ctx.arc(0, -7, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.1; ctx.strokeStyle = pal.light; ctx.beginPath(); ctx.arc(0, -7, 8, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
    if (evo >= 2) for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
      smoothShape(ctx, () => { ctx.arc(Math.cos(a - Math.PI / 2) * 8, -7 + Math.sin(a - Math.PI / 2) * 8, 1.8, 0, Math.PI * 2); }, evo === 3 ? "#8fe8ff" : "#d0485a", OUT, .7);
    }
    return true;
  }
  return false;
}

export function drawCombatEquipment(ctx: CanvasRenderingContext2D, category: "weapon" | "staff", id: string, evolution: number, scale = 1): void {
  ctx.save(); ctx.scale(scale, scale); ctx.imageSmoothingEnabled = false;
  if (category === "weapon" && ["dagger", "sword", "axe", "mace", "ring"].includes(id)) {
    drawWeaponPng(ctx, id, evolution); ctx.restore(); return;
  }
  if (category === "weapon" && drawSmoothWeapon(ctx, id, evolution)) { ctx.restore(); return; }
  const rect = (x: number, y: number, w: number, h: number, token: string) => { ctx.fillStyle = color(token); ctx.fillRect(x, y, w, h); };
  const shape = (points: number[][], token: string) => {
    ctx.fillStyle = color(token); ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();ctx.fill();
  };
  const accent = category === "staff" ? ({ moses:"wood",iron:"iron",crystal:"water",diamond:"ice",bronze:"fire",fire:"red",bush:"fire",waters:"water",light:"light",power:"light" }[id] ?? "wood") : id === "dagger" ? "poison" : evolution >= 3 ? "light" : "iron";
  if (category === "staff") {
    // Slim 2px shafts and small crowns retain the old stick's proportions.
    rect(-1,-43,2,68,id === "iron" ? "iron" : "wood");rect(-1,-40,1,61,"wood-light");
    if (id === "moses") {
      shape([[-1,-42],[1,-47],[5,-50],[8,-49],[9,-46],[7,-44],[6,-46],[4,-47],[2,-44],[1,-41]],"wood");
    } else if (id === "bush") {
      shape([[-1,-40],[-6,-49],[-4,-50],[0,-45],[2,-53],[4,-53],[3,-44],[8,-49],[9,-47],[2,-39]],"wood");
      if(evolution>1) rect(1,-51,2,5,"fire");
    } else {
      shape([[-3,-44],[-4,-49],[0,-54],[4,-49],[3,-44]],accent);
      rect(-3,-49,1,4,"wood-dark");rect(1,-49,2,3,accent);
      rect(-1,-51,1,5,"ice");
      if (id === "waters") rect(-5,-46,3,2,"water");
      if (id === "power") shape([[0,-56],[5,-56],[2,-52],[5,-52],[-1,-46],[1,-51],[-2,-51]],"light");
    }
    if(evolution>1){rect(-2,-32,4,2,accent);rect(-2,-26,4,2,"light");}
    if(evolution>2){rect(-2,-19,4,2,accent);rect(-2,18,4,3,"light");}
  } else if (id === "boomerang") {
    shape([[-2,3],[-13,-8],[-15,-13],[-11,-12],[0,-4],[11,-12],[15,-13],[13,-8],[2,3]],"wood-dark");
    shape([[-1,1],[-12,-8],[-13,-11],[0,-3],[13,-11],[12,-8],[1,1]],"wood");
    shape([[-12,-11],[0,-2],[12,-11],[1,0],[-1,0]],"wood-light");
    if(evolution>=2){shape([[-10,-10],[-7,-8],[-9,-5],[-12,-8]],"red");shape([[7,-8],[10,-10],[12,-8],[9,-5]],"red");}
    if(evolution>=3) rect(-2,-3,4,3,"light");
  } else if (id === "ring") {
    ctx.strokeStyle=color(evolution>=2?"light":"iron");ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-7,8,0,Math.PI*2);ctx.stroke();
    if(evolution>=3){rect(-2,-17,4,2,"ice");rect(8,-8,2,3,"ice");}
  } else {
    const blade = id === "sword" || id === "dagger";
    const extension = id === 'spear' ? spearAttack(evolution).shaft - 38 : 0;
    rect(-1,blade ? -7 : -38 - extension,2,blade ? 14 : 63 + extension,"wood");
    rect(-1,blade ? -5 : -35 - extension,1,blade ? 10 : 55 + extension,"wood-light");
    if (id === "sword" || id === "dagger") {
      const tip=id==="dagger"?-24:-43;
      shape([[-3,-8],[-3,tip+7],[0,tip],[3,tip+7],[3,-8]],accent);rect(-3,tip+8,1,-tip-16,"wood-dark");rect(-1,tip+7,1,-tip-15,"ice");rect(-6,-7,12,2,"wood");rect(-1,4,3,3,"wood");
    } else if (id === "spear" || id === "harpoon") {
      ctx.save(); ctx.translate(0, -extension);
      shape([[-3,-38],[0,-49],[3,-38]],accent);
      rect(-1,-44,1,6,"ice");
      if(id==="harpoon") shape([[1,-43],[6,-39],[3,-35],[3,-39]],"iron");
      ctx.restore();
    } else if (id === "axe") {
      shape([[0,-41],[8,-45],[13,-41],[12,-32],[6,-30],[1,-34]],"wood-dark");
      shape([[2,-40],[8,-43],[11,-40],[10,-33],[6,-32],[3,-35]],accent);rect(9,-39,1,5,"ice");rect(0,-40,3,7,"wood");
    } else if (id === "mace") {
      shape([[-5,-44],[5,-44],[8,-39],[6,-32],[-5,-32],[-8,-38]],"wood-dark");
      shape([[-4,-42],[4,-42],[6,-38],[4,-34],[-4,-34],[-6,-38]],accent);rect(-4,-41,2,5,"ice");rect(2,-37,2,2,"wood-dark");
    }
    if(evolution>=2){rect(-2,-17,4,2,"red");rect(-2,-23,4,2,"red");}
    if(evolution>=3)rect(-2,-28,4,2,"light");
  }
  ctx.restore();
}

export const COMBAT_HEADWEAR = { x: 13, y: 3, width: 13, height: 4 } as const;
export function drawCombatHeadwear(ctx: CanvasRenderingContext2D, id: string, evolution: number, bodyDY: number, scale: number): void {
  // Front hairline only: eyes start below y=7, and hair/body remain untouched.
  const {x,y,width,height}=COMBAT_HEADWEAR;
  const token=id==="abel"?"wood-dark":["cloud","noah","jacobm"].includes(id)?"iron":["bushp","joseph"].includes(id)?"fire":"light";
  ctx.save();ctx.scale(scale,scale);ctx.translate(x,y+bodyDY);
  ctx.fillStyle=color(token);ctx.fillRect(0,1,width,2);ctx.fillRect(2,0,width-4,1);
  ctx.fillStyle=color(id==="abel"?"wood":"ice");ctx.fillRect(3,1,width-5,1);
  if(id!=="abel"){
    ctx.fillStyle=color(token);ctx.fillRect(4,-2,6,3);
    ctx.fillStyle=color(evolution>=2?"light":"ice");ctx.fillRect(6,-1,2,2);
  }
  ctx.restore();
}