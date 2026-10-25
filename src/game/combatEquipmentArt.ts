// In-hand art uses the original stick's native pixel scale, never shop images.
// Coordinates are relative to the grip; the hand overlay shares the pivot.
const paletteCache: Record<string, string> = {};
function color(token: string): string {
  if (!paletteCache[token]) paletteCache[token] = getComputedStyle(document.documentElement).getPropertyValue(`--equip-${token}`).trim();
  return paletteCache[token];
}
export function drawCombatEquipment(ctx: CanvasRenderingContext2D, category: "weapon" | "staff", id: string, evolution: number, scale = 1): void {
  ctx.save(); ctx.scale(scale, scale); ctx.imageSmoothingEnabled = false;
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
    rect(-1,-38,2,63,"wood");rect(-1,-35,1,55,"wood-light");
    if (id === "sword" || id === "dagger") {
      const tip=id==="dagger"?-24:-43;
      shape([[-3,-8],[-3,tip+7],[0,tip],[3,tip+7],[3,-8]],accent);rect(-3,tip+8,1,-tip-16,"wood-dark");rect(-1,tip+7,1,-tip-15,"ice");rect(-6,-7,12,2,"wood");rect(-1,4,3,3,"wood");
      ctx.clearRect(-2,8,4,18);
    } else if (id === "spear" || id === "harpoon") {
      shape([[-3,-38],[0,-49],[3,-38]],accent);
      rect(-1,-44,1,6,"ice");
      if(id==="harpoon") shape([[1,-43],[6,-39],[3,-35],[3,-39]],"iron");
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