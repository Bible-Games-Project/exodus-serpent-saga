import { useEffect, useRef, useState } from "react";
import { AARON, FLY, FROG, GEM, JACKAL, MOSES_NOSTAFF, PALM, PYRAMID, ROCK, SERPENT, SOLDIER, renderSprite, type Sprite } from "./sprites";
import { applyUpgrade, createInitialState, dismissNewNpc, dismissNewPlague, update } from "./engine";
import { PLAGUES } from "./plagues";
import { NPCS } from "./npcs";
import { BONUSES, type BonusKind } from "./bonuses";
import type { Entity, GameState, NpcId, PlagueId, UpgradeChoice } from "./types";

const SPRITE_MAP: Record<string, Sprite> = {
  serpent: SERPENT,
  soldier: SOLDIER,
  jackal: JACKAL,
  frog: FROG,
  fly: FLY,
  gem: GEM,
  bolt: FLY,
  palm: PALM,
  pyramid: PYRAMID,
  rock: ROCK,
  bithiah: AARON,
  aaron: AARON,
  miriam: AARON,
  jethro: AARON,
  zipporah: AARON,
  joshua: AARON,
  hur: AARON,
  elder: AARON,
};

const SCALE = 3;

function makeSandTile(): HTMLCanvasElement {
  // Large, seamless desert tile with dunes, stones and colour variations.
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d")!;
  // Base gradient — warm sand
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, "#eccf9e");
  grd.addColorStop(0.5, "#e2c088");
  grd.addColorStop(1, "#d4a973");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  // Seamless helper: draw with wrap by repeating at ±size on any overflow.
  const drawSeamless = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy);
  };

  // Dunes — soft elongated arcs of lighter and darker sand.
  const dunes = 6;
  for (let i = 0; i < dunes; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const rx = 40 + Math.random() * 60;
    const ry = 8 + Math.random() * 14;
    const light = Math.random() < 0.5;
    drawSeamless((ox, oy) => {
      const grad = g.createRadialGradient(cx + ox, cy + oy, 2, cx + ox, cy + oy, rx);
      grad.addColorStop(0, light ? "rgba(255,235,190,0.35)" : "rgba(120,80,40,0.18)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(cx + ox, cy + oy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    });
  }

  // Subtle colour patches
  for (let i = 0; i < 30; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 12 + Math.random() * 30;
    const tint = Math.random() < 0.5
      ? "rgba(180,140,90,0.10)"
      : "rgba(255,220,170,0.10)";
    drawSeamless((ox, oy) => {
      const grad = g.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
      grad.addColorStop(0, tint);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
    });
  }

  // Fine sand grains
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle = Math.random() < 0.5 ? "rgba(90,60,30,0.10)" : "rgba(255,240,210,0.12)";
    g.fillRect(x, y, 2, 2);
  }

  // Scattered pebbles / small stones (pixel-art clusters, seamless)
  const stones = 14;
  for (let i = 0; i < stones; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const pieces = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < pieces; j++) {
      const dx = (Math.random() - 0.5) * 10;
      const dy = (Math.random() - 0.5) * 6;
      const sw = 2 + Math.floor(Math.random() * 3);
      const sh = 2 + Math.floor(Math.random() * 2);
      drawSeamless((ox, oy) => {
        g.fillStyle = "#7a5c3c";
        g.fillRect(cx + ox + dx, cy + oy + dy, sw, sh);
        g.fillStyle = "#a68356";
        g.fillRect(cx + ox + dx, cy + oy + dy, sw, 1);
      });
    }
  }

  // Wind ripple lines
  for (let i = 0; i < 18; i++) {
    const y = Math.random() * size;
    const len = 20 + Math.random() * 60;
    const x = Math.random() * size;
    g.fillStyle = "rgba(110,80,50,0.12)";
    drawSeamless((ox, oy) => g.fillRect(x + ox, y + oy, len, 1));
  }

  return c;
}


type Props = {
  onGameOver: (info: { level: number; survivalSeconds: number; kills: number }) => void;
  paused: boolean;
  onTogglePause: () => void;
};

export function GameCanvas({ onGameOver, paused, onTogglePause }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(null!);
  const [uiTick, setUiTick] = useState(0);

  useEffect(() => {
    stateRef.current = createInitialState();
    const cnv = canvasRef.current!;
    const ctx = cnv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const sandTile = makeSandTile();

    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (e.key === "Escape" || e.key.toLowerCase() === "p") onTogglePause();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const joystick = { active: false, cx: 0, cy: 0, x: 0, y: 0 };
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      joystick.active = true;
      joystick.cx = t.clientX; joystick.cy = t.clientY;
      joystick.x = t.clientX; joystick.y = t.clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      joystick.x = t.clientX; joystick.y = t.clientY;
    };
    const onTouchEnd = () => { joystick.active = false; };
    cnv.addEventListener("touchstart", onTouchStart, { passive: true });
    cnv.addEventListener("touchmove", onTouchMove, { passive: true });
    cnv.addEventListener("touchend", onTouchEnd);
    cnv.addEventListener("touchcancel", onTouchEnd);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cnv.width = Math.floor(cnv.clientWidth * dpr);
      cnv.height = Math.floor(cnv.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    let raf = 0;
    let uiCounter = 0;
    let gameOverFired = false;

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = stateRef.current;
      let ix = 0, iy = 0;
      if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
      if (keys.has("d") || keys.has("arrowright")) ix += 1;
      if (keys.has("w") || keys.has("arrowup")) iy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) iy += 1;
      if (joystick.active) {
        const jx = joystick.x - joystick.cx;
        const jy = joystick.y - joystick.cy;
        const mag = Math.hypot(jx, jy);
        if (mag > 12) {
          const n = Math.min(1, mag / 60);
          ix = (jx / mag) * n; iy = (jy / mag) * n;
        }
      }
      s.input.x = ix; s.input.y = iy;
      s.paused = paused;
      s.viewport = { w: cnv.clientWidth, h: cnv.clientHeight };

      if (!paused && !s.gameOver && !s.levelUpPending) update(s, dt);

      draw(ctx, cnv, s, sandTile);

      if (s.gameOver && !gameOverFired) {
        gameOverFired = true;
        onGameOver({ level: s.level, survivalSeconds: Math.floor(s.survivalSeconds), kills: s.kills });
      }
      uiCounter++;
      if (uiCounter % 4 === 0) setUiTick((v) => v + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      cnv.removeEventListener("touchstart", onTouchStart);
      cnv.removeEventListener("touchmove", onTouchMove);
      cnv.removeEventListener("touchend", onTouchEnd);
      cnv.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stateRef.current) stateRef.current.paused = paused;
  }, [paused]);

  const s = stateRef.current;
  const pending = s?.levelUpPending ?? null;

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="pixel-crisp block h-full w-full touch-none select-none"
        style={{ background: "#e9c9a1" }}
      />
      {s && (
        <>
          <div className="pointer-events-none absolute inset-0">
            <HUD state={s} tick={uiTick} />
          </div>
          <LoadoutBar
            state={s}
            tick={uiTick}
            onDismissPlague={(id) => { dismissNewPlague(s, id); setUiTick((v) => v + 1); }}
            onDismissNpc={(id) => { dismissNewNpc(s, id); setUiTick((v) => v + 1); }}
          />
          {pending && (
            <LevelUpOverlay
              choices={pending}
              onPick={(c) => { applyUpgrade(s, c); setUiTick((v) => v + 1); }}
            />
          )}
          {paused && !pending && !s.gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
                <h2 className="mb-4 text-3xl">Paused</h2>
                <button
                  onClick={onTogglePause}
                  className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:opacity-90"
                >
                  Resume
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BonusHudIcon({ kind, size }: { kind: BonusKind; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cnv = ref.current;
    if (!cnv) return;
    const art = BONUS_ART[kind];
    const gw = art.grid[0].length;
    const gh = art.grid.length;
    const px = Math.max(1, Math.floor(size / Math.max(gw, gh)));
    cnv.width = gw * px;
    cnv.height = gh * px;
    const ctx = cnv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    for (let ry = 0; ry < gh; ry++) {
      const row = art.grid[ry];
      for (let rx = 0; rx < gw; rx++) {
        const c = art.palette[row[rx]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(rx * px, ry * px, px, px);
      }
    }
  }, [kind, size]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated" }} />;
}

function HUD({ state, tick: _tick }: { state: GameState; tick: number }) {
  const p = state.player;
  const xpPct = Math.min(1, state.xp / state.xpToNext);
  const hpPct = Math.max(0, p.hp / p.maxHp);
  const mins = Math.floor(state.survivalSeconds / 60);
  const secs = Math.floor(state.survivalSeconds % 60);
  const buffs: Array<{ kind: BonusKind; remaining: number }> = [];
  const push = (kind: BonusKind, until?: number) => {
    if (until && state.now < until) buffs.push({ kind, remaining: until - state.now });
  };
  push("shield", state.shieldUntil);
  push("lightning", state.speedBoostUntil);
  push("magnet", state.magnetBoostUntil);
  push("star", state.invulnUntil);

  const notifs = state.notifications ?? [];

  return (
    <>
      <div className="absolute inset-x-0 top-0 h-2 bg-black/20">
        <div className="h-full bg-gold transition-[width] duration-100" style={{ width: `${xpPct * 100}%` }} />
      </div>
      <div className="absolute left-3 top-4 space-y-1 rounded-md bg-black/25 px-3 py-2 text-sm font-semibold text-white">
        <div>Lv. {state.level}</div>
        <div className="text-xs opacity-80">Time {mins}:{secs.toString().padStart(2, "0")}</div>
        <div className="text-xs opacity-80">Kills {state.kills}</div>
      </div>
      <div className="absolute right-3 top-3 w-40">
        <div className="h-2 overflow-hidden rounded bg-black/30">
          <div className="h-full bg-destructive transition-[width] duration-100" style={{ width: `${hpPct * 100}%` }} />
        </div>
        <div className="mt-1 text-right text-xs font-medium text-white/90 drop-shadow">
          {Math.max(0, Math.ceil(p.hp))} / {p.maxHp}
        </div>
        {buffs.length > 0 && (
          <div className="mt-2 flex justify-end gap-1.5">
            {buffs.map((b) => (
              <div
                key={b.kind}
                className="flex flex-col items-center justify-center rounded-md bg-black/55 px-1 pt-1 pb-0.5 text-white shadow-lg ring-1"
                style={{ borderTop: `3px solid ${BONUSES[b.kind].color}` }}
                title={BONUSES[b.kind].name}
              >
                <BonusHudIcon kind={b.kind} size={28} />
                <span className="mt-0.5 text-[10px] font-bold tabular-nums leading-none">
                  {Math.ceil(b.remaining)}s
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating notifications */}
      <div className="pointer-events-none absolute inset-x-0 top-24 flex flex-col items-center gap-1.5">
        {notifs.map((n) => {
          const age = state.now - n.born;
          const life = age / n.ttl;
          const opacity = life < 0.15 ? life / 0.15 : life > 0.75 ? Math.max(0, (1 - life) / 0.25) : 1;
          const translateY = life < 0.15 ? (1 - life / 0.15) * 12 : 0;
          return (
            <div
              key={n.id}
              className="rounded-full px-4 py-1.5 text-sm font-black uppercase tracking-wider text-white shadow-2xl"
              style={{
                background: "rgba(0,0,0,0.72)",
                border: `2px solid ${n.color}`,
                color: n.color,
                opacity,
                transform: `translateY(${translateY}px)`,
                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
              }}
            >
              {n.text}
            </div>
          );
        })}
      </div>
    </>
  );
}

// Loadout bar now only surfaces active companions (unlocked plagues are shown
// via floating notifications when acquired, not as a permanent list).
function LoadoutBar({ state, tick: _tick, onDismissPlague: _p, onDismissNpc }: {
  state: GameState; tick: number;
  onDismissPlague: (id: PlagueId) => void;
  onDismissNpc: (id: NpcId) => void;
}) {
  const npcs = Array.from(state.npcs.keys());
  if (npcs.length === 0) return null;
  return (
    <div className="absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
      {npcs.map((id) => (
        <LoadoutPill key={id} isNew={state.newNpcs.has(id)} title={NPCS[id].name} subtitle="Companion" tone="ally" onClick={() => onDismissNpc(id)} />
      ))}
    </div>
  );
}

function LoadoutPill({ isNew, title, subtitle, tone, onClick }: {
  isNew: boolean; title: string; subtitle: string; tone: "plague" | "ally"; onClick: () => void;
}) {
  const toneCls = tone === "plague" ? "border-primary/50 bg-black/40 text-white" : "border-gold/50 bg-black/40 text-white";
  return (
    <button
      onClick={onClick}
      className={`pointer-events-auto relative flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold shadow ${toneCls} ${isNew ? "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/30" : ""}`}
      title={isNew ? "New! Click to acknowledge" : title}
    >
      <span className="max-w-[110px] truncate">{title}</span>
      <span className="opacity-70">·</span>
      <span className="opacity-90">{subtitle}</span>
      {isNew && (
        <span className="absolute -right-1.5 -top-2 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none tracking-wider text-black shadow" style={{ animation: "exodus-new-bounce 0.9s ease-in-out infinite" }}>
          NEW
        </span>
      )}
    </button>
  );
}


// ------------- Pixel-art icon library for the Level-Up cards -------------
// Each icon is a small string-grid on a shared palette. `.` = transparent.
// Icons are rendered on a transparent canvas — no background, no gradient.
const ICON_PAL: Record<string, string> = {
  ".": "transparent",
  // Neutral
  K: "#1a1410",  // deep outline
  k: "#3a2b1e",  // soft outline
  W: "#f6efdc",  // linen white
  // Wood / staff
  w: "#5a3820", d: "#8a5a34", D: "#b48355", t: "#e4b98a",
  // Greens (serpent / frog / livestock / locust)
  v: "#2f4a1a", g: "#4d7a3e", G: "#7fa96b", y: "#c5d99a",
  // Reds (blood / fire / heart)
  r: "#7a1f24", R: "#c93a3a", H: "#ff6a6a", h: "#ffb0b8",
  // Fire yellows / gold
  o: "#c9700a", O: "#e6c261", Y: "#ffe694",
  // Blues (hail / speed / water shallow)
  b: "#1e3a72", B: "#3060c0", L: "#8ec8ff", V: "#d6ecff",
  // Insects / darkness
  n: "#2a2018", N: "#5a4a3a",
  // Purples (boils / darkness / firstborn)
  p: "#2f223e", P: "#6b5482", Q: "#b8a5c9",
  // Skin
  s: "#c99a6c", S: "#e6c39a",
  // Deep water
  u: "#1a3a5a", U: "#2f6a90", z: "#66b0c8",
  // Bone / robe
  c: "#e0d5b8", C: "#a89876",
  // Rose / cloth accents
  m: "#c94e6a", M: "#7a2a3a",
};

// Higher-resolution 20×20 blessing icons (~2× the previous 12×12 grid).
// Rendered at the same on-screen size, so the extra pixels buy detail and
// smoother silhouettes without changing card layout.
const ICON_PLAGUE: Partial<Record<PlagueId, string[]>> = {
  staff: [
    "....................",
    ".......ktDDDDk......",
    "......kdDDddDDk.....",
    "......kdDk..kdDk....",
    ".....kdDk....kdDk...",
    ".....kdDk....kdDk...",
    "......kdDk..kdDk....",
    ".......kdDDDDk......",
    "........kdDk........",
    "........kdDk........",
    "........kdDk........",
    "........kdDk........",
    "........kdDk........",
    "........kdDk........",
    "........kdDk........",
    "........kdDk........",
    "........kdDk........",
    "........kdDk........",
    "........kwwk........",
    "........kKKk........",
  ],
  serpent: [
    "....................",
    "...vvvvvv...........",
    "..vGGGGGGv..........",
    "..vGWKGGGvRR........",
    "..vGGGGGGvR.........",
    "..vGyGGvvv..........",
    "...vGGGv............",
    "....vGGGvvvv........",
    ".....vGGGGGGvv......",
    "......vvGGGGGGv.....",
    "........vvGGGGv.....",
    "..........vGGGv.....",
    ".........vGGGv......",
    "........vGGGv.......",
    ".......vGGGv........",
    "......vGGGvvvvvv....",
    ".....vGGGGGGGGGv....",
    ".....vGGyGGGGGGGv...",
    "......vvvvvvvvvvv...",
    "....................",
  ],
  blood: [
    ".........R..........",
    "........RRR.........",
    ".......RHHR.........",
    ".......RHhR.........",
    "........RRR.........",
    ".......RRR..........",
    "......RRR...........",
    "....RRRRRRR.........",
    "...RHHHHHHHR........",
    "..RHHhhhhhHHR.......",
    ".RHHhhWWhhhHHR......",
    ".RHhhWWWWhhhHR......",
    "RHHhhhhhhhhhHHR.....",
    "RHhhhhWWhhhhHHR.....",
    ".RHHhhhhhhhhHR......",
    ".RHHHhhhhhhHHR......",
    "..RHHHhhhhhHHR......",
    "...RHHHHHHHHR.......",
    "....RHHHHHHR........",
    ".....RRRRRR.........",
  ],
  frogs: [
    "....gGGGGGGGGGg.....",
    "...gGGGGGGGGGGGg....",
    "..gGWWGGGGGGWWGGg...",
    "..gGKWGGGGGGKWGGg...",
    "..gGGGGGGGGGGGGGg...",
    "..gGGGGGWWGGGGGGg...",
    "...gGGGGWWGGGGGg....",
    "....gGGGGGGGGGg.....",
    "...gGGGGGGGGGGGg....",
    "..gGGGGGGGGGGGGGg...",
    ".vGGGGGGGGGGGGGGGv..",
    ".vGGGGGGGGGGGGGGGv..",
    "..vGGGGGGGGGGGGGv...",
    "...vGGGGGGGGGGGv....",
    "....vGGGGGGGGGv.....",
    "...v..vGGGGGv...v...",
    "..v.....vvv......v..",
    ".v...............v..",
    "K.................K.",
    "K.................K.",
  ],
  gnats: [
    "....NnNnNnNnNn......",
    "...nNnNnNnNnNnN.....",
    "..NnNnNnNnNnNnNn....",
    ".nNnNnNnNnNnNnNnN...",
    "NnNnNnNnNnNnNnNnNn..",
    "nNnNnNnNnNnNnNnNnN..",
    "NnNnNnNnNnNnNnNnNnN.",
    "nNnNnNnNnNnNnNnNnNn.",
    "NnNnNnNnNnNnNnNnNnN.",
    "nNnNnNnNnNnNnNnNnNn.",
    "NnNnNnNnNnNnNnNnNnN.",
    "nNnNnNnNnNnNnNnNnNn.",
    "NnNnNnNnNnNnNnNnNnN.",
    "nNnNnNnNnNnNnNnNnNn.",
    ".NnNnNnNnNnNnNnNnN..",
    "..nNnNnNnNnNnNnN....",
    "...NnNnNnNnNnNn.....",
    "....nNnNnNnNnN......",
    ".....NnNnNnNn.......",
    "......nNnNn.........",
  ],
  flies: [
    "....................",
    "....W.W.............",
    "...WNnnNW...........",
    "....nnnn............",
    ".....K..............",
    ".....K..............",
    "....................",
    "..............W.W...",
    ".............WNnnNW.",
    "..............nnnn..",
    "...............K....",
    "...............K....",
    "....................",
    "....W.W.............",
    "...WNnnNW...........",
    "....nnnn............",
    ".....K..............",
    ".....K..............",
    "....................",
    "....................",
  ],
  livestock: [
    "...gg..........gg...",
    "..gGGg........gGGg..",
    "..gGGg........gGGg..",
    ".gGGGGGGGGGGGGGGGg..",
    "gGGGGGGGGGGGGGGGGGg.",
    "gGGgGGGGGGGGGGGgGGg.",
    "gGg.gGWWGGGWWGg.gGg.",
    "gGg.gGKWGGGKWGg.gGg.",
    "gGg.gGGGGGGGGGg.gGg.",
    "gGg..gGGGGGGGg..gGg.",
    "gGgg..gGGWGGg..ggGg.",
    ".gGgg..gGGGg..ggGg..",
    "..gGGgg.gGg.ggGGg...",
    "...gGGGGGGGGGGGg....",
    "...gGGgggggggGGg....",
    "...gG...gg....Gg....",
    "...gG...gg....Gg....",
    "....gg..KK...gg.....",
    ".....K..KK..K.......",
    ".....KKKKKKKK.......",
  ],
  boils: [
    "....................",
    "....pPPp....pPPp....",
    "...pPQQPp..pPQQPp...",
    "..pPQWWQPp.pPQWWQp..",
    "..pPQWWQPp.pPQWWQp..",
    "...pPQQPp..pPQQPp...",
    "....pPPp....pPPp....",
    "....................",
    "........pPPp........",
    ".......pPQQPp.......",
    "......pPQWWQPp......",
    "......pPQWWQPp......",
    ".......pPQQPp.......",
    "........pPPp........",
    "....................",
    "....pPPp....pPPp....",
    "...pPQQPp..pPQQPp...",
    "..pPQWWQPp.pPQWWQp..",
    "..pPQWWQPp.pPQWWQp..",
    "...pPQQPp..pPQQPp...",
  ],
  hail: [
    "....................",
    "......LLBBL.........",
    ".....LWBBBBL........",
    "....LWWBBBBBL.......",
    ".....LBBBBBL........",
    "......LBBBL.........",
    ".........LLBBL......",
    "........LWBBBBL.....",
    ".......LWWBBBBBL....",
    "........LBBBBBL.....",
    ".........LBBBL......",
    "...LLBBL............",
    "..LWBBBBL...........",
    ".LWWBBBBBL..........",
    "..LBBBBBL...........",
    "...LBBBL............",
    ".........LLBBL......",
    "........LWBBBBL.....",
    ".......LWWBBBBBL....",
    "........LBBBBBL.....",
  ],
  fire: [
    "......ooo...........",
    ".....ooOOo..........",
    ".....oOOOOo.........",
    "....roOOYOor........",
    "....rOOYYOOr........",
    "...rROoYYoORr.......",
    "...rROoOOoORr.......",
    "..rRRoOOoORRRr......",
    "..rRRRoOoRRRRRr.....",
    ".rRRRRRoRRRRRRr.....",
    ".rHRRRRRRRRRHRr.....",
    "rRHHRRRRRRRRHHRr....",
    "rRRHHRRRRRRHHRRr....",
    ".rRRRHRRRRHRRRRr....",
    ".rrrRRRRRRRRRrr.....",
    "..rrrRRRRRRrrr......",
    "...rrrRRRrrr........",
    "....rrrrrr..........",
    ".....rrrr...........",
    "......rr............",
  ],
  locusts: [
    "....................",
    "....................",
    ".....gGGGGGGGGGg....",
    "....gGGGGGGGGGGGg...",
    "...gGGyyyyyyyGGGg...",
    "...gGGyWWWWWyGGGg...",
    "...gGGyKKKKKyGGGg...",
    "....gGGyyyyyGGGg....",
    ".....gGGGGGGGGg.....",
    "..vgGGGGGGGGGGGgv...",
    ".vGGGGGGGGGGGGGGGv..",
    "vGGGGgGGGGGGGgGGGGv.",
    "vGGGgggGGGGGgggGGGv.",
    ".vGgg.gGGGGGg.ggGv..",
    "..vG.gGGGGGGGg.Gv...",
    "...vgGGGGGGGGGgv....",
    "....gGGGGGGGGGg.....",
    ".....vGGGGGGGv......",
    "......vGGGGGv.......",
    ".......vggggv.......",
  ],
  darkness: [
    "....................",
    ".......pPPPp........",
    ".....pPPPPPPPp......",
    "....pPPPPKKKPPp.....",
    "...pPPPKKKKKKKp.....",
    "..pPPPKKKKKKKKp.....",
    "..pPPKKKKKKKKKp.....",
    ".pPPPKKKKKKKKKp.....",
    ".pPPKKKKKKKKKKp.....",
    ".pPPKKKKKKKKKKp.....",
    ".pPPKKKKKKKKKKp.....",
    ".pPPKKKKKKKKKKp.....",
    ".pPPKKKKKKKKKp......",
    "..pPPKKKKKKKKp......",
    "..pPPPKKKKKKKp......",
    "...pPPPKKKKKKp......",
    "....pPPPPKKKKp......",
    ".....pPPPPPPPp......",
    ".......pPPPp........",
    "....................",
  ],
  firstborn: [
    "....................",
    "......cccccc........",
    "....ccWWWWWWcc......",
    "...cWWWWWWWWWWc.....",
    "..cWWWWWWWWWWWWc....",
    "..cWWKKKcccKKWWc....",
    "..cWWKKKcccKKWWc....",
    "..cWWKKKcccKKWWc....",
    "..cWWKKKcccKKWWc....",
    "..cWWWWccccWWWWc....",
    "...cWWccKKccWWc.....",
    "....cWccKKccWc......",
    ".....cccccccc.......",
    "......cCCCCc........",
    ".....cCCCCCCc.......",
    "....cCCCCCCCCc......",
    "....cCCCCCCCCc......",
    "....K.CCCCCC.K......",
    "....K.CCCCCC.K......",
    ".....K......K.......",
  ],
  pillar: [
    "........OYO.........",
    ".......OoYoO........",
    ".......oYYYo........",
    "......oOYYYOo.......",
    "......oYYYYYo.......",
    ".....OoYYWYYoO......",
    ".....OoYYWYYoO......",
    ".....OoYWWWYoO......",
    ".....OoYYWYYoO......",
    "....OoOYYYYYoOO.....",
    "....OoOYYYYYOoO.....",
    ".....OoOYYYOoO......",
    "......oOOOoOo.......",
    ".......oooo.........",
    "........oo..........",
    "........oo..........",
    ".......CCCC.........",
    "......CCCCCC........",
    "......CCCCCC........",
    ".......CCCC.........",
  ],
  redsea: [
    "uUuUuUuUuUuUuUuUuUuU",
    "UuUuUuUuUuUuUuUuUuUu",
    "uUuUuUuUuUuUuUuUuUuU",
    "bBbBbBbBbBbBbBbBbBbB",
    "BLBLBLBLBLBLBLBLBLBL",
    "LVLVLVLVLVLVLVLVLVLV",
    "VW.VW.VW.VW.VW.VW.VW",
    "W.WV.W.WV.W.WV.WV.WV",
    "u..............aa..U",
    "Uu............aAAa.u",
    "UUu..........aAAAAaU",
    "UuUu........aAAAAAAU",
    "uUuUu......aAAAAAAAA",
    "bBbBbBbBbBbBbBbBbBbB",
    "BLBLBLBLBLBLBLBLBLBL",
    "VLBBBBBBBBBBBBBBBBLV",
    "VLBBBBBBBBBBBBBBBBLV",
    "VVLLLLLLLLLLLLLLLLVV",
    "....................",
    "....................",
  ],
};

const ICON_PASSIVE: Record<string, string[]> = {
  maxHp: [
    "....................",
    "....RRRR....RRRR....",
    "...RHHHHRRRRHHHHR...",
    "..RHhhhHHHHhhhhhHR..",
    ".RHhhWhhHHHHhhWhhHR.",
    ".RHhWWhhhhhhhhWWhHR.",
    "RHhhhhhhhhhhhhhhhHR.",
    "RHHhhhhhhhhhhhhhhHR.",
    "RHHhhhhhhhhhhhhhhHR.",
    ".RHHhhhhhhhhhhhhHR..",
    ".RHHHhhhhhhhhhhHR...",
    "..RHHhhhhhhhhhHR....",
    "...RHHhhhhhhhHR.....",
    "....RHHhhhhhHR......",
    ".....RHHhhhHR.......",
    "......RHHhHR........",
    ".......RHHR.........",
    "........RR..........",
    "........R...........",
    "....................",
  ],
  // Sandals of Haste — represented by an unmistakable lightning bolt.
  speed: [
    "....................",
    "..........KKKK......",
    ".........KYYYK......",
    "........KYYYOK......",
    ".......KYYYOOK......",
    "......KYYYOOK.......",
    ".....KYYYOOK........",
    "....KYYWOOKKKKK.....",
    "...KYYWOOYYYYYK.....",
    "...KYWOOYYYYOOK.....",
    "...KKKKKKYYOOK......",
    ".......KYYOOK.......",
    "......KYYOOK........",
    ".....KYYOOK.........",
    "....KYYOOK..........",
    "...KYYOOK...........",
    "...KYOOK............",
    "...KOOK.............",
    "....KK..............",
    "....................",
  ],
  damage: [
    "....................",
    "................ktD.",
    "...............ktWD.",
    "..............ktWDD.",
    ".............ktWDD..",
    "............ktWDD...",
    "...........ktWDD....",
    "..........ktWDD.....",
    ".........ktWDD......",
    "........ktWDD.......",
    ".......ktWDD........",
    "......ktWDD.........",
    ".....ktWDD..........",
    "....ktWDD...........",
    "...ktWDD............",
    "..ktKtD.............",
    ".KKKKK..............",
    "KwwwK...............",
    "KwwK................",
    "KK..................",
  ],
  // Voice That Calls — classic red horseshoe magnet with metallic poles.
  magnet: [
    "....................",
    "......KKKKKK........",
    "....KKRRRRRRKK......",
    "...KRRHHHHHHRRK.....",
    "..KRHHRRRRRRHHRK....",
    "..KRHHRKKKKRHHRK....",
    "..KRHHRK..KRHHRK....",
    "..KRHHRK..KRHHRK....",
    "..KRHHRK..KRHHRK....",
    "..KRHHRK..KRHHRK....",
    "..KRHHRK..KRHHRK....",
    "..KRHHRK..KRHHRK....",
    "..KRHHRK..KRHHRK....",
    "..KKKKKK..KKKKKK....",
    "..KWWWWK..KWWWWK....",
    "..KWWWWK..KWWWWK....",
    "..KCCCCK..KCCCCK....",
    "..KKKKKK..KKKKKK....",
    "....................",
    "....................",
  ],
};

// Companion portraits — 20×20, matching Moses' pixel density. Each has a
// distinct headwear silhouette + robe palette so silhouettes read quickly.
const ICON_NPC: Record<NpcId, string[]> = {
  bithiah: [
    "....................",
    "......OYYYYYYO......",
    ".....OYYYYYYYYO.....",
    "....OYYOooooOYYO....",
    "....kSSSssssSSSk....",
    "...kSSKssssKssSSk...",
    "...kSSssssssssSSk...",
    "...kSSssWWssssSSk...",
    "...kSSsssssssSSSk...",
    "....kSSSSSSSSSk.....",
    ".....kSSSSSSSk......",
    ".....MMmmmmMMm......",
    "....MmmmmmmmmmM.....",
    "...Mmmmmmmmmmmmm....",
    "...M.MMmmmmMM..M....",
    "...M....MM.....M....",
    "...K....KK.....K....",
    "...K....KK.....K....",
    "...K....KK.....K....",
    "....................",
  ],
  aaron: [
    "....................",
    "....kkkkkkkkkk......",
    "...kwwwwwwwwwwk.....",
    "...kSSssssssSSk.....",
    "...kSKssssssKSk.....",
    "...kSsssWWsssSk.....",
    "....kSSssssSSk......",
    ".....kSSSSSSk.......",
    "....RRRRRRRRRR......",
    "...RRoRRRRRRoRR.....",
    "...RRRRRRRRRRRR.....",
    "...RRoOOOOOOoRR.....",
    "...RRRRRRRRRRRR.....",
    "...RRoRRRRRRoRR.....",
    "...RRRRRRRRRRRR.....",
    "....RR......RR......",
    "....K........K......",
    "....K........K......",
    "....K........K......",
    "....................",
  ],
  miriam: [
    "....................",
    "....bbbbbbbbbb......",
    "...bLLLLLLLLLLb.....",
    "...kSSssssssSSk.....",
    "...kSKssssssKSk.....",
    "...kSsssWWsssSk.....",
    "....kSSssssSSk......",
    ".....kSSSSSSk.......",
    "....mmmmmmmmmm......",
    "...mmMmmmmmmMmm.....",
    "...bLLLLLLLLLLb.....",
    "..bBLLLLLLLLLLBb....",
    "..bBLLLVVVLLLLBb....",
    "..bBLLLVVVLLLLBb....",
    "..bBLLLLLLLLLLBb....",
    "...bBLLLLLLLLBb.....",
    "....BBBBBBBBBB......",
    "....K........K......",
    "....K........K......",
    "....................",
  ],
  jethro: [
    "....................",
    "....cccccccccc......",
    "...cWWWWWWWWWWc.....",
    "...kSSssssssSSk.....",
    "...kSKssssssKSk.....",
    "...kSsssWWssWWSk....",
    "....kSWWssWWSSk.....",
    ".....kWWSSSWWk......",
    "....KKKKKKKKKK......",
    "...KwwddDdDdwwK.....",
    "...KwddDDDDDDwK.....",
    "....KKKKKKKKKK......",
    "....cCCCCCCCCc......",
    "...cCCCCCCCCCCc.....",
    "...cCCCCCCCCCCc.....",
    "...cCCCCCCCCCCc.....",
    "....CCCCCCCCCC......",
    "....K........K......",
    "....K........K......",
    "....................",
  ],
  zipporah: [
    "....................",
    "....gGGGGGGGGGg.....",
    "...gGGGGGGGGGGGg....",
    "...kSSssssssSSk.....",
    "...kSKssssssKSk.....",
    "...kSsssWWsssSk.....",
    "....kSSssssSSk......",
    ".....kSSSSSSk.......",
    "....vggggggggv......",
    "...vgGGGGGGGGgv.....",
    "...vGGGyyyyGGGv.....",
    "...vGGyyWWyyGGv.....",
    "...vGGyyWWyyGGv.....",
    "...vGGGyyyyGGGv.....",
    "...vgGGGGGGGGgv.....",
    "....vvggggggvv......",
    "....vvvvvvvvvv......",
    "....K........K......",
    "....K........K......",
    "....................",
  ],
  joshua: [
    "....................",
    "....KKKKKKKKKK......",
    "...KzzzzzzzzzzK.....",
    "...kSSssssssSSk.....",
    "...kSKssssssKSk.....",
    "...kSsssWWsssSk.....",
    "....kSSssssSSk......",
    ".....kSSSSSSk.......",
    "d....KKKKKKKKKK....d",
    ".d..KzzzzzzzzzzK..d.",
    "..d.KzWWzzzzzzWzK.d.",
    "...dKzzzzzzzzzzzKd..",
    "....KKKKKKKKKKKK....",
    ".....dkKKKKKKkd.....",
    "......dKKKKKKd......",
    ".......dKKKKd.......",
    "........KKKK........",
    "........K..K........",
    "........K..K........",
    "....................",
  ],
  hur: [
    "....................",
    "....kkkkkkkkkk......",
    "...kbbbbbbbbbbk.....",
    "...kSSssssssSSk.....",
    "...kSKssssssKSk.....",
    "...kSsssWWsssSk.....",
    "....kSSssssSSk......",
    ".....kSSSSSSk.......",
    "....OOOOOOOOOO......",
    "...OoYYYYYYYYoO.....",
    "...OoOOOOOOOOoO.....",
    "...OoYYYYYYYYoO.....",
    "...OoOOOOOOOOoO.....",
    "...OoYYYYYYYYoO.....",
    "...OoOOOOOOOOoO.....",
    "....OOOOOOOOOO......",
    ".....OOOOOOOO.......",
    "....K........K......",
    "....K........K......",
    "....................",
  ],
  elder: [
    "....................",
    "....WWWWWWWWWW......",
    "...WWWWWWWWWWWW.....",
    "...kSSssssssSSk.....",
    "...kSKssssssKSk.....",
    "...kSsWWssWWssSk....",
    "....kSWWSSWWSSk.....",
    ".....kSSSSSSSk......",
    "....WWWWWWWWWW......",
    "...WWCCCCCCCCWW.....",
    "...WCCCCCCCCCCW.....",
    "...WCCCCCCCCCCW.....",
    "...WCCCCCCCCCCW.....",
    "...WCCCCCCCCCCW.....",
    "...WCCCCCCCCCCW.....",
    "....CCCCCCCCCC......",
    ".....CCCCCCCC.......",
    "....K........K......",
    "....K........K......",
    "....................",
  ],
};



function drawPixelIcon(cnv: HTMLCanvasElement, grid: string[], scale: number) {
  const w = grid[0].length;
  const h = grid.length;
  cnv.width = w * scale;
  cnv.height = h * scale;
  const ctx = cnv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cnv.width, cnv.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      const c = ICON_PAL[ch];
      if (!c || c === "transparent") continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function PixelIcon({ grid, size = 64 }: { grid: string[]; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPixelIcon(ref.current, grid, Math.floor(size / grid.length));
  }, [grid, size]);
  return <canvas ref={ref} className="pixel-crisp" style={{ imageRendering: "pixelated", width: size, height: size }} />;
}

function iconGridFor(c: UpgradeChoice): string[] {
  if (c.npc) return ICON_NPC[c.npc];
  if (c.plague && ICON_PLAGUE[c.plague]) return ICON_PLAGUE[c.plague]!;
  const m = /^passive-([a-zA-Z]+)-/.exec(c.id);
  if (m && ICON_PASSIVE[m[1]]) return ICON_PASSIVE[m[1]];
  return ICON_PASSIVE.damage;
}

function LevelUpOverlay({ choices, onPick }: { choices: UpgradeChoice[]; onPick: (c: UpgradeChoice) => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="max-w-3xl w-[92%] rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="mb-1 text-center text-2xl">Level Up!</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">Choose your blessing</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {choices.map((c) => {
            const grid = iconGridFor(c);
            return (
              <button key={c.id} onClick={() => onPick(c)}
                className="group relative rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-1 hover:border-primary hover:bg-secondary">
                {c.isUnlock && (
                  <span className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow ${c.isCompanion ? "bg-sky-400 text-white" : "bg-yellow-400 text-black"}`} style={{ animation: "exodus-new-bounce 0.9s ease-in-out infinite" }}>
                    NEW
                  </span>
                )}
                <div className="mb-3 flex h-20 items-center justify-center">
                  <PixelIcon grid={grid} size={72} />
                </div>
                <div className="mb-2 text-sm font-bold text-primary">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.description}</div>
                {c.scripture && (
                  <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] italic leading-snug text-foreground/80">
                    {c.scripture}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}



// ---------------- drawing ----------------
function draw(ctx: CanvasRenderingContext2D, cnv: HTMLCanvasElement, s: GameState, sandTile: HTMLCanvasElement) {
  const w = cnv.width;
  const cam = s.camera;
  const dpr = w / cnv.clientWidth;
  const viewW = cnv.clientWidth;
  const viewH = cnv.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);

  // ---- Infinite-world wrap: temporarily shift every entity so its position
  // is expressed in the wrap-copy nearest to the camera. All draw routines
  // are unchanged; positions are restored at the end of this function. ----
  const worldW = s.worldW, worldH = s.worldH;
  const origs: Array<[number, number, number]> = [];
  for (const e of s.entities.values()) {
    origs.push([e.id, e.pos.x, e.pos.y]);
    e.pos.x = e.pos.x - Math.round((e.pos.x - cam.x) / worldW) * worldW;
    e.pos.y = e.pos.y - Math.round((e.pos.y - cam.y) / worldH) * worldH;
  }

  // Screen shake offset applied via translate.
  const shake = s.screenShake ?? 0;
  const shX = shake ? (Math.random() - 0.5) * shake : 0;
  const shY = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(shX, shY);

  // Seamless ground: 1:1 scroll (no parallax) so wrapping the world never
  // causes a visible jump. World dimensions are a multiple of tileSize.
  const tileSize = 256;
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  const offX = -mod(cam.x, tileSize);
  const offY = -mod(cam.y, tileSize);
  for (let y = offY - tileSize; y < viewH + tileSize; y += tileSize) {
    for (let x = offX - tileSize; x < viewW + tileSize; x += tileSize) {
      ctx.drawImage(sandTile, x, y);
    }
  }

  const grd = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.2, viewW / 2, viewH / 2, viewH * 0.9);
  grd.addColorStop(0, "rgba(255,220,170,0)");
  grd.addColorStop(1, "rgba(140,80,40,0.28)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, viewW, viewH);

  const camX = cam.x - viewW / 2;
  const camY = cam.y - viewH / 2;


  // 1) Ground pass — blood pools + Ramses landing telegraph + red-sea burst.
  for (const e of s.entities.values()) {
    if (e.kind === "bloodpool") {
      const canvas = e.data?.canvas as HTMLCanvasElement | undefined;
      if (!canvas) continue;
      const maxTtl = (e.data?.maxTtl as number) ?? 3;
      const alpha = Math.min(1, (e.ttl ?? 0) / maxTtl) * 0.9 + 0.1;
      ctx.globalAlpha = Math.min(1, alpha);
      const cx = Math.round(e.pos.x - camX - canvas.width / 2);
      const cy = Math.round(e.pos.y - camY - canvas.height / 2);
      ctx.drawImage(canvas, cx, cy);
      ctx.globalAlpha = 1;
    }
    if (e.kind === "ramses") drawRamsesTelegraph(ctx, e, camX, camY);
  }

  // 2) Depth-sorted pass
  const drawList: Entity[] = [];
  let staffSwinging = false;
  for (const e of s.entities.values()) {
    if (e.kind === "bloodpool") continue;
    if (e.kind === "staffswing") staffSwinging = true;
    drawList.push(e);
  }
  drawList.sort((a, b) => a.pos.y - b.pos.y);

  for (const e of drawList) {
    if (e.kind === "staffswing") { drawStaffSwing(ctx, e, s, camX, camY); continue; }
    if (e.kind === "companionmelee") { drawCompanionMelee(ctx, e, camX, camY); continue; }
    if (e.kind === "bolt") { drawBolt(ctx, e, camX, camY); continue; }
    if (e.kind === "gnatswarm") { drawGnatSwarm(ctx, e, camX, camY); continue; }
    if (e.kind === "livestockcloud") { drawParticleCloud(ctx, e, camX, camY, { backing: "rgba(60,110,40,0.9)", particle: "#2f4a1a", highlight: "#8ab24a" }); continue; }
    if (e.kind === "boilscloud") { drawBoilsCloud(ctx, e, camX, camY); continue; }
    if (e.kind === "firstborncloud") { drawFirstbornCloud(ctx, e, camX, camY); continue; }
    if (e.kind === "locustswarm") { drawLocustSwarm(ctx, e, camX, camY); continue; }
    if (e.kind === "hailstone") { drawHailstone(ctx, e, camX, camY); continue; }
    if (e.kind === "hailimpact") { drawHailImpact(ctx, e, camX, camY); continue; }
    if (e.kind === "fireball") { drawFireball(ctx, e, camX, camY); continue; }
    if (e.kind === "fireexplosion") { drawFireExplosion(ctx, e, camX, camY); continue; }
    if (e.kind === "redseawall") { drawRedSeaWall(ctx, e, camX, camY); continue; }
    if (e.kind === "redseaburst") { drawRedSeaBurst(ctx, e, camX, camY); continue; }
    if (e.kind === "throne") { drawThrone(ctx, e, camX, camY); continue; }
    if (e.kind === "arrow" || e.kind === "spear_e" || e.kind === "magebolt" || e.kind === "flamingspear") { drawEnemyProjectile(ctx, e, camX, camY); continue; }
    if (e.kind?.startsWith("bonus_")) { drawBonus(ctx, e, camX, camY, s); continue; }
    if (e.kind === "moses") { drawMoses(ctx, e, s, camX, camY, staffSwinging); continue; }
    if (e.kind === "ramses") { drawRamses(ctx, e, camX, camY, s); continue; }

    // Programmatic enemy renderers
    if (drawProceduralEnemy(ctx, e, camX, camY)) continue;

    // Companions (allies) draw with per-npc procedural style + attack animation
    if (e.team === "ally" && drawCompanion(ctx, e, camX, camY, s)) continue;

    // Fallback: sprite-based rendering
    drawSpriteEntity(ctx, e, camX, camY, s);
  }


  // 3) Darkness overlay
  const dEnd = s.darknessUntil ?? 0;
  if (dEnd > s.now) {
    const dur = s.darknessDur ?? 5;
    const start = s.darknessStart ?? (dEnd - dur);
    const elapsed = s.now - start;
    const remaining = dEnd - s.now;
    const fade = 0.6;
    let k = 1;
    if (elapsed < fade) k = elapsed / fade;
    else if (remaining < fade) k = remaining / fade;
    k = Math.max(0, Math.min(1, k));
    const alpha = 0.88 * k;
    const px = s.player.pos.x - camX;
    const py = s.player.pos.y - camY;
    const holeR = 70;
    const outerR = Math.hypot(viewW, viewH);
    const g = ctx.createRadialGradient(px, py, holeR * 0.35, px, py, outerR);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(holeR / outerR, `rgba(0,0,0,${alpha * 0.5})`);
    g.addColorStop(Math.min(0.5, (holeR * 2) / outerR), `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
    const lamp = ctx.createRadialGradient(px, py, 0, px, py, holeR);
    lamp.addColorStop(0, `rgba(255,200,120,${0.25 * k})`);
    lamp.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  // 4) Screen flash overlay
  const flash = s.screenFlash ?? 0;
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.8})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  // 5) Invulnerability aura around Moses
  if (s.now < (s.invulnUntil ?? 0)) {
    const px = s.player.pos.x - camX;
    const py = s.player.pos.y - camY;
    const t = s.now * 8;
    ctx.strokeStyle = `rgba(255,220,80,${0.6 + Math.sin(t) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py - 4, 28, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Restore original entity positions (see wrap block at top of draw).
  for (const [id, ox, oy] of origs) {
    const e = s.entities.get(id);
    if (e) { e.pos.x = ox; e.pos.y = oy; }
  }
}


// ---------------- Moses ----------------
function drawMoses(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, camX: number, camY: number, staffSwinging: boolean) {
  const sprite = MOSES_NOSTAFF;
  const flip = e.facing === -1;
  const frameIdx = Math.floor(e.animT) % sprite.frames.length;
  const img = renderSprite(sprite, frameIdx, SCALE, flip);
  const drawW = img.width, drawH = img.height;
  const sx = Math.round(e.pos.x - camX - drawW / 2);
  const sy = Math.round(e.pos.y - camY - drawH + 8);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(sx + drawW / 2, Math.round(e.pos.y - camY + 8), img.width * 0.35, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(img, sx, sy, drawW, drawH);
  // Programmatic staff — animated bob/rotate synced to walk cycle.
  if (!staffSwinging) drawMosesIdleStaff(ctx, e, s, camX, camY);
}

function drawMosesIdleStaff(ctx: CanvasRenderingContext2D, e: Entity, _s: GameState, camX: number, camY: number) {
  const facing = e.facing;
  const walking = Math.hypot(e.vel.x, e.vel.y) > 5;
  const t = e.animT;
  const bob = walking ? Math.sin(t) * 1.4 : 0;
  const rot = -0.18 + (walking ? Math.sin(t) * 0.06 : 0);
  // Grip at Moses' hand — sits ~25% up from the butt end of the staff.
  const gripX = e.pos.x - camX + facing * 8;
  const gripY = e.pos.y - camY - 18 + bob;
  drawShepherdStaff(ctx, gripX, gripY, rot, facing, 52);
}

// Shared shepherd's-crook renderer at Moses' pixel density. Thicker than a
// pole (4 sprite-px body) so it reads as a hewn tree branch. The shaft has a
// subtle organic bend and a chunky crook + gnarled knot near the top so it
// feels carved from a small tree rather than milled from a dowel.
function drawShepherdStaff(ctx: CanvasRenderingContext2D, gx: number, gy: number, tiltRadians: number, facing: number, length: number) {
  const dirX = Math.cos(tiltRadians) * facing;
  const dirY = Math.sin(tiltRadians);
  const perpX = -dirY * facing;
  const perpY = dirX * facing;

  const buttLen = length * 0.22;
  const shaftLen = length * 0.78;
  const buttX = gx - dirX * buttLen;
  const buttY = gy - dirY * buttLen;
  const shaftTopX = gx + dirX * shaftLen;
  const shaftTopY = gy + dirY * shaftLen;

  // Palette lifted directly from Moses' PALETTE (K, w, d) so the staff looks
  // painted onto him rather than pasted over him.
  const OUTLINE = "#2b1d14";   // K
  const WOOD_MID = "#8a5a34";  // w
  const WOOD_HI  = "#b48355";  // d

  // Match Moses' sprite pixel grid (1 sprite-px = SCALE=3 CSS px).
  // Thicker than a plain pole — reads as a hewn branch, not a dowel.
  const PX = 3;
  const OUT_W = PX * 4;   // 12 — outline
  const BODY_W = PX * 3;  // 9  — wood body
  const HI_W  = PX;       // 3  — highlight streak

  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  // Slight organic bend along the shaft — a quadratic bezier with a small
  // perpendicular bulge in the mid-shaft, so it never looks perfectly straight.
  const bendMid = length * 0.035;
  const midX = (buttX + shaftTopX) / 2 + perpX * bendMid;
  const midY = (buttY + shaftTopY) / 2 + perpY * bendMid;

  const drawShaft = (col: string, lw: number, offset = 0) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(buttX - perpX * offset, buttY - perpY * offset);
    ctx.quadraticCurveTo(
      midX - perpX * offset, midY - perpY * offset,
      shaftTopX - perpX * offset, shaftTopY - perpY * offset,
    );
    ctx.stroke();
  };
  drawShaft(OUTLINE, OUT_W);
  drawShaft(WOOD_MID, BODY_W);
  drawShaft(WOOD_HI, HI_W, PX);

  // Chunkier shepherd's crook at the top.
  const crookLen = length * 0.24;
  const bendAmt = length * 0.14;
  const c1X = shaftTopX + dirX * crookLen * 0.4 + perpX * bendAmt * 0.7;
  const c1Y = shaftTopY + dirY * crookLen * 0.4 + perpY * bendAmt * 0.7;
  const c2X = shaftTopX + dirX * crookLen * 0.6 - perpX * bendAmt * 0.3;
  const c2Y = shaftTopY + dirY * crookLen * 0.6 - perpY * bendAmt * 0.3;
  const endX = shaftTopX + dirX * crookLen * 0.55 - perpX * bendAmt * 1.6;
  const endY = shaftTopY + dirY * crookLen * 0.55 - perpY * bendAmt * 1.6;

  const drawCurve = (col: string, lw: number, offset = 0) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(shaftTopX - perpX * offset, shaftTopY - perpY * offset);
    ctx.bezierCurveTo(
      c1X - perpX * offset, c1Y - perpY * offset,
      c2X - perpX * offset, c2Y - perpY * offset,
      endX - perpX * offset, endY - perpY * offset,
    );
    ctx.stroke();
  };
  drawCurve(OUTLINE, OUT_W);
  drawCurve(WOOD_MID, BODY_W);
  drawCurve(WOOD_HI, HI_W, PX);

  // Chunky grip wrap sized to the pixel grid.
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(Math.round(gx - PX * 1.5), Math.round(gy - PX * 1.5), PX * 3, PX * 3);
  ctx.fillStyle = "#6b4326";
  ctx.fillRect(Math.round(gx - PX * 0.5), Math.round(gy - PX * 0.5), PX, PX);
  ctx.restore();
  return { buttX, buttY, topX: shaftTopX, topY: shaftTopY, endX, endY };
}


// ---------------- generic sprite entity fallback ----------------
function drawSpriteEntity(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState) {
  const sprite = SPRITE_MAP[e.kind];
  if (!sprite) return;
  const frameIdx = Math.floor(e.animT) % sprite.frames.length;
  const flip = e.facing === -1;
  let hopOffY = 0, scaleY = 1, scaleX = 1, frogFrame = frameIdx;
  if (e.kind === "frog") {
    const dur = (e.data?.hopDur as number) ?? 0.7;
    const phase = ((e.data?.hopT as number) ?? 0) / dur;
    hopOffY = -Math.sin(Math.PI * Math.min(1, Math.max(0, (phase - 0.18) / 0.67))) * 26;
    if (phase < 0.18) { scaleY = 0.7; scaleX = 1.2; frogFrame = 0; }
    else if (phase > 0.85) { scaleY = 0.75; scaleX = 1.15; frogFrame = 2; }
    else { scaleY = 1.1; scaleX = 0.92; frogFrame = 1; }
  }
  const img = renderSprite(sprite, e.kind === "frog" ? frogFrame : frameIdx, SCALE, flip);
  const drawW = img.width * scaleX;
  const drawH = img.height * scaleY;
  const sx = Math.round(e.pos.x - camX - drawW / 2);
  const sy = Math.round(e.pos.y - camY - drawH + 8 + hopOffY);
  if (e.kind === "serpent") {
    const angle = (e.data?.angle as number | undefined) ?? Math.atan2(e.vel.y, e.vel.x);
    const rotImg = renderSprite(sprite, frameIdx, SCALE, false);
    ctx.save();
    ctx.translate(e.pos.x - camX, e.pos.y - camY + 6);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(0, 0, rotImg.width * 0.45, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(e.pos.x - camX, e.pos.y - camY);
    ctx.rotate(angle);
    ctx.drawImage(rotImg, -rotImg.width / 2, -rotImg.height / 2);
    ctx.restore();
    return;
  }
  const downed = e.team === "ally" && e.data?.downedUntil != null;
  const shadowScale = e.kind === "frog" ? Math.max(0.5, 1 - Math.abs(hopOffY) / 40) : 1;
  // Shadow: for downed companions, put it under the resting body (at sprite center).
  const shadowY = downed ? Math.round(sy + drawH / 2 + 6) : Math.round(e.pos.y - camY + 8);
  ctx.fillStyle = `rgba(0,0,0,${0.18 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(sx + drawW / 2, shadowY, img.width * 0.35 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  if (downed) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(sx + drawW / 2, sy + drawH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
    ctx.fillStyle = "#f0e0a0";
    ctx.font = "700 10px Nunito, sans-serif";
    ctx.textAlign = "center";
    const remain = Math.max(0, Math.ceil((e.data!.downedUntil as number) - s.now));
    ctx.fillText(`${remain}s`, sx + drawW / 2, sy - 2);
  } else {
    ctx.drawImage(img, sx, sy, drawW, drawH);
  }
  if (e.team === "ally") {
    const bw = 26;
    const bx = sx + drawW / 2 - bw / 2;
    const by = sy - 5;
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = "#1e5a1e"; ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = "#4ec24e"; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
  }
  if (e.team === "enemy" && e.hp < e.maxHp) {
    const bw = 22;
    const bx = sx + drawW / 2 - bw / 2;
    const by = sy - 5;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = "#e05a48"; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
  }
}

// ---------------- procedural enemy renderers ----------------
// All humanoid enemies are drawn at "Moses pixel density" (3 screen-pixels
// per art-pixel), on a shared 16-wide grid whose origin is at the character's
// feet-center. This keeps size, palette and shading consistent with Moses.
const PX = 3;

function drawProceduralEnemy(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number): boolean {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const flip = e.facing === -1 ? -1 : 1;
  const t = e.animT;
  const now = performance.now() / 1000;

  // 2-step walk cycle; pauses when standing still isn't tracked here, so we
  // just always bob a hair.
  const walk = Math.sin(t * 1.2) > 0 ? 1 : 0;

  // Draws a rect on the shared "art-pixel" grid. dx/dy are in art-pixels,
  // measured from the character's feet-center. Flip mirrors horizontally.
  const p = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    const rx = flip === 1 ? x + dx * PX : x - (dx + w) * PX;
    const ry = y + dy * PX;
    ctx.fillRect(rx, ry, w * PX, h * PX);
  };

  const shadow = (r: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y + 6, r, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const hpBar = () => {
    if (e.hp < e.maxHp) {
      const bw = 26;
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - bw / 2 - 1, y - 20 * PX - 1, bw + 2, 5);
      ctx.fillStyle = "#5a1a1a"; ctx.fillRect(x - bw / 2, y - 20 * PX, bw, 3);
      ctx.fillStyle = "#e05a48"; ctx.fillRect(x - bw / 2, y - 20 * PX, bw * Math.max(0, e.hp / e.maxHp), 3);
    }
  };

  // ---------- Sword soldier (Egyptian infantry, khopesh + shield) ----------
  if (e.kind === "swordsoldier") {
    shadow(14);
    const swinging = now < ((e.data?.swingUntil as number) ?? 0);
    const swingPhase = swinging ? 1 - Math.max(0, ((e.data!.swingUntil as number) - now) / 0.28) : 0;
    // legs — alternate step
    p(-3, -3, 2, 3, "#4a2a14"); p(1, -3, 2, 3, "#4a2a14");
    if (walk) { p(-3, 0, 2, 1, "#2b1a08"); p(1, 0, 3, 1, "#2b1a08"); }
    else { p(-4, 0, 3, 1, "#2b1a08"); p(1, 0, 2, 1, "#2b1a08"); }
    // white kilt with red trim
    p(-5, -6, 10, 3, "#f6efdc");
    p(-5, -4, 10, 1, "#a12b2b");
    p(-5, -6, 10, 1, "#d8b98a");
    // torso — bronze cuirass
    p(-5, -11, 10, 5, "#c99a6c");
    p(-5, -11, 10, 1, "#8a5a34");
    p(-5, -8, 10, 1, "#7a5230");
    // pectoral gold
    p(-2, -10, 4, 1, "#e6c261");
    // arms
    p(-6, -10, 1, 4, "#c99a6c"); p(5, -10, 1, 4, "#c99a6c");
    // neck
    p(-2, -13, 4, 2, "#c99a6c");
    // head
    p(-4, -17, 8, 4, "#c99a6c");
    // face detail
    p(-2, -15, 1, 1, "#2b1d14"); p(1, -15, 1, 1, "#2b1d14");
    p(-1, -13, 2, 1, "#8a5a34"); // mouth line
    // bronze helmet with gold band
    p(-5, -20, 10, 3, "#b98550");
    p(-5, -20, 10, 1, "#e6c261");
    p(-5, -18, 10, 1, "#7a5230");
    p(-1, -22, 2, 2, "#a12b2b"); // red plume base
    p(0, -23, 1, 1, "#e05a48");
    // shield on trailing arm (opposite of weapon)
    p(-7, -10, 2, 6, "#7a5230");
    p(-7, -10, 2, 1, "#e6c261");
    p(-7, -7, 2, 1, "#e6c261");
    p(-6, -9, 1, 4, "#c9a05a");
    // khopesh — curved sword, swings on attack
    ctx.save();
    const armX = x + flip * 5 * PX;
    const armY = y - 9 * PX;
    ctx.translate(armX, armY);
    const swingAng = swinging
      ? (-Math.PI * 0.4 + swingPhase * Math.PI * 0.95)
      : -Math.PI * 0.15 + Math.sin(t) * 0.05;
    ctx.rotate(flip === 1 ? swingAng : Math.PI - swingAng);
    // hilt
    ctx.fillStyle = "#5a3820"; ctx.fillRect(0, -3, 3, 6);
    ctx.fillStyle = "#e6c261"; ctx.fillRect(0, -1, 3, 2);
    // curved blade
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.quadraticCurveTo(16, -6, 20, 8); ctx.stroke();
    ctx.strokeStyle = "#dbe9f7"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.quadraticCurveTo(16, -6, 20, 8); ctx.stroke();
    ctx.strokeStyle = "#f6efdc"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.quadraticCurveTo(16, -6, 20, 8); ctx.stroke();
    ctx.restore();
    hpBar(); return true;
  }

  // ---------- Nubian archer ----------
  if (e.kind === "archer") {
    shadow(13);
    const windup = now < ((e.data?.windupUntil as number) ?? 0);
    const justFired = now - ((e.data?.lastAtkAt as number) ?? -99) < 0.18;
    // legs
    p(-3, -3, 2, 3, "#4a2a14"); p(1, -3, 2, 3, "#4a2a14");
    if (walk) { p(-3, 0, 2, 1, "#2b1a08"); p(2, 0, 2, 1, "#2b1a08"); }
    else { p(-4, 0, 2, 1, "#2b1a08"); p(1, 0, 2, 1, "#2b1a08"); }
    // linen loincloth
    p(-4, -6, 8, 3, "#e6c9a1");
    p(-4, -4, 8, 1, "#a17048");
    // torso — darker Nubian skin
    p(-4, -11, 8, 5, "#8a5a34");
    p(-4, -8, 8, 1, "#4a2c18");
    // pectoral scar/paint
    p(-1, -10, 2, 1, "#a12b2b");
    // arms
    p(-5, -10, 1, 4, "#8a5a34"); p(4, -10, 1, 4, "#8a5a34");
    // neck + head
    p(-2, -13, 4, 2, "#8a5a34");
    p(-4, -17, 8, 4, "#8a5a34");
    p(-2, -15, 1, 1, "#f6efdc"); p(1, -15, 1, 1, "#f6efdc"); // eye whites
    p(-2, -15, 1, 1, "#2b1d14"); p(1, -15, 1, 1, "#2b1d14");
    // leather headwrap
    p(-4, -19, 8, 2, "#4a2a14");
    p(-4, -19, 8, 1, "#7a4a2b");
    p(-5, -18, 1, 2, "#4a2a14"); p(4, -18, 1, 2, "#4a2a14");
    // quiver on back
    p(-6, -14, 2, 6, "#4a2a14");
    p(-6, -14, 2, 1, "#8a5a34");
    p(-6, -16, 1, 3, "#f6efdc"); // fletching
    // Bow — draw string tension changes on windup/release
    ctx.save();
    ctx.translate(x + flip * 6 * PX, y - 9 * PX);
    ctx.scale(flip, 1);
    const draw = windup ? 4 : justFired ? -2 : 0;
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.quadraticCurveTo(11, -6, 8, 0); ctx.quadraticCurveTo(11, 6, 0, 12);
    ctx.stroke();
    ctx.strokeStyle = "#7a4a2b"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.quadraticCurveTo(11, -6, 8, 0); ctx.quadraticCurveTo(11, 6, 0, 12);
    ctx.stroke();
    // string with nocked arrow
    ctx.strokeStyle = "#f6efdc"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(2 - draw, 0); ctx.lineTo(0, 12); ctx.stroke();
    // arrow shaft while drawn
    if (windup || justFired) {
      ctx.strokeStyle = "#5a3820"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2 - draw, 0); ctx.lineTo(14, 0); ctx.stroke();
      ctx.fillStyle = "#dbe9f7";
      ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(18, 0); ctx.lineTo(14, 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    hpBar(); return true;
  }

  // ---------- Mounted knight (Egyptian officer on horse) ----------
  if (e.kind === "knight") {
    shadow(20);
    const windup = now < ((e.data?.windupUntil as number) ?? 0);
    // horse body
    p(-9, -9, 18, 5, "#d8b98a");
    p(-9, -6, 18, 2, "#a17048");
    p(-9, -9, 18, 1, "#f4e2c1");
    // horse legs — 2-step canter
    if (walk) {
      p(-8, -4, 2, 4, "#c99a6c"); p(-3, -4, 2, 4, "#c99a6c");
      p(3, -4, 2, 4, "#c99a6c"); p(7, -4, 2, 4, "#c99a6c");
    } else {
      p(-7, -4, 2, 4, "#c99a6c"); p(-2, -4, 2, 4, "#c99a6c");
      p(2, -4, 2, 4, "#c99a6c"); p(6, -4, 2, 4, "#c99a6c");
    }
    p(-8, 0, 2, 1, "#2b1d14"); p(-3, 0, 2, 1, "#2b1d14");
    p(3, 0, 2, 1, "#2b1d14"); p(7, 0, 2, 1, "#2b1d14");
    // horse head + neck
    p(7, -13, 4, 3, "#d8b98a");
    p(9, -16, 4, 4, "#d8b98a");
    p(9, -16, 4, 1, "#f4e2c1");
    // mane
    p(5, -12, 2, 3, "#7a4a2b");
    p(3, -11, 2, 2, "#7a4a2b");
    p(11, -17, 1, 2, "#7a4a2b");
    // eye
    p(11, -15, 1, 1, "#2b1d14");
    // reins
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + flip * 11 * PX, y - 14 * PX);
    ctx.lineTo(x - flip * 2 * PX, y - 17 * PX); ctx.stroke();
    // rider torso — royal red cloak
    p(-3, -16, 6, 5, "#a12b2b");
    p(-3, -16, 6, 1, "#e05a48");
    p(-3, -12, 6, 1, "#5a1a1a");
    // gold shoulder strap
    p(-3, -15, 6, 1, "#e6c261");
    // rider head
    p(-2, -20, 4, 3, "#c99a6c");
    p(-1, -19, 1, 1, "#2b1d14"); p(1, -19, 1, 1, "#2b1d14");
    // bronze helm with gold trim
    p(-3, -23, 6, 3, "#b98550");
    p(-3, -23, 6, 1, "#e6c261");
    p(-1, -25, 2, 2, "#3060c0"); // blue crest
    // spear — raises on windup, thrusts on windup expiry
    ctx.save();
    ctx.translate(x - flip * 1 * PX, y - 15 * PX);
    ctx.scale(flip, 1);
    const spearAng = windup ? -Math.PI * 0.55 : -Math.PI * 0.3;
    ctx.rotate(spearAng);
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(28, 0); ctx.stroke();
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(28, 0); ctx.stroke();
    ctx.strokeStyle = "#b48355"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(28, 0); ctx.stroke();
    // spearhead
    ctx.fillStyle = "#dbe9f7";
    ctx.beginPath(); ctx.moveTo(28, -3); ctx.lineTo(35, 0); ctx.lineTo(28, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f6efdc";
    ctx.beginPath(); ctx.moveTo(28, -1); ctx.lineTo(32, 0); ctx.lineTo(28, 1); ctx.closePath(); ctx.fill();
    ctx.restore();
    hpBar(); return true;
  }

  // ---------- Egyptian war chariot ----------
  if (e.kind === "chariot") {
    shadow(24);
    const d3 = e.data ?? {};
    const charging = performance.now() / 1000 < ((d3.chargingUntil as number) ?? 0);
    const winding = performance.now() / 1000 < ((d3.chargeWindupUntil as number) ?? 0);
    // twin horses running forward of cab
    for (let horse = 0; horse < 2; horse++) {
      const oy = -horse * 2;
      p(2, -9 + oy, 12, 4, "#7a4a2b");
      p(2, -6 + oy, 12, 1, "#4a2a14");
      // legs alternate on charge
      const step = (charging ? (Math.floor(t * 12) % 2) : walk) === 1;
      const off = step ? 1 : 0;
      p(3 + off, -3 + oy, 2, 4, "#5a3010"); p(7 + off, -3 + oy, 2, 4, "#5a3010");
      p(11 - off, -3 + oy, 2, 4, "#5a3010"); p(13 - off, -3 + oy, 1, 4, "#5a3010");
      // head
      p(13, -13 + oy, 4, 3, "#7a4a2b");
      p(15, -16 + oy, 3, 5, "#7a4a2b");
      p(15, -16 + oy, 3, 1, "#e6c261"); // gold plume
      p(17, -15 + oy, 1, 1, "#2b1d14");
    }
    // reins
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + flip * 15 * PX, y - 12 * PX);
    ctx.lineTo(x - flip * 5 * PX, y - 14 * PX);
    ctx.stroke();
    // Chariot cab — gold with blue Egyptian panel
    p(-8, -12, 6, 8, "#c9a05a");
    p(-8, -12, 6, 1, "#e6c261");
    p(-8, -9, 6, 1, "#3060c0");
    p(-8, -7, 6, 1, "#a12b2b");
    p(-8, -5, 6, 1, "#2b1d14");
    // cab side gold rim
    p(-2, -12, 1, 8, "#e6c261");
    // spoked wheel
    ctx.save();
    ctx.translate(x - flip * 5 * PX, y);
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 2;
    const wheelRot = charging ? t * 12 : t * 2;
    ctx.rotate(wheelRot);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.stroke();
    }
    ctx.fillStyle = "#e6c261"; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
    // Driver in cab
    p(-7, -19, 4, 4, "#c99a6c"); // face
    p(-6, -18, 1, 1, "#2b1d14"); p(-4, -18, 1, 1, "#2b1d14");
    p(-7, -22, 4, 3, "#e6c261"); // nemes
    p(-7, -21, 4, 1, "#3060c0");
    p(-8, -15, 6, 4, "#3060c0"); // torso robe
    p(-8, -15, 6, 1, "#e6c261");
    // whip on windup
    if (winding) {
      ctx.strokeStyle = "#4a2a14"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - flip * 6 * PX, y - 18 * PX);
      ctx.quadraticCurveTo(x - flip * 14 * PX, y - 24 * PX, x - flip * 22 * PX, y - 14 * PX);
      ctx.stroke();
    }
    // charge dust trail
    if (charging) {
      ctx.fillStyle = "rgba(200,170,120,0.6)";
      for (let i = 0; i < 6; i++) {
        const dx = -flip * (12 + i * 5) * PX;
        ctx.beginPath(); ctx.arc(x + dx, y + 4 + Math.sin(t * 8 + i) * 3, 4 + i * 0.8, 0, Math.PI * 2); ctx.fill();
      }
    }
    hpBar(); return true;
  }

  // ---------- Sorcerer / priest-mage ----------
  if (e.kind === "mage") {
    shadow(13);
    const windup = now < ((e.data?.windupUntil as number) ?? 0);
    const justFired = now - ((e.data?.lastAtkAt as number) ?? -99) < 0.2;
    // hem of robe (swishes with walk)
    const hem = walk ? 1 : 0;
    p(-6 + hem, -4, 12, 4, "#4d3a5c");
    p(-6 + hem, -4, 12, 1, "#8a6d9e");
    p(-6 + hem, -1, 12, 1, "#2b1d14");
    // robe body
    p(-5, -13, 10, 9, "#4d3a5c");
    p(-5, -13, 10, 1, "#8a6d9e");
    p(-5, -9, 10, 1, "#8a6d9e");
    // gold trim vertical
    p(-1, -13, 2, 9, "#e6c261");
    p(0, -13, 1, 9, "#c9700a");
    // sleeves
    p(-6, -12, 1, 5, "#4d3a5c"); p(5, -12, 1, 5, "#4d3a5c");
    // hood shadow face
    p(-4, -19, 8, 5, "#2b1d14");
    p(-4, -19, 8, 1, "#8a6d9e");
    p(-3, -17, 2, 1, "#ff4020"); p(1, -17, 2, 1, "#ff4020"); // glowing eyes
    // pointy hood
    p(-4, -21, 8, 2, "#4d3a5c");
    p(-3, -22, 6, 1, "#4d3a5c");
    p(-1, -23, 2, 1, "#4d3a5c");
    // ankh amulet
    p(-1, -8, 2, 1, "#e6c261");
    p(0, -7, 1, 2, "#e6c261");
    p(-1, -6, 2, 1, "#e6c261");
    // staff with orb — rises on windup, glows brighter, orb enlarges on release
    ctx.save();
    const staffX = x + flip * 6 * PX;
    const staffTopY = y - (windup ? 24 : 20) * PX;
    const staffBotY = y + 4;
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(staffX, staffTopY); ctx.lineTo(staffX, staffBotY); ctx.stroke();
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(staffX, staffTopY); ctx.lineTo(staffX, staffBotY); ctx.stroke();
    // orb
    const orbR = justFired ? 9 : windup ? 8 : 5 + Math.sin(t * 3) * 0.6;
    const orbGlow = ctx.createRadialGradient(staffX, staffTopY - 4, 1, staffX, staffTopY - 4, orbR + 4);
    orbGlow.addColorStop(0, "#ffffff");
    orbGlow.addColorStop(0.4, "#e0a0ff");
    orbGlow.addColorStop(1, "rgba(120,40,180,0)");
    ctx.fillStyle = orbGlow;
    ctx.beginPath(); ctx.arc(staffX, staffTopY - 4, orbR + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c060ff";
    ctx.beginPath(); ctx.arc(staffX, staffTopY - 4, orbR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(staffX - 1, staffTopY - 6, orbR * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    hpBar(); return true;
  }

  // ---------- Animals (kept, minor polish) ----------
  const bob = Math.sin(t) * 1;
  if (e.kind === "crow") {
    shadow(6); ctx.save();
    const flap = Math.sin(e.animT * 6) > 0;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(x - 5, y - 6 + bob, 10, 6);
    ctx.fillRect(x + flip * 5, y - 5 + bob, flip * 3, 3);
    ctx.fillStyle = "#e8c040"; ctx.fillRect(x + flip * 8, y - 4 + bob, flip * 2, 1);
    ctx.fillStyle = "#151515";
    if (flap) { ctx.fillRect(x - 10, y - 10 + bob, 8, 3); ctx.fillRect(x + 2, y - 10 + bob, 8, 3); }
    else { ctx.fillRect(x - 10, y - 2 + bob, 8, 3); ctx.fillRect(x + 2, y - 2 + bob, 8, 3); }
    ctx.restore(); hpBar(); return true;
  }
  if (e.kind === "bat") {
    shadow(5); ctx.save();
    const flap = Math.sin(e.animT * 10) > 0;
    ctx.fillStyle = "#3a1a4a";
    ctx.fillRect(x - 3, y - 4 + bob, 6, 5);
    ctx.fillStyle = "#ff4040"; ctx.fillRect(x - 2, y - 3 + bob, 1, 1); ctx.fillRect(x + 1, y - 3 + bob, 1, 1);
    ctx.fillStyle = "#5a2a70";
    if (flap) { ctx.fillRect(x - 10, y - 8 + bob, 7, 4); ctx.fillRect(x + 3, y - 8 + bob, 7, 4); }
    else { ctx.fillRect(x - 10, y + bob, 7, 4); ctx.fillRect(x + 3, y + bob, 7, 4); }
    ctx.restore(); hpBar(); return true;
  }
  if (e.kind === "wolf") {
    shadow(14);
    // body
    p(-7, -6, 14, 5, "#8a7a68");
    p(-7, -3, 14, 2, "#5a4a38");
    p(-7, -6, 14, 1, "#c9b090");
    // fur tufts along spine
    p(-5, -7, 1, 1, "#c9b090"); p(-2, -7, 1, 1, "#c9b090"); p(2, -7, 1, 1, "#c9b090"); p(5, -7, 1, 1, "#c9b090");
    // legs — alternate
    if (walk) {
      p(-6, -1, 2, 3, "#5a4a38"); p(-2, -1, 2, 3, "#5a4a38");
      p(2, -1, 2, 3, "#5a4a38"); p(5, -1, 2, 3, "#5a4a38");
    } else {
      p(-6, 0, 2, 2, "#5a4a38"); p(-2, 0, 2, 2, "#5a4a38");
      p(2, 0, 2, 2, "#5a4a38"); p(5, 0, 2, 2, "#5a4a38");
    }
    p(-6, 2, 2, 1, "#2b1d14"); p(-2, 2, 2, 1, "#2b1d14"); p(2, 2, 2, 1, "#2b1d14"); p(5, 2, 2, 1, "#2b1d14");
    // head
    p(6, -8, 4, 5, "#8a7a68");
    p(9, -6, 2, 3, "#c9b090"); // snout
    p(10, -5, 1, 1, "#2b1d14"); // nose
    p(6, -10, 2, 2, "#5a4a38"); p(9, -10, 1, 2, "#5a4a38"); // ears
    p(7, -6, 1, 1, "#e6c261"); // amber eye
    // tail
    p(-9, -6, 2, 2, "#8a7a68");
    p(-10, -7, 1, 2, "#c9b090");
    hpBar(); return true;
  }
  if (e.kind === "lion") {
    shadow(17);
    // body
    p(-7, -7, 14, 6, "#e6c261");
    p(-7, -3, 14, 2, "#c9a05a");
    p(-7, -1, 14, 1, "#8a5a20");
    p(-7, -7, 14, 1, "#f6efdc");
    // legs
    p(-6, -1, 2, 3, "#c9a05a"); p(-2, -1, 2, 3, "#c9a05a");
    p(2, -1, 2, 3, "#c9a05a"); p(5, -1, 2, 3, "#c9a05a");
    p(-6, 2, 2, 1, "#2b1d14"); p(-2, 2, 2, 1, "#2b1d14"); p(2, 2, 2, 1, "#2b1d14"); p(5, 2, 2, 1, "#2b1d14");
    // mane — layered rings
    const mX = x + flip * 7 * PX;
    const mY = y - 6 * PX;
    ctx.fillStyle = "#5a3010";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(Math.round(mX + Math.cos(a) * 12) - 2, Math.round(mY + Math.sin(a) * 12) - 2, 5, 5);
    }
    ctx.fillStyle = "#8a5a20";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      ctx.fillRect(Math.round(mX + Math.cos(a) * 8) - 2, Math.round(mY + Math.sin(a) * 8) - 2, 4, 4);
    }
    // face
    p(7, -8, 4, 4, "#e6c261");
    p(9, -6, 2, 2, "#c9a05a"); // muzzle
    p(10, -5, 1, 1, "#2b1d14"); // nose
    p(7, -7, 1, 1, "#f6efdc"); p(8, -7, 1, 1, "#2b1d14"); // eye
    // tail with tuft
    p(-9, -6, 3, 1, "#c9a05a");
    p(-11, -5, 2, 2, "#8a5a20");
    p(-12, -4, 2, 2, "#5a3010");
    hpBar(); return true;
  }
  return false;
}



// ---------------- Ramses ----------------
function drawRamsesTelegraph(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const d = e.data!;
  const phase = d.leapPhase as string;
  if (phase !== "telegraph" && phase !== "airborne") return;
  const tp = d.leapTarget as { x: number; y: number };
  const R = (d.landRadius as number) ?? 90;
  const cx = tp.x - camX;
  const cy = tp.y - camY;
  const t = e.born + performance.now() / 1000;
  const pulse = 0.5 + 0.5 * Math.sin(t * 12);
  ctx.save();
  ctx.strokeStyle = `rgba(255,60,60,${0.5 + pulse * 0.4})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(255,60,60,${0.15 * pulse})`;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // crosshair
  ctx.strokeStyle = `rgba(255,220,60,${0.7})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy);
  ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); ctx.stroke();
  ctx.restore();
}

function drawRamses(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState) {
  const d = e.data!;
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const phase = d.leapPhase as string;
  const seated = !!d.seated;
  const flip = e.facing === -1 ? -1 : 1;
  const idleBob = Math.sin(s.now * 1.2) * 1.5;
  const walk = Math.sin(e.animT * 0.9) > 0 ? 1 : 0;

  // Shadow — big; Ramses is roughly 2x a normal human.
  const chariot = !!d.chariot && !seated;
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath(); ctx.ellipse(x, y + 10, chariot ? 54 : 34, chariot ? 9 : 7, 0, 0, Math.PI * 2); ctx.fill();

  let bob = 0;
  if (phase === "airborne") {
    const t = 1 - Math.max(0, Math.min(1, (d.leapT as number) / 0.75));
    bob = -Math.sin(t * Math.PI) * 130;
  } else if (phase === "telegraph") {
    bob = -8 - Math.sin(s.now * 20) * 4;
  } else if (seated) {
    bob = idleBob * 0.35;
  } else {
    bob = idleBob;
  }

  // Draws on the same 3-screen-pixel grid used for humanoids, at 2× Moses scale.
  const RPX = 3;
  const p = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    const rx = flip === 1 ? x + dx * RPX : x - (dx + w) * RPX;
    const ry = y + (dy + bob / RPX) * RPX;
    ctx.fillRect(rx, ry, w * RPX, h * RPX);
  };

  // -------- Egyptian war chariot (level 50+) --------
  // Drawn beneath Ramses so his torso rises above the cart. Simple pixel-art
  // silhouette in Ramses' palette: gold-edged cart, spoked wheels, twin horses.
  if (chariot) {
    const wheelR = 22;
    const cartY = y + 8;
    const spin = s.now * 8 * flip;
    // Cart body (gold with blue trim)
    ctx.fillStyle = "#8a5a20"; ctx.fillRect(x - 30, cartY - 18, 60, 20);
    ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 28, cartY - 16, 56, 14);
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 28, cartY - 16, 56, 2);
    ctx.fillStyle = "#3060c0"; ctx.fillRect(x - 28, cartY - 8, 56, 2);
    ctx.fillStyle = "#c9700a"; ctx.fillRect(x - 28, cartY - 4, 56, 2);
    // Front panel emblem (sun disk)
    ctx.fillStyle = "#e6c261"; ctx.beginPath(); ctx.arc(x + flip * 20, cartY - 10, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c9700a"; ctx.beginPath(); ctx.arc(x + flip * 20, cartY - 10, 2, 0, Math.PI * 2); ctx.fill();
    // Wheels — bronze rim, spokes rotating
    for (const wx of [x - 22, x + 22]) {
      ctx.fillStyle = "#2b1d14"; ctx.beginPath(); ctx.arc(wx, cartY + 4, wheelR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c9700a"; ctx.beginPath(); ctx.arc(wx, cartY + 4, wheelR - 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e6c261"; ctx.beginPath(); ctx.arc(wx, cartY + 4, wheelR - 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = spin + (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(wx, cartY + 4);
        ctx.lineTo(wx + Math.cos(a) * (wheelR - 4), cartY + 4 + Math.sin(a) * (wheelR - 4));
        ctx.stroke();
      }
      ctx.fillStyle = "#2b1d14"; ctx.beginPath(); ctx.arc(wx, cartY + 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e6c261"; ctx.beginPath(); ctx.arc(wx, cartY + 4, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Yoke pole reaching forward toward horses
    ctx.strokeStyle = "#5a3820"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + flip * 26, cartY - 6);
    ctx.lineTo(x + flip * 70, cartY - 4);
    ctx.stroke();
    // Twin horses ahead of the cart
    const horseX = x + flip * 78;
    const gallop = Math.sin(s.now * 14) > 0 ? 1 : -1;
    for (const hy of [cartY - 14, cartY + 6]) {
      // Body
      ctx.fillStyle = "#4a2a10"; ctx.fillRect(horseX - flip * 22, hy - 6, flip * 26, 10);
      ctx.fillStyle = "#7a4a20"; ctx.fillRect(horseX - flip * 22, hy - 6, flip * 26, 3);
      // Head
      ctx.fillStyle = "#4a2a10"; ctx.fillRect(horseX, hy - 10, flip * 10, 8);
      ctx.fillStyle = "#7a4a20"; ctx.fillRect(horseX, hy - 10, flip * 10, 2);
      // Mane
      ctx.fillStyle = "#2b1d14"; ctx.fillRect(horseX - flip * 3, hy - 10, flip * 3, 6);
      // Eye
      ctx.fillStyle = "#ffdd80"; ctx.fillRect(horseX + flip * 6, hy - 7, 2, 2);
      // Legs (gallop)
      ctx.fillStyle = "#2b1d14";
      ctx.fillRect(horseX - flip * 20, hy + 4, 3, 8 + gallop * 2);
      ctx.fillRect(horseX - flip * 10, hy + 4, 3, 8 - gallop * 2);
      ctx.fillRect(horseX - flip * 4, hy + 4, 3, 8 + gallop * 2);
      ctx.fillRect(horseX - flip * 14, hy + 4, 3, 8 - gallop * 2);
      // Tail
      ctx.fillStyle = "#2b1d14"; ctx.fillRect(horseX - flip * 24, hy - 4, flip * 2, 10);
    }
  }

  // -------- Legs / kilt (white shendyt with gold trim) --------
  if (!seated) {
    // walking legs
    if (walk) { p(-4, -1, 3, 5, "#c99a6c"); p(1, -1, 3, 5, "#c99a6c"); }
    else { p(-5, -1, 3, 5, "#c99a6c"); p(2, -1, 3, 5, "#c99a6c"); }
    // gold anklets
    p(-5, 3, 4, 1, "#e6c261"); p(1, 3, 4, 1, "#e6c261");
  } else {
    // seated legs (sit forward across throne)
    p(-6, -1, 12, 3, "#c99a6c");
    p(-6, -1, 12, 1, "#8a5a34");
  }
  // Shendyt kilt
  p(-7, -8, 14, 6, "#f6efdc");
  p(-7, -8, 14, 1, "#e6c261");
  p(-7, -3, 14, 1, "#c9a05a");
  // central gold panel
  p(-1, -8, 2, 6, "#e6c261");
  p(0, -8, 1, 6, "#c9700a");

  // -------- Torso (bare copper w/ usekh collar) --------
  p(-7, -18, 14, 10, "#c99a6c");
  p(-7, -10, 14, 1, "#8a5a34");
  // usekh (broad gold necklace)
  p(-7, -18, 14, 2, "#e6c261");
  p(-7, -17, 14, 1, "#3060c0");
  p(-7, -16, 14, 1, "#a12b2b");
  // pectoral scarab
  p(-2, -14, 4, 3, "#3060c0");
  p(-2, -14, 4, 1, "#e6c261");
  p(-1, -13, 2, 1, "#e6c261");
  // arms
  p(-8, -17, 1, 6, "#c99a6c"); p(7, -17, 1, 6, "#c99a6c");
  p(-8, -11, 1, 3, "#8a5a34"); p(7, -11, 1, 3, "#8a5a34"); // arm shading

  // -------- Neck + head --------
  p(-3, -20, 6, 2, "#c99a6c");
  p(-6, -28, 12, 8, "#c99a6c");
  // kohl eyes
  p(-5, -25, 4, 1, "#2b1d14"); p(1, -25, 4, 1, "#2b1d14");
  p(-4, -24, 1, 1, "#f6efdc"); p(2, -24, 1, 1, "#f6efdc");
  p(-3, -24, 1, 1, "#2b1d14"); p(3, -24, 1, 1, "#2b1d14");
  // brow / kohl tail
  p(-6, -26, 6, 1, "#2b1d14"); p(0, -26, 6, 1, "#2b1d14");
  // pharaoh beard (postiche)
  p(-1, -20, 2, 4, "#4a2c18");
  p(-1, -17, 2, 1, "#e6c261");

  // -------- Nemes headdress (blue+gold striped) --------
  // top crown
  for (let i = 0; i < 8; i++) {
    p(-8 + i * 2, -34, 2, 6, i % 2 === 0 ? "#3060c0" : "#e6c261");
  }
  // front brow band
  p(-8, -29, 16, 2, "#e6c261");
  p(-8, -29, 16, 1, "#c9700a");
  // side flaps flaring outward
  p(-10, -28, 2, 8, "#3060c0");
  p(8, -28, 2, 8, "#3060c0");
  p(-10, -28, 2, 1, "#e6c261"); p(8, -28, 2, 1, "#e6c261");
  p(-10, -24, 2, 1, "#e6c261"); p(8, -24, 2, 1, "#e6c261");
  p(-10, -20, 2, 1, "#e6c261"); p(8, -20, 2, 1, "#e6c261");
  // Uraeus cobra rearing over brow
  p(-1, -37, 2, 3, "#e6c261");
  p(-1, -36, 2, 1, "#a12b2b");
  p(-2, -33, 4, 1, "#e6c261");
  p(-1, -32, 2, 1, "#2b1d14");

  // -------- Was-scepter (held in front unless airborne) --------
  if (phase !== "airborne") {
    ctx.save();
    const staffX = x + flip * 10 * RPX;
    const staffTopY = y + (-36 + bob / RPX) * RPX;
    const staffBotY = y + (6 + bob / RPX) * RPX;
    // shaft — layered wood
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(staffX, staffTopY); ctx.lineTo(staffX, staffBotY); ctx.stroke();
    ctx.strokeStyle = "#e6c261"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(staffX, staffTopY); ctx.lineTo(staffX, staffBotY); ctx.stroke();
    ctx.strokeStyle = "#c9700a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(staffX, staffTopY); ctx.lineTo(staffX, staffBotY); ctx.stroke();
    // was-scepter head (stylized set-animal)
    ctx.fillStyle = "#e6c261";
    ctx.fillRect(staffX - flip * 2, staffTopY - 10, flip * 10, 7);
    ctx.fillStyle = "#3060c0";
    ctx.fillRect(staffX - flip * 2, staffTopY - 10, flip * 10, 2);
    ctx.fillStyle = "#2b1d14";
    ctx.fillRect(staffX + flip * 6, staffTopY - 7, 2, 2); // eye
    // forked base
    ctx.fillStyle = "#2b1d14";
    ctx.fillRect(staffX - 5, staffBotY - 2, 4, 5);
    ctx.fillRect(staffX + 1, staffBotY - 2, 4, 5);
    ctx.restore();
  }

  // Land shockwave (unchanged)
  if (phase === "land") {
    const t = 1 - Math.max(0, Math.min(1, (d.leapT as number) / 0.4));
    const R = (d.landRadius as number) * (0.4 + t * 1.1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = "#f5d488"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y + 6, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#c9700a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y + 6, R * 0.75, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const rr = R * (0.7 + Math.random() * 0.3);
      const dx = Math.round(x + Math.cos(a) * rr);
      const dy = Math.round(y + 6 + Math.sin(a) * rr * 0.5);
      ctx.fillStyle = i % 2 ? "#c9a06a" : "#e6c261";
      ctx.fillRect(dx - 2, dy - 2, 4, 4);
    }
    ctx.restore();
  }

  // HP bar visible when active
  if (d.active) {
    const bw = 80;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - bw / 2 - 1, y - 46 * RPX - 1, bw + 2, 6);
    ctx.fillStyle = "#5a1a1a"; ctx.fillRect(x - bw / 2, y - 46 * RPX, bw, 4);
    ctx.fillStyle = "#e04030"; ctx.fillRect(x - bw / 2, y - 46 * RPX, bw * Math.max(0, e.hp / e.maxHp), 4);
    ctx.fillStyle = "#ffdd80"; ctx.font = "700 12px Nunito, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("RAMSES", x, y - 46 * RPX - 5);
  }
}

// ---------------- Throne ----------------
function drawThrone(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const TPX = 3;
  const p = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + dx * TPX, y + dy * TPX, w * TPX, h * TPX);
  };
  ctx.save();
  // Big soft shadow
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath(); ctx.ellipse(x, y + 12 * TPX, 44, 8, 0, 0, Math.PI * 2); ctx.fill();

  // -------- Stepped stone plinth --------
  p(-13, 8, 26, 3, "#a17048");
  p(-13, 8, 26, 1, "#c9a05a");
  p(-13, 10, 26, 1, "#7a4a2b");
  // hieroglyph frieze on plinth
  for (let i = 0; i < 6; i++) {
    p(-11 + i * 4, 9, 1, 1, "#2b1d14");
    p(-10 + i * 4, 9, 1, 1, "#2b1d14");
  }

  // -------- Backrest (tall gold panel) --------
  p(-9, -20, 18, 22, "#c9a05a");
  p(-9, -20, 18, 1, "#e6c261");
  p(-9, -18, 18, 1, "#e6c261");
  p(-9, 1, 18, 1, "#8a5a20");
  // blue-and-gold vertical striping on the backrest
  for (let i = 0; i < 3; i++) {
    p(-9 + i, -12, 1, 12, i % 2 === 0 ? "#3060c0" : "#e6c261");
    p(7 + i, -12, 1, 12, i % 2 === 0 ? "#3060c0" : "#e6c261");
  }
  // Central winged sun-disk emblem
  ctx.fillStyle = "#e6c261";
  ctx.beginPath(); ctx.arc(x, y - 15 * TPX, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c9700a";
  ctx.beginPath(); ctx.arc(x, y - 15 * TPX, 5, 0, Math.PI * 2); ctx.fill();
  // wings
  ctx.fillStyle = "#3060c0";
  ctx.fillRect(x - 22, y - 15 * TPX - 2, 14, 3);
  ctx.fillRect(x + 8, y - 15 * TPX - 2, 14, 3);
  ctx.fillStyle = "#e6c261";
  ctx.fillRect(x - 22, y - 15 * TPX + 1, 14, 1);
  ctx.fillRect(x + 8, y - 15 * TPX + 1, 14, 1);
  // rays
  ctx.strokeStyle = "#e6c261"; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 9, y - 15 * TPX + Math.sin(a) * 9);
    ctx.lineTo(x + Math.cos(a) * 13, y - 15 * TPX + Math.sin(a) * 13);
    ctx.stroke();
  }

  // -------- Seat block --------
  p(-11, 2, 22, 6, "#c9a05a");
  p(-11, 2, 22, 1, "#e6c261");
  p(-11, 7, 22, 1, "#8a5a20");
  // side hieroglyph panels
  p(-10, 4, 20, 1, "#3060c0");
  p(-10, 6, 20, 1, "#a12b2b");

  // -------- Armrests with cobra heads --------
  p(-13, -2, 2, 10, "#c9a05a");
  p(11, -2, 2, 10, "#c9a05a");
  p(-13, -2, 2, 1, "#e6c261"); p(11, -2, 2, 1, "#e6c261");
  // cobra heads
  const cobra = (cx: number) => {
    ctx.fillStyle = "#e6c261"; ctx.fillRect(cx - 4, y - 5 * TPX, 8, 8);
    ctx.fillStyle = "#3060c0"; ctx.fillRect(cx - 4, y - 5 * TPX, 8, 2);
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(cx - 3, y - 4 * TPX + 2, 2, 2); ctx.fillRect(cx + 1, y - 4 * TPX + 2, 2, 2);
    ctx.fillStyle = "#a12b2b"; ctx.fillRect(cx - 1, y - 3 * TPX + 3, 2, 1); // forked tongue
  };
  cobra(x - 12 * TPX); cobra(x + 12 * TPX);

  // -------- Lion-paw legs --------
  p(-13, 11, 3, 2, "#8a5a20");
  p(10, 11, 3, 2, "#8a5a20");
  p(-13, 12, 1, 1, "#2b1d14"); p(-12, 12, 1, 1, "#2b1d14"); p(-11, 12, 1, 1, "#2b1d14");
  p(10, 12, 1, 1, "#2b1d14"); p(11, 12, 1, 1, "#2b1d14"); p(12, 12, 1, 1, "#2b1d14");
  ctx.restore();
}



// ---------------- staff swing effect ----------------
function drawStaffSwing(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, camX: number, camY: number) {
  const facing = (e.data?.facing as number) ?? 1;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / 0.18));
  const progress = 1 - life;
  const startA = facing === 1 ? -Math.PI * 0.85 : Math.PI + Math.PI * 0.85;
  const endA   = facing === 1 ?  Math.PI * 0.35 : Math.PI - Math.PI * 0.35;
  const staffLen = 52;
  const gx = s.player.pos.x - camX + facing * 8;
  const gy = s.player.pos.y - camY - 18;
  const swingAng = startA + (endA - startA) * progress;
  const relAng = facing === 1 ? swingAng : Math.PI - swingAng;

  ctx.save();
  const trailStart = Math.max(0, progress - 0.75);
  const segs = 26;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const a = startA + (endA - startA) * (trailStart + t * (progress - trailStart));
    const fade = life * (0.25 + 0.75 * t);
    ctx.globalAlpha = fade * 0.55;
    ctx.fillStyle = "#ffffff";
    const ox = gx + Math.cos(a) * staffLen * 0.75;
    const oy = gy + Math.sin(a) * staffLen * 0.75;
    const outerSz = t > 0.8 ? 7 : t > 0.5 ? 6 : 5;
    ctx.fillRect(Math.round(ox - outerSz / 2), Math.round(oy - outerSz / 2), outerSz, outerSz);
    ctx.globalAlpha = fade;
    const coreSz = t > 0.8 ? 4 : 3;
    ctx.fillRect(Math.round(ox - coreSz / 2), Math.round(oy - coreSz / 2), coreSz, coreSz);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Draw the animated shepherd's-crook staff itself.
  drawShepherdStaff(ctx, gx, gy, relAng, facing, staffLen);
  // Bright impact glow at the tip of the crook mid-swing.
  const dirX = Math.cos(relAng) * facing;
  const dirY = Math.sin(relAng);
  const tipX = gx + dirX * staffLen * 0.75;
  const tipY = gy + dirY * staffLen * 0.75;
  ctx.save();
  ctx.globalAlpha = life;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}


function drawCompanionMelee(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 0.18;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxTtl));
  const x = e.pos.x - camX;
  const y = e.pos.y - camY;
  ctx.save();
  ctx.globalAlpha = life;
  ctx.fillStyle = (e.data?.color as string) ?? "#ffffff";
  ctx.fillRect(x - 8, y - 2, 16, 4);
  ctx.fillRect(x - 2, y - 8, 4, 16);
  ctx.restore();
}

function drawBolt(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const boltKind = (e.data?.boltKind as string | undefined) ?? "default";
  const color = (e.data?.boltColor as string | undefined) ?? "#f0e8b4";
  const x = e.pos.x - camX;
  const y = e.pos.y - camY;
  const angle = (e.data?.angle as number | undefined) ?? Math.atan2(e.vel.y, e.vel.x);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (boltKind === "spear") {
    ctx.fillStyle = "#5a3820"; ctx.fillRect(-10, -1, 18, 2);
    ctx.fillStyle = color; ctx.fillRect(6, -2, 6, 4);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(10, -1, 2, 2);
  } else if (boltKind === "waterbowl") {
    ctx.fillStyle = "#3f7bbf"; ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = color; ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-1, -1, 2, 2);
  } else if (boltKind === "flint") {
    ctx.fillStyle = "#4a4a4a"; ctx.fillRect(-4, -1, 8, 2);
    ctx.fillStyle = color; ctx.fillRect(-3, -1, 6, 2);
  } else {
    ctx.fillStyle = color; ctx.fillRect(-4, -1, 8, 2); ctx.fillRect(-1, -4, 2, 8);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-1, -1, 2, 2);
  }
  ctx.restore();
}

function drawEnemyProjectile(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = e.pos.x - camX;
  const y = e.pos.y - camY;
  const angle = (e.data?.angle as number | undefined) ?? Math.atan2(e.vel.y, e.vel.x);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  if (e.kind === "arrow") {
    ctx.fillStyle = "#5a3820"; ctx.fillRect(-8, -1, 12, 2);
    ctx.fillStyle = "#c0c0c0"; ctx.fillRect(4, -2, 4, 4);
    ctx.fillStyle = "#eee"; ctx.fillRect(-8, -2, 2, 4);
  } else if (e.kind === "spear_e") {
    ctx.fillStyle = "#3a2010"; ctx.fillRect(-10, -1, 16, 2);
    ctx.fillStyle = "#a0a0a0"; ctx.fillRect(6, -3, 6, 5);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(10, -1, 2, 2);
  } else if (e.kind === "magebolt") {
    const t = e.animT;
    ctx.fillStyle = "#c060ff"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-1, -1, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(200,100,255,${0.6 + Math.sin(t * 20) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
  } else if (e.kind === "flamingspear") {
    // Ramses' flaming war spear (pixel-art)
    const t = e.animT;
    // Trailing flame
    for (let i = 0; i < 5; i++) {
      const k = i / 5;
      ctx.fillStyle = i < 2 ? "#fff2b0" : i < 3 ? "#ff8020" : "#c02010";
      ctx.fillRect(-14 - i * 3, -2 + Math.sin(t * 20 + i) * 1, 4, 4 - i);
    }
    // Shaft
    ctx.fillStyle = "#3a2010"; ctx.fillRect(-12, -1, 20, 2);
    ctx.fillStyle = "#7a4a20"; ctx.fillRect(-12, -1, 20, 1);
    // Bronze spearhead
    ctx.fillStyle = "#c9700a"; ctx.fillRect(6, -3, 7, 6);
    ctx.fillStyle = "#e6c261"; ctx.fillRect(6, -3, 7, 2);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(12, -1, 2, 2);
    // Fire tongue at the tip
    ctx.fillStyle = "#ffb040"; ctx.fillRect(13, -2, 3, 4);
    ctx.fillStyle = "#fff2b0"; ctx.fillRect(14, -1, 2, 2);
  }
  ctx.restore();
}

// Pixel-art bubble field for the plague of boils. No auxiliary FX.
function drawBoilsCloud(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const particles = e.data?.particles as Array<{ ox: number; oy: number; phase: number; amp: number; size: number }> | undefined;
  if (!particles) return;
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const t = e.animT;
  const maxTtl = (e.data?.maxTtl as number) ?? 6;
  const remaining = (e.ttl ?? 0) / maxTtl;
  let fade = 1;
  if (remaining > 0.85) fade = (1 - remaining) / 0.15;
  else if (remaining < 0.3) fade = remaining / 0.3;
  fade = Math.max(0, Math.min(1, fade));
  ctx.save();
  for (const p of particles) {
    const jx = Math.cos(t * 1.6 + p.phase) * p.amp * 0.4;
    const jy = Math.sin(t * 1.9 + p.phase * 1.3) * p.amp * 0.4;
    // Individual bubble grows & pops rhythmically
    const grow = 0.7 + 0.3 * Math.sin(t * 2.4 + p.phase * 2);
    const bs = Math.max(3, Math.round((p.size + 3) * grow));
    const x = Math.round(cx + p.ox + jx);
    const y = Math.round(cy + p.oy + jy);
    ctx.globalAlpha = fade * 0.95;
    // Base (angry red/purple boil)
    ctx.fillStyle = "#5a1030"; ctx.fillRect(x - bs / 2, y - bs / 2, bs, bs);
    ctx.fillStyle = "#8a2050"; ctx.fillRect(x - bs / 2 + 1, y - bs / 2 + 1, bs - 2, bs - 2);
    ctx.fillStyle = "#c0407a"; ctx.fillRect(x - bs / 2 + 2, y - bs / 2 + 2, Math.max(1, bs - 4), Math.max(1, bs - 4));
    // Highlight (top-left) — makes it read as a rounded bubble
    ctx.fillStyle = "#ffc0d8";
    ctx.fillRect(x - bs / 2 + 1, y - bs / 2 + 1, Math.max(1, Math.floor(bs / 3)), 1);
    ctx.fillRect(x - bs / 2 + 1, y - bs / 2 + 2, 1, Math.max(1, Math.floor(bs / 3) - 1));
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}


// ---------------- Red Sea ----------------
function drawRedSeaWall(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const d = e.data!;
  const height = (d.height as number) * 2;
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const sign = (d.sign as number) ?? (e.vel.x > 0 ? 1 : -1);
  // Everything behind the advancing wave is ocean — extend a huge rectangle
  // back to the far edge of the screen. sign=+1 means moving right, so the
  // ocean fills to the LEFT of the wall.
  const oceanFar = 4000; // enough to cover any viewport
  const oceanX = sign > 0 ? x - oceanFar : x;
  const oceanW = oceanFar;
  ctx.save();
  // Layered water bands (low-poly ocean)
  const bands = [
    { c: "#0e2a5c", a: 1.0 },
    { c: "#164694", a: 1.0 },
    { c: "#1e6ac0", a: 1.0 },
    { c: "#3f97dc", a: 1.0 },
  ];
  const bandH = height / bands.length;
  for (let i = 0; i < bands.length; i++) {
    ctx.globalAlpha = bands[i].a;
    ctx.fillStyle = bands[i].c;
    ctx.fillRect(oceanX, y - height / 2 + i * bandH, oceanW, bandH + 1);
  }
  // Animated pixel-art waves scattered through the ocean field
  const t = e.animT;
  ctx.fillStyle = "rgba(180,220,255,0.55)";
  for (let ry = -Math.floor(height / 2); ry < Math.floor(height / 2); ry += 14) {
    for (let rx = 0; rx < oceanW; rx += 28) {
      const wob = Math.sin((rx + t * 40) * 0.05 + ry * 0.1) * 3;
      const wx = oceanX + rx + wob;
      const wy = y + ry;
      ctx.fillRect(Math.round(wx), Math.round(wy), 6, 2);
      ctx.fillRect(Math.round(wx + 8), Math.round(wy + 4), 4, 2);
    }
  }
  // Whitecaps
  ctx.fillStyle = "#ffffff";
  for (let ry = -Math.floor(height / 2); ry < Math.floor(height / 2); ry += 22) {
    for (let rx = 0; rx < oceanW; rx += 46) {
      const wob = Math.sin((rx + t * 60) * 0.04 + ry * 0.08) * 4;
      ctx.fillRect(Math.round(oceanX + rx + wob), Math.round(y + ry), 3, 2);
    }
  }

  // Cresting wave-front (bright foam + spray)
  const crestW = 24;
  ctx.fillStyle = "#4fb0ff";
  ctx.fillRect(x - (sign > 0 ? crestW : 0), y - height / 2, crestW, height);
  ctx.fillStyle = "#a8d8ff";
  ctx.fillRect(x - (sign > 0 ? crestW - 4 : 4), y - height / 2, 4, height);
  ctx.fillStyle = "#ffffff";
  // Foam scallops along the crest
  const crests = Math.floor(height / 10);
  for (let i = 0; i < crests; i++) {
    const yy = y - height / 2 + i * 10 + Math.sin(t * 4 + i) * 2;
    ctx.fillRect(x - (sign > 0 ? 4 : 0), Math.round(yy), 4, 5);
  }
  // Spray droplets flying forward
  ctx.fillStyle = "rgba(220,240,255,0.85)";
  for (let i = 0; i < 26; i++) {
    const yy = y - height / 2 + Math.random() * height;
    const xx = x + sign * (4 + Math.random() * 60);
    ctx.fillRect(Math.round(xx), Math.round(yy), 2, 2);
  }
  ctx.restore();
}

function drawRedSeaBurst(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 0.55;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxTtl));
  const t = 1 - life;
  const cx = e.pos.x - camX, cy = e.pos.y - camY;
  const R = ((e.data?.radius as number) ?? 220) * (0.3 + t * 1.2);
  ctx.save();
  ctx.globalAlpha = life * 0.9;
  const grd = ctx.createRadialGradient(cx, cy, 4, cx, cy, R);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.4, "rgba(160,220,255,0.7)");
  grd.addColorStop(1, "rgba(40,90,180,0)");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = life;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2); ctx.stroke();
  // Foam splashes
  const splashes = 30;
  for (let i = 0; i < splashes; i++) {
    const a = (i / splashes) * Math.PI * 2 + t * 3;
    const rr = R * (0.75 + Math.random() * 0.25);
    const px = Math.round(cx + Math.cos(a) * rr);
    const py = Math.round(cy + Math.sin(a) * rr);
    ctx.fillStyle = i % 2 ? "#ffffff" : "#b0d8ff";
    ctx.fillRect(px - 1, py - 1, 3, 3);
  }
  // Dust cloud rim
  ctx.globalAlpha = life * 0.5;
  ctx.fillStyle = "#e8c88a";
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = R * (0.9 + Math.random() * 0.2);
    ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.4), 3, 3);
  }
  ctx.restore();
}

// ---------------- Bonus pickups ----------------
// Shared pixel-art registry — the ground pickup AND the HUD active-buff icon
// render from the exact same grid so the visual language stays consistent.
// Grids are ~14 wide, drawn at half the previous pixel size so each icon
// carries ~2× the detail while keeping the same on-screen footprint.
export const BONUS_ART: Record<BonusKind, { grid: string[]; palette: Record<string, string> }> = {
  heart: {
    grid: [
      "..KKK....KKK..",
      ".KRRRK..KRRRK.",
      "KRhhRKKKKRhhRK",
      "KRWWhRRRRhhhRK",
      "KRWhhhhhhhhhRK",
      "KRhhhhhhhhhhRK",
      "KRRhhhhhhhhRRK",
      ".KRhhhhhhhhRK.",
      "..KRhhhhhhRK..",
      "...KRhhhhRK...",
      "....KRhhRK....",
      ".....KRRK.....",
      "......KK......",
      "..............",
    ],
    palette: { K: "#3a0a12", R: "#e12038", h: "#ff5566", W: "#ffd0d6" },
  },
  magnet: {
    grid: [
      "..KKKKKKKKKK..",
      ".KRRRRRRRRRRK.",
      "KRhhhhhhhhhhRK",
      "KRhhWhhhhWhhRK",
      "KRhhhKKKKhhhRK",
      "KRhhRK..KRhhRK",
      "KRhhRK..KRhhRK",
      "KRhhRK..KRhhRK",
      "KRRRRK..KRRRRK",
      "KSSSSK..KSSSSK",
      "KSwwSK..KSwwSK",
      "KSSSSK..KSSSSK",
      "KKKKKK..KKKKKK",
      "..............",
    ],
    palette: { K: "#2a0810", R: "#d02030", h: "#ff5060", W: "#ffd0d6", S: "#8a8f96", w: "#e6ecef" },
  },
  star: {
    grid: [
      "......KK......",
      ".....KYYK.....",
      ".....KYyK.....",
      "KKKKKKYyKKKKKK",
      "KYyyyyYyyyyyYK",
      ".KYyyyyyyyyYK.",
      "..KYyyWWyyYK..",
      "..KYyyyyyyYK..",
      ".KYyyYYYYyyYK.",
      "KYyYK....KYyYK",
      "KYYK......KYYK",
      "KKK........KKK",
      "..............",
      "..............",
    ],
    palette: { K: "#3a2a08", Y: "#e8a820", y: "#ffd54a", W: "#fff8c0" },
  },
  lightning: {
    grid: [
      "........KKK...",
      ".......KYYK...",
      "......KYyYK...",
      "KKKKKKYyyYK...",
      "KYyyyyyyYK....",
      "KYyyWyyyK.....",
      "KYyyyyYK......",
      ".KKKKKYYKKKKK.",
      "....KYyyyyyyYK",
      "....KYyyWyyyYK",
      "....KYyyyyyYK.",
      ".....KYyyyYK..",
      "......KYyYK...",
      ".......KKK....",
    ],
    palette: { K: "#3a2a08", Y: "#e8a820", y: "#ffe040", W: "#fffbaa" },
  },
  shield: {
    grid: [
      "..KKKKKKKKKK..",
      ".KBBBBBBBBBBK.",
      "KBWWWWWWWWWWBK",
      "KBWWCCCCCCWWBK",
      "KBWCCGCCGCCWBK",
      "KBWCGGGGGGCWBK",
      "KBWCCGGGGCCWBK",
      "KBWCCCGGCCCWBK",
      "KBWCCCCCCCCWBK",
      "KBWWCCCCCCWWBK",
      "KBBWWWWWWWWBBK",
      ".KBBBBBBBBBBK.",
      "..KKBBBBBBKK..",
      "....KKKKKK....",
    ],
    palette: { K: "#101828", B: "#2b4a7a", W: "#dbe9f7", C: "#8ec8ff", G: "#e6c261" },
  },
};

function drawBonusArt(
  ctx: CanvasRenderingContext2D,
  kind: BonusKind,
  cx: number,
  cy: number,
  px: number,
) {
  const art = BONUS_ART[kind];
  const gw = art.grid[0].length;
  const gh = art.grid.length;
  const ox = cx - Math.floor((gw * px) / 2);
  const oy = cy - Math.floor((gh * px) / 2);
  for (let ry = 0; ry < gh; ry++) {
    const row = art.grid[ry];
    for (let rx = 0; rx < gw; rx++) {
      const c = art.palette[row[rx]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + rx * px, oy + ry * px, px, px);
    }
  }
}

function drawBonus(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState) {
  const kind = (e.data?.bonusKind as BonusKind) ?? "heart";
  void BONUSES[kind]; // ensures import is used
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY) + Math.round(Math.sin(s.now * 2.5 + e.id) * 4);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(x, y + 22, 14, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // Half the previous pixel size (3 instead of 6) — same on-screen size,
  // ~2× the pixel detail per icon.
  drawBonusArt(ctx, kind, x, y, 3);
  ctx.restore();
}


// ---------------- shared hazard renderers ----------------
function drawParticleCloud(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, tint: { backing: string; particle: string; highlight?: string }) {
  const particles = e.data?.particles as Array<{ ox: number; oy: number; phase: number; amp: number; size: number }> | undefined;
  if (!particles) return;
  const maxTtl = (e.data?.maxTtl as number) ?? 5;
  const remaining = (e.ttl ?? 0) / maxTtl;
  let fade = 1;
  if (remaining > 0.85) fade = (1 - remaining) / 0.15;
  else if (remaining < 0.3) fade = remaining / 0.3;
  fade = Math.max(0, Math.min(1, fade));
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const t = e.animT;
  const r = (e.data?.radius as number) ?? 80;
  ctx.save();
  ctx.globalAlpha = 0.28 * fade;
  const grd = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  grd.addColorStop(0, tint.backing);
  grd.addColorStop(1, tint.backing.replace(/,[^,]+\)$/, ",0)"));
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const p of particles) {
    const jx = Math.cos(t * 3 + p.phase) * p.amp;
    const jy = Math.sin(t * 3.7 + p.phase * 1.3) * p.amp;
    const a = fade * (0.7 + 0.3 * Math.sin(t * 4 + p.phase));
    ctx.globalAlpha = a;
    ctx.fillStyle = tint.highlight && Math.random() < 0.18 ? tint.highlight : tint.particle;
    ctx.fillRect(Math.round(cx + p.ox + jx), Math.round(cy + p.oy + jy), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawLocustSwarm(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const particles = e.data?.particles as Array<{ ox: number; oy: number; phase: number; amp: number; wing: number; hopPhase: number }> | undefined;
  if (!particles) return;
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const t = e.animT;
  const bw = (e.data?.bandW as number) ?? 800;
  const bh = (e.data?.bandH as number) ?? 140;
  ctx.save();
  // Darkened band behind the swarm — the sky itself dims where they pass.
  const grd = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
  grd.addColorStop(0, "rgba(30,20,10,0)");
  grd.addColorStop(0.5, "rgba(30,20,10,0.35)");
  grd.addColorStop(1, "rgba(30,20,10,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
  ctx.restore();
  for (const p of particles) {
    const jx = Math.cos(t * 5 + p.phase) * p.amp;
    // Slight up-down hop while streaming down the screen.
    const hop = Math.sin(t * 9 + p.hopPhase) * 3;
    const x = Math.round(cx + p.ox + jx);
    const y = Math.round(cy + p.oy + hop);
    // Brown locust body — 4-wide pixel art with head accent
    ctx.fillStyle = "#3a2410"; ctx.fillRect(x, y + 1, 4, 2);
    ctx.fillStyle = "#7a5220"; ctx.fillRect(x, y, 4, 1);
    ctx.fillStyle = "#a87830"; ctx.fillRect(x + 3, y, 1, 1); // head
    // Wings (flap)
    const flap = Math.sin(t * 26 + p.wing) > 0;
    ctx.fillStyle = "rgba(210,180,110,0.9)";
    if (flap) {
      ctx.fillRect(x - 2, y - 2, 2, 2); ctx.fillRect(x + 4, y - 2, 2, 2);
    } else {
      ctx.fillRect(x - 2, y, 2, 1); ctx.fillRect(x + 4, y, 2, 1);
    }
    // Legs
    ctx.fillStyle = "#2a1808";
    ctx.fillRect(x + 1, y + 3, 1, 1); ctx.fillRect(x + 3, y + 3, 1, 1);
  }
}

function drawHailstone(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  ctx.strokeStyle = "rgba(200,225,255,0.5)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - e.vel.x * 0.08, y - e.vel.y * 0.08); ctx.lineTo(x, y); ctx.stroke();
  ctx.fillStyle = "#4a6a90"; ctx.fillRect(x - 5, y - 4, 10, 9);
  ctx.fillStyle = "#8fb0d4"; ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.fillStyle = "#dbe9f7"; ctx.fillRect(x - 3, y - 3, 6, 6);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 2, y - 3, 3, 3);
  ctx.fillStyle = "#a8c8e4"; ctx.fillRect(x + 1, y + 1, 2, 2);
}

function drawHailImpact(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 0.45;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxTtl));
  const cx = Math.round(e.pos.x - camX);
  const cy = Math.round(e.pos.y - camY);
  const R = (e.data?.radius as number) ?? 60;
  const t = 1 - life;
  ctx.save();
  ctx.globalAlpha = life;
  // Pixel-art icy shards radiating outward — no radial gradient.
  const shards = 10;
  for (let i = 0; i < shards; i++) {
    const a = (i / shards) * Math.PI * 2 + t * 0.6;
    const len = R * (0.35 + t * 0.55);
    const steps = Math.max(3, Math.floor(len / 6));
    for (let s = 0; s < steps; s++) {
      const rr = (s / steps) * len;
      const px = Math.round(cx + Math.cos(a) * rr);
      const py = Math.round(cy + Math.sin(a) * rr);
      const size = s < 2 ? 4 : s < 4 ? 3 : 2;
      const shade = s < 2 ? "#ffffff" : s < 5 ? "#dbe9f7" : s < 8 ? "#8fb0d4" : "#4a6a90";
      ctx.fillStyle = shade;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }
  }
  // Central shatter cluster — chunky ice pixels
  const cluster: Array<[number, number, string]> = [
    [-2, -2, "#dbe9f7"], [1, -3, "#ffffff"], [3, 0, "#8fb0d4"],
    [-3, 1, "#8fb0d4"], [0, 2, "#dbe9f7"], [-4, -1, "#4a6a90"], [2, 3, "#4a6a90"],
  ];
  for (const [dx, dy, col] of cluster) {
    ctx.fillStyle = col;
    ctx.fillRect(cx + dx * 2, cy + dy * 2, 3, 3);
  }
  ctx.restore();
}

function drawFireball(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const t = e.animT || 0;
  ctx.save();
  const trailLen = 10;
  for (let i = trailLen; i >= 1; i--) {
    const tx = x - e.vel.x * 0.02 * i;
    const ty = y - e.vel.y * 0.02 * i;
    const k = i / trailLen;
    ctx.globalAlpha = (1 - k) * 0.85;
    const sz = Math.max(2, Math.round(12 - k * 10));
    ctx.fillStyle = i < 3 ? "#fff4b0" : i < 6 ? "#ffb040" : i < 9 ? "#ff5010" : "#8a1a00";
    ctx.fillRect(Math.round(tx - sz / 2), Math.round(ty - sz / 2), sz, sz);
  }
  ctx.globalAlpha = 1;
  const flick = Math.sin(t * 30) * 1.5;
  ctx.fillStyle = "#7a1400"; ctx.fillRect(x - 10, y - 10, 20, 20);
  ctx.fillStyle = "#ff3010"; ctx.fillRect(x - 9, y - 9, 18, 18);
  ctx.fillStyle = "#ff7020"; ctx.fillRect(x - 7 + flick, y - 7, 14, 14);
  ctx.fillStyle = "#ffb050"; ctx.fillRect(x - 5, y - 5, 10, 10);
  ctx.fillStyle = "#ffe090"; ctx.fillRect(x - 3, y - 3 + flick, 6, 6);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.fillStyle = "#ffd070";
  for (let i = 0; i < 6; i++) {
    const a = t * 6 + i;
    const rr = 12 + (i % 3) * 3;
    ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 2, 2);
  }
  ctx.restore();
}

function drawFireExplosion(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 0.4;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxTtl));
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const R = ((e.data?.radius as number) ?? 90) * 1.35;
  const rNow = R * (1 - life * 0.85) + 12;
  ctx.save();
  ctx.globalAlpha = life * 0.6;
  const smoke = ctx.createRadialGradient(cx, cy, rNow * 0.4, cx, cy, rNow * 1.25);
  smoke.addColorStop(0, "rgba(80,20,0,0.6)");
  smoke.addColorStop(1, "rgba(60,20,10,0)");
  ctx.fillStyle = smoke;
  ctx.beginPath(); ctx.arc(cx, cy, rNow * 1.25, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = life;
  const grd = ctx.createRadialGradient(cx, cy, rNow * 0.15, cx, cy, rNow);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(0.25, "#fff2b0");
  grd.addColorStop(0.55, "#ff8020");
  grd.addColorStop(0.85, "#c02010");
  grd.addColorStop(1, "rgba(80,20,0,0)");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, rNow, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = life * 0.8;
  ctx.strokeStyle = "#ffd070"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, rNow * 0.85, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = life;
  const embers = 22;
  for (let i = 0; i < embers; i++) {
    const a = (i / embers) * Math.PI * 2 + (1 - life) * 2;
    const rr = rNow * (0.75 + ((i * 13) % 7) / 20);
    const px = Math.round(cx + Math.cos(a) * rr);
    const py = Math.round(cy + Math.sin(a) * rr);
    ctx.fillStyle = i % 3 === 0 ? "#fff4b0" : i % 3 === 1 ? "#ff8020" : "#ffcc40";
    ctx.fillRect(px - 1, py - 1, 3, 3);
    ctx.fillStyle = "#3a0800"; ctx.fillRect(px, py, 1, 1);
  }
  ctx.restore();
}

function drawFirstbornCloud(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const particles = e.data?.particles as Array<{ ox: number; oy: number; phase: number; amp: number; size: number }> | undefined;
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const t = e.animT;
  const r = (e.data?.radius as number) ?? 95;
  const maxTtl = (e.data?.maxTtl as number) ?? 6;
  const remaining = (e.ttl ?? 0) / maxTtl;
  let fade = 1;
  if (remaining > 0.85) fade = (1 - remaining) / 0.15;
  else if (remaining < 0.3) fade = remaining / 0.3;
  fade = Math.max(0, Math.min(1, fade));
  ctx.save();
  ctx.globalAlpha = 0.35 * fade;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 1.35);
  halo.addColorStop(0, "rgba(255,250,220,0.95)");
  halo.addColorStop(0.5, "rgba(255,240,180,0.4)");
  halo.addColorStop(1, "rgba(255,240,180,0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.85 * fade;
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.6, "rgba(255,250,210,0.7)");
  core.addColorStop(1, "rgba(255,250,210,0)");
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (particles) {
    for (const p of particles) {
      const jx = Math.cos(t * 2 + p.phase) * p.amp;
      const jy = Math.sin(t * 2.5 + p.phase * 1.3) * p.amp;
      const shimmer = 0.55 + 0.45 * Math.sin(t * 5 + p.phase * 2);
      ctx.globalAlpha = fade * shimmer;
      ctx.fillStyle = shimmer > 0.85 ? "#ffffff" : "#fff4c0";
      const x = Math.round(cx + p.ox + jx);
      const y = Math.round(cy + p.oy + jy);
      ctx.fillRect(x, y, p.size, p.size);
      if (shimmer > 0.9) {
        ctx.fillStyle = "#ffd070";
        ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + p.size, y, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawGnatSwarm(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const particles = e.data?.particles as Array<{ ox: number; oy: number; phase: number; amp: number }> | undefined;
  if (!particles) return;
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const t = e.animT;
  const r = (e.data?.radius as number) ?? 55;
  const maxTtl = (e.data?.maxTtl as number) ?? 5;
  const remaining = (e.ttl ?? 0) / maxTtl;
  let fade = 1;
  if (remaining > 0.85) fade = (1 - remaining) / 0.15;
  else if (remaining < 0.3) fade = remaining / 0.3;
  fade = Math.max(0, Math.min(1, fade));
  ctx.save();
  ctx.globalAlpha = 0.18 * fade;
  const grd = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  grd.addColorStop(0, "rgba(40,30,20,0.75)");
  grd.addColorStop(1, "rgba(40,30,20,0)");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const p of particles) {
    const jx = Math.cos(t * 3 + p.phase) * p.amp;
    const jy = Math.sin(t * 3.7 + p.phase * 1.3) * p.amp;
    const x = Math.round(cx + p.ox + jx);
    const y = Math.round(cy + p.oy + jy);
    const flap = Math.sin(t * 26 + p.phase * 3) > 0;
    ctx.globalAlpha = fade * 0.9;
    ctx.fillStyle = "rgba(70,55,40,0.75)";
    if (flap) { ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); }
    else { ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); }
    ctx.fillStyle = "#0a0805"; ctx.fillRect(x - 1, y, 2, 2);
    ctx.fillStyle = "#4a341f"; ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ---------------- Companions (per-NPC procedural renderer) ----------------
// Every companion is drawn on the same 3-pixel grid used for Moses so silhouettes
// share pixel density, palette weight and shading language. Each companion has
// its own body + headgear + weapon so no two can be confused at a glance.
//
// Animation states, all driven from `e.data`:
//   - walking: alternates leg positions each animation half-step
//   - attack:  windup pose (arm cocked) -> swing pose (weapon extended)
//   - downed:  flat body + red X marker, sinks to the ground
//   - standup: brief kneeling rise before returning to normal
//   - summon:  1s golden light with sparkles; companion is invulnerable
type NpcIdT = import("./types").NpcId;

const CPX = 3; // one companion pixel = 3 screen pixels (same as Moses)

// Per-companion palette + drawer selectors.
type CompanionArt = {
  robe: string; robeShade: string; trim: string;
  skin: string; skinShade: string;
  hair: string; hairShade: string;
  head: string; headAcc: string;
  drawHead: (px: PxDraw, walk: number) => void;
  drawWeapon: (ctx: CanvasRenderingContext2D, x: number, y: number, bob: number, flip: number, pose: AttackPose) => void;
  // If true, this companion has a broader torso silhouette (warriors).
  broad?: boolean;
};

type PxDraw = (dx: number, dy: number, w: number, h: number, color: string) => void;

type AttackPose = {
  /** -1..0 during windup (arm cocked back), 0..1 during swing (arm forward). */
  swing: number;
  /** true while windup is playing. */
  windup: boolean;
  /** true while swing is playing. */
  active: boolean;
};

const COMPANION_ART: Partial<Record<NpcIdT, CompanionArt>> = {
  bithiah: {
    robe: "#e6c261", robeShade: "#a17048", trim: "#3060c0",
    skin: "#e6c39a", skinShade: "#c99a6c",
    hair: "#2b1d14", hairShade: "#4a2c18",
    head: "#3060c0", headAcc: "#e6c261",
    drawHead: (px) => {
      // Egyptian princess nemes — blue+gold striped
      for (let i = 0; i < 8; i++) px(-4 + i, -27, 1, 5, i % 2 === 0 ? "#3060c0" : "#e6c261");
      px(-5, -22, 10, 1, "#e6c261"); px(-5, -22, 10, 1, "#c9700a");
      // Side flaps
      px(-6, -22, 1, 5, "#3060c0"); px(5, -22, 1, 5, "#3060c0");
      px(-6, -20, 1, 1, "#e6c261"); px(5, -20, 1, 1, "#e6c261");
      // Face — kohl eyes
      px(-3, -22, 6, 6, "#e6c39a");
      px(-3, -20, 6, 1, "#c99a6c");
      px(-3, -21, 2, 1, "#2b1d14"); px(1, -21, 2, 1, "#2b1d14");
      // Uraeus
      px(-1, -29, 2, 2, "#e6c261"); px(-1, -28, 2, 1, "#a12b2b");
    },
    drawWeapon: (ctx, x, y, bob, flip, pose) => {
      // Papyrus/reed sceptre — tall gold rod ending in a lotus flower.
      const cocked = pose.windup ? -0.6 : (pose.active ? -0.3 + pose.swing * 1.4 : -0.25);
      ctx.save();
      ctx.translate(x + flip * 8 * CPX, y + (-14 * CPX) + bob);
      ctx.rotate(cocked * flip);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(0, -1, 42, 3);
      ctx.fillStyle = "#e6c261"; ctx.fillRect(0, 0, 42, 1);
      // Lotus tip
      ctx.fillStyle = "#e6c261"; ctx.fillRect(38, -6, 8, 3);
      ctx.fillStyle = "#c9700a"; ctx.fillRect(38, -3, 8, 2);
      ctx.fillStyle = "#3060c0"; ctx.fillRect(40, -8, 4, 3);
      ctx.restore();
    },
  },
  aaron: {
    robe: "#d06544", robeShade: "#8f3a26", trim: "#e6c261",
    skin: "#e6c39a", skinShade: "#c99a6c",
    hair: "#f6efdc", hairShade: "#c9a05a",
    head: "#f6efdc", headAcc: "#3060c0",
    drawHead: (px) => {
      // White high-priest turban with gold band + blue plaque (Exodus 28)
      px(-5, -27, 10, 2, "#f6efdc");
      px(-6, -25, 12, 3, "#f6efdc");
      px(-6, -25, 12, 1, "#d8b98a");
      // Gold band + blue tzitz
      px(-6, -23, 12, 1, "#e6c261");
      px(-2, -22, 4, 1, "#3060c0");
      // Face + full grey beard
      px(-3, -22, 6, 5, "#e6c39a");
      px(-3, -20, 2, 1, "#2b1d14"); px(1, -20, 2, 1, "#2b1d14");
      px(-4, -17, 8, 4, "#f6efdc");
      px(-4, -17, 8, 1, "#d8b98a");
    },
    drawWeapon: (ctx, x, y, bob, flip, pose) => {
      // Sacred rod that budded (Numbers 17) — dark wood with gold band + almond bud
      const ang = pose.windup ? -2.0 : (pose.active ? -1.8 + pose.swing * 2.4 : -1.2);
      ctx.save();
      ctx.translate(x + flip * 5 * CPX, y + (-18 * CPX) + bob);
      ctx.rotate(ang * flip);
      ctx.fillStyle = "#2b1d14"; ctx.fillRect(-3, -2, 44, 4);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(-3, -1, 44, 2);
      ctx.fillStyle = "#e6c261"; ctx.fillRect(18, -2, 3, 4); // gold band
      ctx.fillStyle = "#f4e2c1"; ctx.fillRect(40, -4, 5, 4); // almond bud
      ctx.fillStyle = "#e6c261"; ctx.fillRect(40, -6, 5, 2);
      ctx.restore();
    },
  },
  miriam: {
    robe: "#d97e8c", robeShade: "#8a4753", trim: "#e6c261",
    skin: "#e6c39a", skinShade: "#c99a6c",
    hair: "#4a2c18", hairShade: "#2b1d14",
    head: "#c94a6a", headAcc: "#e6c261",
    drawHead: (px) => {
      // Rose veil covering hair, gold trim
      px(-5, -27, 10, 3, "#c94a6a");
      px(-5, -27, 10, 1, "#e6c261");
      px(-6, -24, 12, 4, "#d97e8c");
      px(-6, -24, 12, 1, "#c94a6a");
      // Face
      px(-3, -22, 6, 5, "#e6c39a");
      px(-3, -20, 2, 1, "#2b1d14"); px(1, -20, 2, 1, "#2b1d14");
      // Braid falling on shoulder
      px(4, -19, 2, 5, "#4a2c18");
      px(4, -19, 2, 1, "#2b1d14");
    },
    drawWeapon: (ctx, x, y, bob, flip, pose) => {
      // Bronze bowl of water held forward, sloshes then splashes on swing.
      const bx = x + flip * 9 * CPX;
      const by = y + (-14 * CPX) + bob;
      const tilt = pose.active ? pose.swing * 0.6 * flip : 0;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(tilt);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(-9, 0, 18, 3);
      ctx.fillStyle = "#c9700a"; ctx.fillRect(-9, 2, 18, 2);
      ctx.fillStyle = "#3060c0"; ctx.fillRect(-8, -3, 16, 4);
      ctx.fillStyle = "#7fc7ff"; ctx.fillRect(-8, -3, 16, 1);
      ctx.restore();
      // Splash arc during swing
      if (pose.active && pose.swing > 0.1) {
        ctx.save();
        ctx.globalAlpha = 1 - pose.swing * 0.5;
        for (let i = 0; i < 6; i++) {
          const t = i / 5;
          const rx = bx + flip * (6 + t * 40);
          const ry = by - 2 - Math.sin(t * Math.PI) * (14 + pose.swing * 8);
          ctx.fillStyle = i % 2 ? "#7fc7ff" : "#dbe9f7";
          ctx.fillRect(Math.round(rx - 2), Math.round(ry - 2), 4, 4);
        }
        ctx.restore();
      }
    },
  },
  jethro: {
    robe: "#8a6d9e", robeShade: "#4d3a5c", trim: "#c9a05a",
    skin: "#d8b98a", skinShade: "#a17048",
    hair: "#e6dcc0", hairShade: "#a17048",
    head: "#4d3a5c", headAcc: "#c9a05a",
    drawHead: (px) => {
      // Wrapped Midianite hood — earthy purple with sand trim.
      px(-5, -27, 10, 2, "#4d3a5c");
      px(-6, -26, 12, 4, "#4d3a5c");
      px(-6, -22, 12, 1, "#c9a05a");
      // Old face
      px(-3, -22, 6, 5, "#d8b98a");
      px(-3, -20, 2, 1, "#2b1d14"); px(1, -20, 2, 1, "#2b1d14");
      // Long white beard
      px(-4, -17, 8, 6, "#f6efdc");
      px(-4, -17, 8, 1, "#d8b98a");
      px(-3, -12, 6, 2, "#f6efdc");
    },
    drawWeapon: (ctx, x, y, bob, flip, pose) => {
      // Tall pilgrim walking staff with wrapped grip; rises on swing.
      const ang = pose.windup ? 0.4 : (pose.active ? 0.15 - pose.swing * 0.9 : 0.1);
      ctx.save();
      ctx.translate(x + flip * 8 * CPX, y + (-14 * CPX) + bob);
      ctx.rotate(ang * flip);
      ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 30); ctx.stroke();
      ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 30); ctx.stroke();
      ctx.strokeStyle = "#b48355"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 30); ctx.stroke();
      // Leather wrap grip
      ctx.fillStyle = "#4d3a5c"; ctx.fillRect(-3, 4, 6, 8);
      ctx.fillStyle = "#c9a05a"; ctx.fillRect(-3, 5, 6, 1); ctx.fillRect(-3, 9, 6, 1);
      // Rounded top knob
      ctx.fillStyle = "#5a3820"; ctx.beginPath(); ctx.arc(0, -18, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
  },
  zipporah: {
    robe: "#4d7a3e", robeShade: "#2d5a3d", trim: "#c9a05a",
    skin: "#c99a6c", skinShade: "#8a5a34",
    hair: "#2b1d14", hairShade: "#4a2c18",
    head: "#a12b2b", headAcc: "#e6c261",
    drawHead: (px) => {
      // Red desert scarf with gold coins on brow.
      px(-5, -27, 10, 3, "#a12b2b");
      px(-6, -25, 12, 3, "#a12b2b");
      px(-5, -24, 10, 1, "#e6c261");
      // Coin fringe
      px(-4, -23, 1, 1, "#e6c261"); px(-1, -23, 1, 1, "#e6c261"); px(2, -23, 1, 1, "#e6c261");
      // Face
      px(-3, -22, 6, 5, "#c99a6c");
      px(-3, -20, 2, 1, "#2b1d14"); px(1, -20, 2, 1, "#2b1d14");
      // Loose hair on shoulder
      px(-6, -19, 2, 6, "#2b1d14"); px(4, -19, 2, 6, "#2b1d14");
    },
    drawWeapon: (ctx, x, y, bob, flip, pose) => {
      // Curved bronze dagger — quick slash.
      const ang = pose.windup ? -1.5 : (pose.active ? -1.2 + pose.swing * 2.6 : -0.6);
      ctx.save();
      ctx.translate(x + flip * 6 * CPX, y + (-12 * CPX) + bob);
      ctx.rotate(ang * flip);
      // handle
      ctx.fillStyle = "#4d3a5c"; ctx.fillRect(-2, -2, 8, 4);
      ctx.fillStyle = "#e6c261"; ctx.fillRect(-2, -2, 8, 1);
      // curved blade
      ctx.fillStyle = "#dbe9f7";
      ctx.beginPath();
      ctx.moveTo(6, -3); ctx.quadraticCurveTo(20, -8, 26, -2);
      ctx.lineTo(26, 2); ctx.quadraticCurveTo(20, -3, 6, 3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#a0a0a0";
      ctx.beginPath();
      ctx.moveTo(6, -3); ctx.quadraticCurveTo(20, -8, 26, -2);
      ctx.lineTo(26, 0); ctx.quadraticCurveTo(20, -5, 6, -1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    },
  },
  joshua: {
    robe: "#3060c0", robeShade: "#0f1b3d", trim: "#e6c261",
    skin: "#c99a6c", skinShade: "#8a5a34",
    hair: "#2b1d14", hairShade: "#4a2c18",
    head: "#b98550", headAcc: "#e6c261",
    broad: true,
    drawHead: (px) => {
      // Bronze conical warrior helmet with cheek guards.
      px(-4, -28, 8, 2, "#b98550");
      px(-5, -26, 10, 4, "#b98550");
      px(-5, -26, 10, 1, "#e6c261");
      px(-5, -23, 10, 1, "#7a5230");
      // Cheek guards
      px(-6, -22, 1, 4, "#b98550"); px(5, -22, 1, 4, "#b98550");
      px(-6, -22, 1, 1, "#7a5230"); px(5, -22, 1, 1, "#7a5230");
      // Face
      px(-3, -22, 6, 5, "#c99a6c");
      px(-3, -20, 2, 1, "#2b1d14"); px(1, -20, 2, 1, "#2b1d14");
      // Short warrior beard
      px(-3, -17, 6, 2, "#2b1d14");
    },
    drawWeapon: (ctx, x, y, bob, flip, pose) => {
      // Iron-tipped spear — pulled back on windup, thrust forward on swing.
      const push = pose.windup ? -6 : (pose.active ? -4 + pose.swing * 22 : 0);
      ctx.save();
      ctx.translate(x + flip * (6 * CPX + push), y + (-14 * CPX) + bob);
      ctx.scale(flip, 1);
      ctx.fillStyle = "#2b1d14"; ctx.fillRect(-6, -2, 44, 4);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(-6, -1, 44, 2);
      ctx.fillStyle = "#e6c261"; ctx.fillRect(24, -2, 3, 4); // grip band
      // Leaf-shaped blade
      ctx.fillStyle = "#dbe9f7";
      ctx.beginPath();
      ctx.moveTo(38, -2); ctx.lineTo(50, -5); ctx.lineTo(56, 0);
      ctx.lineTo(50, 5); ctx.lineTo(38, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#a0a0a0";
      ctx.beginPath();
      ctx.moveTo(38, -2); ctx.lineTo(50, -5); ctx.lineTo(56, 0);
      ctx.lineTo(50, 0); ctx.lineTo(38, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
  },
  hur: {
    robe: "#a12b2b", robeShade: "#5a1a1a", trim: "#e6c261",
    skin: "#c99a6c", skinShade: "#8a5a34",
    hair: "#e6dcc0", hairShade: "#a17048",
    head: "#a12b2b", headAcc: "#e6c261",
    broad: true,
    drawHead: (px) => {
      // Red warrior headband, salt-and-pepper hair, full beard.
      px(-5, -27, 10, 3, "#a17048"); // hair
      px(-5, -27, 10, 1, "#7a5230");
      px(-5, -24, 10, 1, "#a12b2b"); // headband
      px(-5, -24, 10, 1, "#e6c261");
      // Face
      px(-3, -22, 6, 5, "#c99a6c");
      px(-3, -20, 2, 1, "#2b1d14"); px(1, -20, 2, 1, "#2b1d14");
      // Grey beard
      px(-4, -17, 8, 5, "#d8b98a");
      px(-4, -17, 8, 1, "#a17048");
      px(-3, -14, 6, 2, "#f6efdc");
    },
    drawWeapon: (ctx, x, y, bob, flip, pose) => {
      // Bronze sword — vertical cock, wide diagonal slash.
      const ang = pose.windup ? -1.9 : (pose.active ? -1.6 + pose.swing * 2.5 : -1.0);
      ctx.save();
      ctx.translate(x + flip * 6 * CPX, y + (-16 * CPX) + bob);
      ctx.rotate(ang * flip);
      // hilt
      ctx.fillStyle = "#4d3a5c"; ctx.fillRect(-2, 0, 4, 6);
      ctx.fillStyle = "#e6c261"; ctx.fillRect(-4, 6, 8, 3); // crossguard
      ctx.fillStyle = "#c9700a"; ctx.fillRect(-4, 8, 8, 1);
      // pommel
      ctx.fillStyle = "#e6c261"; ctx.fillRect(-2, -2, 4, 2);
      // blade
      ctx.fillStyle = "#dbe9f7"; ctx.fillRect(-2, 9, 4, 28);
      ctx.fillStyle = "#a0a0a0"; ctx.fillRect(-2, 9, 2, 28);
      ctx.fillStyle = "#f6efdc"; ctx.fillRect(1, 9, 1, 28);
      // Swing arc
      if (pose.active && pose.swing > 0.1) {
        ctx.globalAlpha = (1 - pose.swing) * 0.6;
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 20, 22, -Math.PI / 3, Math.PI / 3); ctx.stroke();
      }
      ctx.restore();
    },
  },
  elder: {
    robe: "#4d3a5c", robeShade: "#2b1d14", trim: "#c9a05a",
    skin: "#d8b98a", skinShade: "#a17048",
    hair: "#f6efdc", hairShade: "#c9a05a",
    head: "#7a5230", headAcc: "#c9a05a",
    drawHead: (px) => {
      // Dark shepherd's hood, deep-set face, long white beard.
      px(-6, -27, 12, 3, "#4d3a5c");
      px(-6, -25, 12, 4, "#4d3a5c");
      px(-6, -25, 12, 1, "#2b1d14");
      px(-6, -21, 12, 1, "#c9a05a");
      // Face (in hood shadow)
      px(-3, -22, 6, 4, "#d8b98a");
      px(-3, -22, 6, 1, "#a17048");
      px(-3, -20, 2, 1, "#2b1d14"); px(1, -20, 2, 1, "#2b1d14");
      // Long beard
      px(-4, -18, 8, 6, "#f6efdc");
      px(-4, -18, 8, 1, "#d8b98a");
      px(-3, -12, 6, 3, "#f6efdc");
    },
    drawWeapon: (ctx, x, y, bob, flip, pose) => {
      // Shepherd's crook (older, weathered) — planted normally, small overhead lift on swing.
      const ang = pose.windup ? -0.6 : (pose.active ? -0.35 + pose.swing * 0.7 : -0.2);
      ctx.save();
      ctx.translate(x + flip * 7 * CPX, y + (-14 * CPX) + bob);
      const facing = flip === -1 ? -1 : 1;
      ctx.rotate(ang * facing);
      // Reuse shared shepherd staff renderer at length 54.
      drawShepherdStaff(ctx, 0, 0, 0, facing, 54);
      ctx.restore();
    },
  },
};

function drawCompanion(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState): boolean {
  const art = COMPANION_ART[e.kind as NpcIdT];
  if (!art) return false;
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const flip = e.facing === -1 ? -1 : 1;
  const d = e.data ?? {};

  const summonUntil = d.summonUntil as number | undefined;
  const inSummon = !!summonUntil && s.now < summonUntil;
  const downed = d.downedUntil != null;
  const standupUntil = d.standupUntil as number | undefined;
  const standing = !!standupUntil && s.now < standupUntil && !downed;

  const walking = Math.hypot(e.vel.x, e.vel.y) > 5;
  const walkFrame = walking ? (Math.floor(e.animT * 1.2) & 1) : 0;
  const bob = walking ? (walkFrame === 0 ? 0 : -1) * CPX : 0;

  // Attack pose extraction
  const attackT = (d.attackT as number | undefined) ?? 0;
  const attackTMax = (d.attackTMax as number | undefined) ?? 0.4;
  const windupDur = (d.attackWindup as number | undefined) ?? 0.18;
  const swingDur = (d.attackSwing as number | undefined) ?? 0.22;
  let pose: AttackPose = { swing: 0, windup: false, active: false };
  if (attackT > 0) {
    if (attackT > attackTMax - windupDur) {
      // Windup phase
      pose = { swing: 0, windup: true, active: false };
    } else {
      // Swing phase (progress 0..1)
      const p = 1 - attackT / swingDur;
      pose = { swing: Math.max(0, Math.min(1, p)), windup: false, active: true };
    }
  }

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 3.5, 0, 0, Math.PI * 2); ctx.fill();

  // ---------- Downed pose ----------
  if (downed) {
    const px: PxDraw = (dx, dy, w, h, color) => {
      ctx.fillStyle = color;
      const rx = flip === 1 ? x + dx * CPX : x - (dx + w) * CPX;
      // Rotated: draw body horizontally low on the ground.
      ctx.fillRect(rx, y + (dy + 4) * CPX, w * CPX, h * CPX);
    };
    ctx.save();
    ctx.globalAlpha = 0.75;
    // Simple prone silhouette using palette
    for (let i = 0; i < 14; i++) px(-7 + i, 0, 1, 3, i < 3 || i > 10 ? art.skin : art.robe);
    for (let i = 0; i < 14; i++) px(-7 + i, 3, 1, 1, art.robeShade);
    ctx.restore();
    // Red X marker
    ctx.strokeStyle = "#e04030"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x + 6, y + 4);
    ctx.moveTo(x + 6, y - 4); ctx.lineTo(x - 6, y + 4); ctx.stroke();
    ctx.fillStyle = "#f0e0a0"; ctx.font = "700 10px Nunito, sans-serif"; ctx.textAlign = "center";
    const remain = Math.max(0, Math.ceil((d.downedUntil as number) - s.now));
    ctx.fillText(`${remain}s`, x, y - 12);
    return true;
  }

  // ---------- Standup: rising / kneeling ----------
  const crouch = standing ? Math.round((1 - (standupUntil! - s.now) / 0.6) * -8) + 8 : 0;
  const bodyBob = bob + crouch * CPX;

  const px: PxDraw = (dx, dy, w, h, color) => {
    ctx.fillStyle = color;
    const rx = flip === 1 ? x + dx * CPX : x - (dx + w) * CPX;
    ctx.fillRect(rx, y + dy * CPX + bodyBob, w * CPX, h * CPX);
  };

  // ---------- Legs (walk cycle) ----------
  if (!standing) {
    if (walkFrame === 0) {
      px(-4, 0, 3, 6, art.robeShade); px(1, 0, 3, 6, art.robeShade);
    } else {
      px(-5, 0, 3, 6, art.robeShade); px(2, 0, 3, 6, art.robeShade);
    }
    // Feet / sandals
    px(-4 - (walkFrame === 0 ? 0 : 1), 6, 3, 1, "#2b1d14");
    px(1 + (walkFrame === 0 ? 0 : 1), 6, 3, 1, "#2b1d14");
  } else {
    // Kneeling
    px(-5, 2, 4, 4, art.robeShade); px(1, 2, 4, 4, art.robeShade);
    px(-5, 6, 10, 1, "#2b1d14");
  }

  // ---------- Robe / torso ----------
  const bw = art.broad ? 15 : 14;
  const bx = art.broad ? -7 : -7;
  px(bx, -14, bw, 15, art.robe);
  // Vertical crease shading
  px(bx + 1, -12, 1, 12, art.robeShade);
  px(bx + bw - 2, -12, 1, 12, art.robeShade);
  // Waist sash / trim band
  px(bx, -5, bw, 1, art.trim);
  px(bx, -4, bw, 1, art.robeShade);
  // Hem
  px(bx, 0, bw, 1, art.robeShade);
  // Chest highlight
  px(bx + 3, -13, bw - 6, 1, "#ffffff");
  ctx.globalAlpha = 0.15; px(bx + 3, -13, bw - 6, 1, "#ffffff"); ctx.globalAlpha = 1;

  // ---------- Arms ----------
  const armY = pose.windup ? -12 : (pose.active ? -13 + pose.swing * -1 : -12);
  // Rear arm always hangs
  px(bx - 1, armY, 2, 8, art.robe);
  px(bx - 1, armY + 6, 2, 2, art.skinShade);
  // Front arm — cocks back on windup, extends forward on swing
  const frontArmDx = pose.windup ? bx + bw - 3 : (pose.active ? bx + bw : bx + bw - 1);
  px(frontArmDx, armY, 2, 6, art.robe);
  px(frontArmDx, armY + 5, 2, 2, art.skin); // hand

  // ---------- Head ----------
  art.drawHead(px, walkFrame);

  // ---------- Weapon ----------
  if (!standing) {
    art.drawWeapon(ctx, x, y, bodyBob, flip, pose);
  }

  // ---------- Summon glow ----------
  if (inSummon) {
    const t = 1 - (summonUntil! - s.now) / 1.0; // 0..1
    ctx.save();
    // Vertical light pillar (fades in then out)
    const alpha = Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.85;
    ctx.globalAlpha = alpha * 0.45;
    const grad = ctx.createLinearGradient(x, y - 90, x, y + 12);
    grad.addColorStop(0, "rgba(255,240,150,0)");
    grad.addColorStop(0.5, "rgba(255,225,120,0.9)");
    grad.addColorStop(1, "rgba(255,200,80,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 22, y - 90, 44, 100);
    // Pulsing ring at feet
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#ffe680"; ctx.lineWidth = 3;
    const rr = 10 + Math.sin(t * Math.PI * 3) * 4 + t * 14;
    ctx.beginPath(); ctx.ellipse(x, y + 10, rr, rr * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#fff4b0"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y + 10, rr * 0.7, rr * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
    // Rising sparkles
    for (let i = 0; i < 10; i++) {
      const seed = i * 0.6180339;
      const px2 = (seed + t * 0.35) % 1;
      const sx0 = x + Math.round((seed * 30 - 15));
      const sy0 = y + 8 - Math.round(px2 * 70);
      const sz = ((i + Math.floor(t * 6)) & 1) ? 3 : 2;
      ctx.globalAlpha = alpha * (1 - px2);
      ctx.fillStyle = i % 3 === 0 ? "#fff4b0" : "#ffcf60";
      ctx.fillRect(sx0 - sz / 2, sy0 - sz / 2, sz, sz);
    }
    // Bright flash at spawn moment
    if (t < 0.15) {
      ctx.globalAlpha = 1 - t / 0.15;
      ctx.fillStyle = "#fffbe0";
      ctx.beginPath(); ctx.arc(x, y - 12, 30 * (t / 0.15 + 0.4), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- HP bar ----------
  const barW = 28;
  const barX = x - barW / 2;
  const barY = y - 34 * CPX / 3 - 6; // just above head
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(barX - 1, barY - 1, barW + 2, 5);
  ctx.fillStyle = "#1e5a1e"; ctx.fillRect(barX, barY, barW, 3);
  ctx.fillStyle = "#4ec24e"; ctx.fillRect(barX, barY, barW * Math.max(0, e.hp / e.maxHp), 3);

  return true;
}


