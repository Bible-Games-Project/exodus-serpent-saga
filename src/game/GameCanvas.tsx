import { useEffect, useRef, useState } from "react";
import { AARON, FLY, FROG, GEM, PALM, PYRAMID, ROCK, SERPENT, SOLDIER, renderSprite, type Sprite } from "./sprites";
import { drawRamsesArt } from "./ramsesArt";
import { drawSoldierArt, ensureSoldierArt, SOLDIER_ART } from "./soldierArt";
import { drawSwordSoldierArt, ensureSwordSoldierArt, SWORD_ART } from "./swordSoldierArt";
import { drawDogArt, ensureDogArt, DOG_ART } from "./dogArt";
import { drawMosesArt, mosesStaffTip, mosesSwingAngle, MOSES_ATTACK } from "./mosesGameArt";
export { mosesSwingAngle };
import { drawPixelShadow } from "./shadow";

import { applyUpgrade, createInitialState, dismissNewNpc, dismissNewPlague, update } from "./engine";
import { PLAGUES } from "./plagues";
import { NPCS } from "./npcs";
import { BONUSES, shieldDamageMul, type BonusKind } from "./bonuses";
import { damageMultiplier, magnetMultiplier, meleeMultiplier, speedMultiplier } from "./passives";
import { drawShepherdStaff } from "./staff";
import type { Entity, GameState, NpcId, PlagueId, UpgradeChoice } from "./types";
import desertTileAsset from "@/assets/tile-desert.png.asset.json";

const DESERT_TILE_URL = desertTileAsset.url;

/** Opacity of the white wash drawn over the ground texture only (0–1). */
const GROUND_WASH_OPACITY = 0.42;

// Renderer-local visual feedback; gameplay damage values remain untouched.
let lastRenderedPlayerHp = 0;
let hasRenderedPlayerHp = false;
let damageImpactUntil = 0;
let damageImpactKind: "normal" | "ramses" = "normal";


const SPRITE_MAP: Record<string, Sprite> = {
  serpent: SERPENT,
  soldier: SOLDIER,
  
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

// ---------------- Responsive composition ----------------
// The game is authored for a 1280x720 "design" viewport. On any other screen
// we scale the camera so the *visible world area* stays essentially constant:
// a small laptop, a large monitor and a phone all see the same amount of the
// map with Moses at the same relative size. Nothing is stretched — the zoom is
// uniform on both axes, only the aspect ratio of the framing changes.
const DESIGN_W = 1280;
const DESIGN_H = 720;

export function viewZoom(cssW: number, cssH: number): number {
  const area = Math.max(1, cssW * cssH) / (DESIGN_W * DESIGN_H);
  const z = Math.sqrt(area);
  return Math.max(0.8, Math.min(1.7, z));
}

/** Uniform scale for the bottom HUD so it never overflows narrow screens. */
function hudScale(cssW: number, cssH: number): number {
  return Math.max(0.5, Math.min(1, Math.min(cssW / 1000, cssH / 620)));
}

function useHudScale(): number {
  const [k, setK] = useState(() =>
    typeof window === "undefined" ? 1 : hudScale(window.innerWidth, window.innerHeight),
  );
  useEffect(() => {
    const on = () => setK(hudScale(window.innerWidth, window.innerHeight));
    on();
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return k;
}

function makeSandTile(): HTMLCanvasElement {
  // Ground base: authored desert tile, drawn into a power-of-two canvas so the
  // world size (8192) stays an exact multiple of the tile and wrapping is
  // seamless. Fallback flat sand until the image decodes.
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#eccf9e";
  g.fillRect(0, 0, size, size);

  const img = new Image();
  img.onload = () => {
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.clearRect(0, 0, size, size);
    g.drawImage(img, 0, 0, size, size);
  };
  img.src = DESERT_TILE_URL;

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
    // A new run starts with a clean renderer baseline, so the first frame is
    // never mistaken for a damage event from a previous session.
    lastRenderedPlayerHp = 0;
    hasRenderedPlayerHp = false;
    damageImpactUntil = 0;
    damageImpactKind = "normal";
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
      {
        // Logical (zoom-corrected) viewport so spawning/off-screen logic sees
        // the same world extents on every device.
        const z = viewZoom(cnv.clientWidth, cnv.clientHeight);
        s.viewport = { w: cnv.clientWidth / z, h: cnv.clientHeight / z };
      }

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
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(30,18,8,0.72)]">
              <div
                className="pixel-panel bg-[#FEEFBE] p-7 text-center"
                style={{ boxShadow: "0 6px 0 0 rgba(58,36,18,0.75)" }}
              >
                <h2 className="font-display mb-5 text-lg uppercase tracking-[0.14em] text-[#4a2c10]">Paused</h2>
                <button
                  onClick={onTogglePause}
                  className="pixel-btn pixel-btn-press font-display bg-[#e9c168] px-6 py-2 text-xs uppercase tracking-[0.14em] text-[#3a2412]"
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

// Pixel-art shepherd's staff for the melee-strike stat row (14x14).
const STAFF_ART: { grid: string[]; palette: Record<string, string> } = {
  palette: { K: "#2b1d14", w: "#8a5a34", d: "#b48355", W: "#f6efdc" },
  grid: [
    "....KKKK......",
    "...KddwwK.....",
    "..KdWK.KwK....",
    "..KdK...KwK...",
    "..KdK...KwK...",
    "..KdWK.KwK....",
    "...KdwwK......",
    "....KdWK......",
    "....KdwK......",
    "....KdwK......",
    "....KdwK......",
    "....KdwK......",
    "....KdwK......",
    "....KKKK......",
  ],
};

// Pixel-art sword for the damage stat row (14x14, same density as BONUS_ART).
const SWORD_ART: { grid: string[]; palette: Record<string, string> } = {
  palette: { K: "#2b1d14", W: "#f6efdc", S: "#b9c4cf", s: "#7e8b99", o: "#e6c261", O: "#b48836", b: "#7a4a2b" },
  grid: [
    "..........KKK.",
    ".........KWSK.",
    "........KWSSK.",
    ".......KWSSK..",
    "......KWSSK...",
    ".....KWSSK....",
    "....KWSSK.....",
    "...KWSSK......",
    "..KWSSK.......",
    ".KoOoOoOK.....",
    "KoOK.KOoK.....",
    ".KbK..KK......",
    ".KbK..........",
    ".KKK..........",
  ],
};

function StatPixelIcon({
  art,
  size,
}: {
  art: { grid: string[]; palette: Record<string, string> };
  size: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cnv = ref.current;
    if (!cnv) return;
    const gw = art.grid[0].length;
    const gh = art.grid.length;
    const px = Math.max(1, Math.ceil(size / Math.max(gw, gh)));
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
    // Integer scale only — never let the browser resample the sprite.
    cnv.style.width = `${cnv.width}px`;
    cnv.style.height = `${cnv.height}px`;
  }, [art, size]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated" }} />;

}

// Run-info pixel icons (14x14) — medal, hourglass clock, skull.
const MEDAL_ART: { grid: string[]; palette: Record<string, string> } = {
  palette: { K: "#2b1d14", r: "#a12b2b", R: "#e05a48", o: "#e6c261", O: "#b48836", W: "#f6efdc" },
  grid: [
    "..KK......KK..",
    "..KRK....KRK..",
    "..KrRK..KRrK..",
    "...KrRKKRrK...",
    "...KrrRRrrK...",
    "....KKKKKK....",
    "...KKoooKK....",
    "..KoOoWoOoK...",
    ".KoOoWWWoOoK..",
    ".KoOoWWWoOoK..",
    ".KoOooWooOoK..",
    "..KoOoooOoK...",
    "...KKoooKK....",
    ".....KKKK.....",
  ],
};

const CLOCK_ART: { grid: string[]; palette: Record<string, string> } = {
  palette: { K: "#2b1d14", t: "#c9b090", T: "#9a7f5c", W: "#f6efdc", o: "#e6c261" },
  grid: [
    "....KKKKKK....",
    "...KooooooK...",
    "..KKKKKKKKKK..",
    "..KtWTTTTWtK..",
    "...KtWTTWtK...",
    "....KtWWtK....",
    ".....KttK.....",
    ".....KttK.....",
    "....KtWWtK....",
    "...KtWooWtK...",
    "..KtWoooooWK..",
    "..KKKKKKKKKK..",
    "...KooooooK...",
    "....KKKKKK....",
  ],
};

const SKULL_ART: { grid: string[]; palette: Record<string, string> } = {
  palette: { K: "#2b1d14", W: "#f6efdc", L: "#d8b98a" },
  grid: [
    "...KKKKKKKK...",
    "..KWWWWWWWWK..",
    ".KWWWWWWWWWWK.",
    ".KWKKWWWWKKWK.",
    ".KWKKWWWWKKWK.",
    ".KWWWWWWWWWWK.",
    ".KWWWWKKWWWWK.",
    ".KWWWKWWKWWWK.",
    "..KWWWWWWWWK..",
    "...KWKWWKWK...",
    "...KWKWWKWK...",
    "...KKKKKKKK...",
    "....KLLLLK....",
    ".....KKKK.....",
  ],
};

/** One HUD cell: pixel icon above its value. Glows while a bonus is active. */
function StatCell({
  art,
  label,
  value,
  active,
  color,
  remaining,
}: {
  art: { grid: string[]; palette: Record<string, string> };
  label: string;
  value: string;
  active?: boolean;
  color?: string;
  remaining?: number;
}) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center gap-1" title={label}>
      <span
        className="flex items-center justify-center transition-all duration-300"
        style={{
          filter: active
            ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color}) brightness(1.15)`
            : "none",
        }}
      >
        <StatPixelIcon art={art} size={36} />
      </span>
      <span
        className="font-stat whitespace-nowrap text-center text-base leading-none tabular-nums transition-colors duration-300"
        style={{ color: active ? color : "rgba(255,255,255,0.94)", textShadow: "0 2px 3px rgba(0,0,0,0.9)" }}
      >
        {value}
        {active && remaining !== undefined && (
          <span className="ml-1 text-xs opacity-80">{Math.ceil(remaining)}s</span>
        )}
      </span>
    </div>
  );
}

function HUD({ state, tick: _tick }: { state: GameState; tick: number }) {
  const p = state.player;
  const xpPct = Math.min(1, state.xp / state.xpToNext);
  const hpPct = Math.max(0, p.hp / p.maxHp);

  // Health bar feedback: a short flash on every hit, plus a continuous
  // heartbeat flash whenever health sits at or below 10%.
  const prevHp = useRef(p.hp);
  const hurtUntil = useRef(0);
  if (p.hp < prevHp.current - 0.01) hurtUntil.current = state.now + 0.45;
  prevHp.current = p.hp;
  const hurting = state.now < hurtUntil.current;
  const critical = hpPct > 0 && hpPct <= 0.1;
  // 2.4 Hz pulse — clearly visible, gentle enough to not be distracting.
  const pulse = 0.5 + 0.5 * Math.sin(state.now * Math.PI * 2 * 2.4);
  const hpFlash = critical ? 0.35 + pulse * 0.65 : hurting ? 1 : 0;
  const hpColor = hpFlash > 0 ? (critical ? "#ff5a44" : "#ff8a72") : "#d13a2a";

  const mins = Math.floor(state.survivalSeconds / 60);
  const secs = Math.floor(state.survivalSeconds % 60);
  const magnetActive = state.now < (state.magnetBoostUntil ?? 0);
  const speedActive = state.now < (state.speedBoostUntil ?? 0);
  const shieldActive = state.now < (state.shieldUntil ?? 0);
  const starActive = state.now < (state.invulnUntil ?? 0);

  const pickupRadius = Math.round((60 + state.level * 3) * magnetMultiplier(state));
  const moveSpeed = Math.round(100 * speedMultiplier(state));
  const dmgMul = damageMultiplier(state);
  const meleeMul = meleeMultiplier(state, state.plagues.get("staff") ?? 1);
  const shieldPct = Math.round((1 - shieldDamageMul(state)) * 100);

  const notifs = state.notifications ?? [];
  const k = useHudScale();

  return (
    <>
      {/* Subtle bottom gradient for HUD contrast — never hides gameplay. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-52"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 45%, rgba(0,0,0,0.45) 100%)" }}
      />

      {/* Single bottom HUD: run info | player stats. Uniformly scaled so the
          same layout fits phones, small laptops and large monitors. */}
      <div className="absolute inset-x-0 bottom-7 flex items-end justify-center px-3">
        <div className="flex items-end gap-6" style={{ transform: `scale(${k})`, transformOrigin: "bottom center" }}>
          <div className="flex items-end gap-4">
            <StatCell art={MEDAL_ART} label="Level" value={`${state.level}`} />
            <StatCell art={CLOCK_ART} label="Time survived" value={`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`} />
            <StatCell art={SKULL_ART} label="Kills" value={`${state.kills}`} />
          </div>

          <div className="mb-2 h-14 w-[3px] bg-white/25" />

          <div className="flex items-end gap-4">
            <StatCell
              art={BONUS_ART.heart}
              label="Health"
              value={`${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`}
              active={hpFlash > 0.35}
              color="#ff6a52"
            />

            <StatCell
              art={BONUS_ART.shield}
              label="Shield (damage reduction)"
              value={`${shieldPct}`}
              active={shieldActive}
              color={BONUSES.shield.color}
              remaining={shieldActive ? (state.shieldUntil ?? 0) - state.now : undefined}
            />
            <StatCell art={STAFF_ART} label="Staff of Moses (melee strike)" value={`${Math.round(meleeMul * 100)}`} />
            <StatCell art={SWORD_ART} label="Plague damage" value={`${Math.round(dmgMul * 100)}`} />

            <StatCell
              art={BONUS_ART.lightning}
              label="Movement speed"
              value={`${moveSpeed}`}
              active={speedActive}
              color={BONUSES.lightning.color}
              remaining={speedActive ? (state.speedBoostUntil ?? 0) - state.now : undefined}
            />
            <StatCell
              art={BONUS_ART.magnet}
              label="Pickup radius"
              value={`${pickupRadius}`}
              active={magnetActive}
              color={BONUSES.magnet.color}
              remaining={magnetActive ? (state.magnetBoostUntil ?? 0) - state.now : undefined}
            />
            {starActive && (
              <StatCell
                art={BONUS_ART.star}
                label="Invincible"
                value="INV"
                active
                color={BONUSES.star.color}
                remaining={(state.invulnUntil ?? 0) - state.now}
              />
            )}
          </div>
        </div>
      </div>

      {/* Life & experience bars — full width, pixel-art, at the very bottom. */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="h-3 w-full border-t-[3px] border-[#2b1d14] bg-[rgba(43,29,20,0.65)]">
          <div
            className="h-full transition-[width] duration-100"
            style={{
              width: `${hpPct * 100}%`,
              background: hpColor,
              boxShadow: hpFlash > 0 ? `0 0 ${8 + hpFlash * 12}px rgba(255,90,68,${0.35 + hpFlash * 0.5})` : "none",
              filter: hpFlash > 0 ? `brightness(${1 + hpFlash * 0.55})` : "none",
            }}
          />
        </div>
        <div className="h-3 w-full border-t-[3px] border-[#2b1d14] bg-[rgba(43,29,20,0.65)]">
          <div className="h-full bg-[#e6c261] transition-[width] duration-100" style={{ width: `${xpPct * 100}%` }} />
        </div>
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


// Companion summon announcement: a brief banner shown for a few seconds when a
// companion joins, then it fades out and disappears completely. It is never a
// permanent HUD element.
const SUMMON_NOTICE_SECONDS = 4.5;
const SUMMON_FADE_SECONDS = 0.8;

function LoadoutBar({ state, tick: _tick, onDismissPlague: _p, onDismissNpc }: {
  state: GameState; tick: number;
  onDismissPlague: (id: PlagueId) => void;
  onDismissNpc: (id: NpcId) => void;
}) {
  const npcs = Array.from(state.npcs.keys());
  // First time we see a companion, remember when it appeared.
  const seen = useRef(new Map<NpcId, number>());
  for (const id of npcs) if (!seen.current.has(id)) seen.current.set(id, state.now);

  const visible = npcs
    .map((id) => ({ id, age: state.now - (seen.current.get(id) ?? state.now) }))
    .filter((n) => n.age < SUMMON_NOTICE_SECONDS + SUMMON_FADE_SECONDS);

  if (visible.length === 0) return null;
  return (
    <div className="absolute inset-x-0 top-14 flex flex-wrap items-center justify-center gap-1.5 px-2">
      {visible.map(({ id, age }) => {
        const fade = age <= SUMMON_NOTICE_SECONDS
          ? 1
          : Math.max(0, 1 - (age - SUMMON_NOTICE_SECONDS) / SUMMON_FADE_SECONDS);
        return (
          <div key={id} style={{ opacity: fade, transform: `translateY(${(1 - fade) * -8}px)` }}>
            <LoadoutPill isNew={state.newNpcs.has(id)} title={NPCS[id].name} subtitle="Companion" tone="ally" onClick={() => onDismissNpc(id)} />
          </div>
        );
      })}
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
  j: "#ffd400", J: "#fff36a", // bright yellow (speed / lightning)
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
  // Shield of Faith — kite shield with a golden cross boss.
  shield: [
    "....................",
    "...KKKKKKKKKKKKKK...",
    "..KLLLLLLLLLLLLLLK..",
    "..KLVVVVVVVVVVVVLK..",
    "..KLVBBBBBBBBBBVLK..",
    "..KLVBBBBOOBBBBVLK..",
    "..KLVBBBBOOBBBBVLK..",
    "..KLVBBOOOOOOBBVLK..",
    "..KLVBBOOYYOOBBVLK..",
    "..KLVBBBBOOBBBBVLK..",
    "..KLVBBBBOOBBBBVLK..",
    "..KLVBBBBOOBBBBVLK..",
    "...KLVBBBBBBBBVLK...",
    "....KLVBBBBBBVLK....",
    ".....KLVBBBBVLK.....",
    "......KLVBBVLK......",
    ".......KLVVLK.......",
    "........KLLK........",
    ".........KK.........",
    "....................",
  ],
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
  // Sandals of Haste — a bright yellow lightning bolt.
  speed: [
    "....................",
    "............KKKK....",
    "...........KjjjK....",
    "..........KjjjjK....",
    ".........KjjjjK.....",
    "........KjjjjK......",
    ".......KjjjjK.......",
    "......KjjjjKKKKK....",
    ".....KjjjjjjjjjK....",
    "....KjjjJjjjjjjK....",
    "....KKKKKKKjjjjK....",
    ".........KjjjjK.....",
    "........KjjjjK......",
    ".......KjjjjK.......",
    "......KjjjjK........",
    ".....KjjjjK.........",
    "....KjjjK...........",
    "....KjjK............",
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
  // Pixel-art panel language: stepped corners, hard borders, no radii.
  // Three compact, vertically centred cards — one row on desktop, one column
  // on mobile — always fully visible without scrolling.
  // Every card uses one fixed size, sized for the wordiest blessing in the
  // game (icon + title + long description + scripture), so the popup never
  // resizes between level ups.
  const CARD = "w-full sm:w-[13.5rem] h-[8.5rem] sm:h-[17.5rem]";
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden bg-[rgba(30,18,8,0.72)] p-2 sm:p-4">
      <div
        className="pixel-panel flex max-h-full w-auto max-w-[95vw] flex-col bg-[#FEEFBE] p-3 sm:p-5"
        style={{ boxShadow: "0 6px 0 0 rgba(58,36,18,0.75)" }}
      >
        <h2 className="font-display text-center text-[clamp(0.95rem,3.2vh,1.5rem)] uppercase leading-tight tracking-[0.12em] text-[#4a2c10]">
          Level Up!
        </h2>
        <p className="font-pixel mb-2 text-center text-[clamp(0.65rem,1.8vh,0.85rem)] uppercase tracking-[0.22em] text-[#8a5a2c] sm:mb-4">
          Choose your blessing
        </p>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-stretch sm:gap-4">
          {choices.map((c) => {
            const grid = iconGridFor(c);
            return (
              <button
                key={c.id}
                onClick={() => onPick(c)}
                className={`pixel-panel-sm group relative flex ${CARD} shrink-0 items-center gap-3 bg-[#f6e2ad] p-2 text-left transition-transform duration-100 hover:bg-[#f0d795] sm:flex-col sm:items-center sm:justify-start sm:gap-2 sm:p-3 sm:text-center sm:hover:-translate-y-1`}
                style={{ boxShadow: "0 5px 0 0 rgba(58,36,18,0.6)" }}
              >
                {c.isUnlock && (
                  <span
                    className={`font-display absolute right-1 top-1 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${c.isCompanion ? "bg-[#7fa8b8] text-[#20303a]" : "bg-[#e9c168] text-[#3a2412]"}`}
                    style={{ animation: "exodus-new-bounce 0.9s ease-in-out infinite", border: "3px solid #3a2412" }}
                  >
                    NEW
                  </span>
                )}
                <div className="flex shrink-0 items-center justify-center">
                  <div className="origin-center scale-[0.58] sm:scale-[0.72]">
                    <PixelIcon grid={grid} size={72} />
                  </div>
                </div>
                <div className="min-w-0 flex-1 overflow-hidden sm:flex-none">
                  <div className="font-display mb-1 text-[0.7rem] uppercase leading-tight tracking-[0.08em] text-[#7a3d16]">
                    {c.title}
                  </div>
                  <div className="font-pixel line-clamp-3 text-[0.72rem] leading-snug text-[#5c3a18] sm:line-clamp-4">
                    {c.description}
                  </div>
                  {c.scripture && (
                    <div className="font-pixel mt-1.5 hidden line-clamp-3 border-[3px] border-[#3a2412] bg-[#FEEFBE] px-1.5 py-1 text-[0.66rem] leading-snug text-[#7a5228] [@media(min-height:700px)]:block">
                      {c.scripture}
                    </div>
                  )}
                </div>
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
  // Uniform camera zoom keeps the composition identical across resolutions.
  const zoom = viewZoom(cnv.clientWidth, cnv.clientHeight);
  const viewW = cnv.clientWidth / zoom;
  const viewH = cnv.clientHeight / zoom;
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
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
  const tileSize = sandTile.width;
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  const offX = -mod(cam.x, tileSize);
  const offY = -mod(cam.y, tileSize);
  for (let y = offY - tileSize; y < viewH + tileSize; y += tileSize) {
    for (let x = offX - tileSize; x < viewW + tileSize; x += tileSize) {
      ctx.drawImage(sandTile, x, y);
    }
  }

  // Ground colour wash — softens the desert saturation. Sits above the ground
  // tiles and below every gameplay element. Tune GROUND_WASH_OPACITY only.
  if (GROUND_WASH_OPACITY > 0) {
    ctx.fillStyle = `rgba(255,255,255,${GROUND_WASH_OPACITY})`;
    ctx.fillRect(0, 0, viewW, viewH);
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
  let swingProgress: number | null = null;
  let attackProgress: number | null = null;
  for (const e of s.entities.values()) {
    if (e.kind === "bloodpool") continue;
    if (e.kind === "staffswing") {
      const dur = (e.data?.dur as number) ?? MOSES_ATTACK.DUR;
      attackProgress = Math.max(0, Math.min(1, 1 - (e.ttl ?? 0) / dur));
      swingProgress = staffFxProgress(e);
    }
    drawList.push(e);
  }
  // Thrones are furniture: always behind whoever sits on them, even at equal depth.
  const depthOf = (e: Entity) => e.pos.y - (e.kind === "throne" ? 1 : 0);
  drawList.sort((a, b) => depthOf(a) - depthOf(b));

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
    if (e.kind === "moses") { drawMoses(ctx, e, s, camX, camY, swingProgress, attackProgress); continue; }
    if (e.kind === "ramses") { drawRamses(ctx, e, camX, camY, s); continue; }
    if (e.kind === "soldier" && drawSoldier(ctx, e, camX, camY)) continue;
    if (e.kind === "swordsoldier" && drawSwordSoldier(ctx, e, camX, camY)) continue;
    if (e.kind === "jackal" && drawDog(ctx, e, camX, camY)) continue;
    if (e.kind === "hitspark") { drawHitSpark(ctx, e, camX, camY); continue; }

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

  // 5) Critical-health danger atmosphere. This is deliberately a small number
  // of fixed canvas fills rather than a per-pixel grid, so low HP cannot lower
  // the game loop's frame rate.
  const hpRatio = Math.max(0, s.player.hp) / Math.max(1, s.player.maxHp);
  const danger = Math.max(0, Math.min(1, (0.15 - hpRatio) / 0.13));
  if (danger > 0.001) {
    const beat = 0.5 + 0.5 * Math.sin(s.now * 4.2);
    const border = Math.round((10 + beat * 8) / 6) * 6;
    ctx.save();
    ctx.globalAlpha = 0.22 + danger * 0.25 + beat * danger * 0.08;
    ctx.fillStyle = "#961a16";
    ctx.fillRect(0, 0, viewW, border);
    ctx.fillRect(0, viewH - border, viewW, border);
    ctx.fillRect(0, 0, border, viewH);
    ctx.fillRect(viewW - border, 0, border, viewH);
    // Fixed stepped cut-ins preserve the chunky, dithered look without a grid.
    ctx.globalAlpha *= 0.72;
    ctx.fillStyle = "#b02820";
    const step = 12;
    for (let i = 1; i < 5; i++) {
      ctx.fillRect(i * step, border + i * 3, step, 6);
      ctx.fillRect(viewW - (i + 1) * step, border + i * 3, step, 6);
      ctx.fillRect(i * step, viewH - border - i * 3 - 6, step, 6);
      ctx.fillRect(viewW - (i + 1) * step, viewH - border - i * 3 - 6, step, 6);
    }
    ctx.restore();
  }

  // 6) Short, edge-focused hit feedback. It observes the already-updated HP
  // and never changes damage, cooldowns, or any other game state.
  if (hasRenderedPlayerHp && s.player.hp < lastRenderedPlayerHp - 0.01) {
    damageImpactKind = s.damageImpactKind === "ramses" ? "ramses" : "normal";
    damageImpactUntil = Math.max(damageImpactUntil, s.now + (damageImpactKind === "ramses" ? 0.28 : 0.22));
  }
  lastRenderedPlayerHp = s.player.hp;
  hasRenderedPlayerHp = true;
  const impactDuration = damageImpactKind === "ramses" ? 0.28 : 0.22;
  const impactLife = Math.max(0, damageImpactUntil - s.now) / impactDuration;
  if (impactLife > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, impactLife * 1.4);
    const isRamsesHit = damageImpactKind === "ramses";
    const edge = (isRamsesHit ? 22 : 10) + Math.round((1 - impactLife) * (isRamsesHit ? 8 : 6));
    const px = 6;
    ctx.fillStyle = isRamsesHit ? "#76151b" : "#a12b2b";
    ctx.fillRect(0, 0, viewW, edge);
    ctx.fillRect(0, viewH - edge, viewW, edge);
    ctx.fillRect(0, 0, edge, viewH);
    ctx.fillRect(viewW - edge, 0, edge, viewH);
    ctx.fillStyle = isRamsesHit ? "#c92d32" : "#e05a48";
    const shard = isRamsesHit ? 18 : 12;
    ctx.fillRect(edge + 4, edge + 2, shard, px);
    ctx.fillRect(edge + 2, edge + 4, px, shard);
    ctx.fillRect(viewW - edge - shard - 4, edge + 2, shard, px);
    ctx.fillRect(viewW - edge - px - 2, edge + 4, px, shard);
    ctx.fillRect(edge + 4, viewH - edge - px - 2, shard, px);
    ctx.fillRect(edge + 2, viewH - edge - shard - 4, px, shard);
    ctx.fillRect(viewW - edge - shard - 4, viewH - edge - px - 2, shard, px);
    ctx.fillRect(viewW - edge - px - 2, viewH - edge - shard - 4, px, shard);
    ctx.restore();
  }

  // 7) Invulnerability — no ring; Moses himself flashes bright (see drawMoses).


  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);

  // Restore original entity positions (see wrap block at top of draw).
  for (const [id, ox, oy] of origs) {
    const e = s.entities.get(id);
    if (e) { e.pos.x = ox; e.pos.y = oy; }
  }
}


// ---------------- Moses ----------------


function drawMoses(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, camX: number, camY: number, swingProgress: number | null, attackProgress: number | null) {
  const flip: 1 | -1 = e.facing === -1 ? -1 : 1;
  const walking = Math.hypot(e.vel.x, e.vel.y) > 5;
  const x = e.pos.x - camX;
  const groundY = e.pos.y - camY + 8;
  const bob = walking ? (Math.sin(e.animT * 4.2) > 0 ? -1 : 0) : 0;

  drawPixelShadow(ctx, x, Math.round(e.pos.y - camY + 9), 30, {
    px: SCALE, alpha: 0.26, seed: 7, phase: e.animT, sway: walking ? 1 : 0,
  });

  drawMosesArt(ctx, {
    x, groundY, flip,
    walkPhase: walking ? e.animT * 4.2 : s.now * 4.2,
    moving: walking,
    bob,
    // The staff he already holds is the one that swings.
    staffAngle: swingProgress === null ? 0 : mosesSwingAngle(swingProgress),
    // Frames 1-5 of the swing, paced to the existing attack cadence.
    attackProgress,
    // Invincibility (Star bonus): Moses flashes brighter — no ring, no overlay.
    flash: s.now < (s.invulnUntil ?? 0) ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(s.now * 14)) : 0,
  });
}


// Shepherd's-crook renderer lives in ./staff so the main menu can reuse it.



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
  drawPixelShadow(ctx, sx + drawW / 2, shadowY + 1, img.width * 0.7 * shadowScale, {
    px: SCALE, alpha: 0.22, seed: e.id, phase: e.animT, sway: downed ? 0 : 0.8, lift: shadowScale,
  });

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

// ---------------- Egyptian soldier (layered supplied sprite) ----------------
function drawSoldier(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number): boolean {
  if (!ensureSoldierArt()) return false;
  const x = Math.round(e.pos.x - camX);
  const groundY = Math.round(e.pos.y - camY + 8);
  const moving = true; // chase behaviour keeps him advancing
  drawPixelShadow(ctx, x, groundY + 1, SOLDIER_ART.W * SOLDIER_ART.PX * 0.7, {
    px: 3, alpha: 0.24, seed: e.id, phase: e.animT, sway: 0.8,
  });
  drawSoldierArt(ctx, {
    x, groundY,
    flip: e.facing === -1 ? -1 : 1,
    walkPhase: e.animT * 5.2,
    moving,
    // progress is advanced by the engine so it follows game time exactly
    punch: (e.data?.punchProgress as number | undefined) ?? null,
  });


  if (e.hp < e.maxHp) {
    const bw = 26;
    const by = groundY - SOLDIER_ART.H * SOLDIER_ART.PX - 6;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = "#5a1a1a"; ctx.fillRect(x - bw / 2, by, bw, 3);
    ctx.fillStyle = "#e05a48"; ctx.fillRect(x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 3);
  }
  return true;
}

// ------------- Egyptian sword soldier (layered supplied sprite) -------------
function drawSwordSoldier(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number): boolean {
  if (!ensureSwordSoldierArt()) return false;
  const x = Math.round(e.pos.x - camX);
  const groundY = Math.round(e.pos.y - camY + 8);
  drawPixelShadow(ctx, x, groundY + 1, SWORD_ART.W * SWORD_ART.PX * 0.42, {
    px: 3, alpha: 0.24, seed: e.id, phase: e.animT, sway: 0.8,
  });
  drawSwordSoldierArt(ctx, {
    x, groundY,
    flip: e.facing === -1 ? -1 : 1,
    walkPhase: e.animT * 5.2,
    moving: true,
    thrust: (e.data?.thrustProgress as number | undefined) ?? null,
  });
  if (e.hp < e.maxHp) {
    const bw = 26;
    const by = groundY - SWORD_ART.H * SWORD_ART.PX - 6;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = "#5a1a1a"; ctx.fillRect(x - bw / 2, by, bw, 3);
    ctx.fillStyle = "#e05a48"; ctx.fillRect(x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 3);
  }
  return true;
}

// ---------------- desert dog (layered supplied sprite) ----------------
function drawDog(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number): boolean {
  if (!ensureDogArt()) return false;
  const x = Math.round(e.pos.x - camX);
  const groundY = Math.round(e.pos.y - camY + 7);
  // The supplied sprite faces right; animal facing is stored inverted.
  const flip: 1 | -1 = e.facing === -1 ? 1 : -1;
  drawPixelShadow(ctx, x, groundY + 1, DOG_ART.W * DOG_ART.PX * 0.66, {
    px: 3, alpha: 0.24, seed: e.id, phase: e.animT, sway: 0.7,
  });
  drawDogArt(ctx, {
    x, groundY, flip,
    walkPhase: e.animT * 7,
    moving: true,
    pounce: (e.data?.pounceProgress as number | undefined) ?? null,
  });
  if (e.hp < e.maxHp) {
    const bw = 24;
    const by = groundY - DOG_ART.H * DOG_ART.PX - 5;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = "#5a1a1a"; ctx.fillRect(x - bw / 2, by, bw, 3);
    ctx.fillStyle = "#e05a48"; ctx.fillRect(x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 3);
  }
  return true;
}

// Short, punchy pixel-art contact burst — purely visual feedback.
function drawHitSpark(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 0.22;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxTtl));
  if (life <= 0) return;
  const t = 1 - life;
  const cx = Math.round(e.pos.x - camX);
  const cy = Math.round(e.pos.y - camY);
  const seed = (e.data?.seed as number) ?? e.id;
  // punch impacts use a deliberately small, tight burst
  const k = e.data?.small ? 0.55 : 1;
  const u = (n: number) => Math.round(n * k) || (n > 0 ? 1 : 0);
  ctx.save();
  ctx.globalAlpha = Math.min(1, life * 1.6);
  // core flash: chunky stepped cross
  ctx.fillStyle = "#ffe9a8";
  ctx.fillRect(cx - u(9), cy - u(3), u(18), u(6));
  ctx.fillRect(cx - u(3), cy - u(9), u(6), u(18));
  ctx.fillStyle = "#ff8a2b";
  ctx.fillRect(cx - u(12), cy - u(3), u(3), u(6));
  ctx.fillRect(cx + u(9), cy - u(3), u(3), u(6));
  ctx.fillRect(cx - u(3), cy - u(12), u(6), u(3));
  ctx.fillRect(cx - u(3), cy + u(9), u(6), u(3));
  // radiating pixel shards
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + ((seed % 7) * 0.21);
    const r = (10 + t * 22) * k;
    const px = Math.round(cx + Math.cos(a) * r);
    const py = Math.round(cy + Math.sin(a) * r * 0.8);
    ctx.fillStyle = i % 2 === 0 ? "#e04a2b" : "#ffb347";
    ctx.fillRect(px - u(2), py - u(2), u(4), u(4));
  }
  ctx.restore();
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
    ctx.fillRect(rx, y + dy * PX, w * PX, h * PX);
  };

  const shadow = (r: number) => {
    drawPixelShadow(ctx, x, y + 7, r * 2, { px: PX, alpha: 0.26, seed: e.id, phase: t, sway: 0.8 });
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
  

  // Pixel-art ground shadow — big; Ramses is roughly 2x a normal human. It stays
  // on the ground while he leaps, tightening as he rises and spreading on landing.
  const chariot = !!d.chariot && !seated;
  const airT = phase === "airborne" ? 1 - Math.max(0, Math.min(1, (d.leapT as number) / 0.75)) : 0;
  const ramLift = phase === "airborne" ? 1 - Math.sin(airT * Math.PI) * 0.45 : phase === "land" ? 1.12 : 1;
  drawPixelShadow(ctx, x, y + 11, chariot ? 108 : 70, {
    px: 3, alpha: 0.34, seed: 99, phase: e.animT, sway: seated ? 0 : 0.9, lift: ramLift,
  });


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

  // -------- Egyptian war chariot (level 50+) --------
  // Drawn beneath Ramses so his torso rises above the cart. Simple pixel-art
  // silhouette in Ramses' palette: gold-edged cart, spoked wheels, twin horses.
  if (chariot) {
    const wheelR = 22;
    const cartY = y + 8;
    const spin = s.now * 8 * flip;
    // Cart body — ivory panels with soft gold trim (matches Ramses' palette)
    ctx.fillStyle = "#6b5537"; ctx.fillRect(x - 30, cartY - 18, 60, 20);
    ctx.fillStyle = "#f6ecd6"; ctx.fillRect(x - 28, cartY - 16, 56, 14);
    ctx.fillStyle = "#e8cf95"; ctx.fillRect(x - 28, cartY - 16, 56, 2);
    ctx.fillStyle = "#93b3ad"; ctx.fillRect(x - 28, cartY - 8, 56, 2);
    ctx.fillStyle = "#c78e73"; ctx.fillRect(x - 28, cartY - 4, 56, 2);
    // Front panel emblem (sun disk)
    ctx.fillStyle = "#e8cf95"; ctx.beginPath(); ctx.arc(x + flip * 20, cartY - 10, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c1a468"; ctx.beginPath(); ctx.arc(x + flip * 20, cartY - 10, 2, 0, Math.PI * 2); ctx.fill();
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

  // Ramses uses the supplied pixel-art sprite, split into body + staff layers so
  // the staff he already holds is the one that swings during a melee strike.
  const atk = (d.atkPhase as string) ?? "idle";
  let staffAngle = 0;
  if (atk === "windup") {
    // Raises the staff overhead, holding it high just before the smash.
    const t = 1 - Math.max(0, Math.min(1, (d.atkT as number) / 0.55));
    staffAngle = -1.15 * (t < 0.7 ? t / 0.7 : 1);
  } else if (atk === "smash") {
    // Drives it straight down into the sand.
    const t = 1 - Math.max(0, Math.min(1, (d.atkT as number) / 0.12));
    staffAngle = -1.15 + t * 1.6;
  } else if (atk === "recover") {
    const t = 1 - Math.max(0, Math.min(1, (d.atkT as number) / 0.45));
    staffAngle = 0.45 * (1 - t);
  }

  // ---- pixel-art ground impact: irregular cracks + dust, no smooth rings ----
  const crackT = (d.crackT as number) ?? 0;
  if (crackT > 0) {
    const CT = 0.55;
    const life = Math.max(0, Math.min(1, crackT / CT));
    const grow = 1 - life;
    const R = (d.smashR as number) ?? 110;
    const seed = (d.crackSeed as number) ?? 1;
    const rnd = (i: number) => {
      const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    const gy = y + 8;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.65 * life;
    const BR = 3;
    for (let b = 0; b < 12; b++) {
      const a0 = (b / 12) * Math.PI * 2 + rnd(b) * 0.35;
      let cxp = 0, cyp = 0, a = a0;
      const len = R * (0.6 + rnd(b + 40) * 0.4) * Math.min(1, grow * 1.6);
      let travelled = 0;
      let k = 0;
      while (travelled < len) {
        a += (rnd(b * 31 + k) - 0.5) * 0.7;
        const stepLen = BR * (1 + Math.floor(rnd(b * 17 + k) * 2));
        cxp += Math.cos(a) * stepLen;
        cyp += Math.sin(a) * stepLen * 0.5;
        travelled += stepLen;
        const w = travelled < len * 0.4 ? BR * 2 : BR;
        ctx.fillStyle = k % 3 === 0 ? "#6b4a26" : "#8a6338";
        ctx.fillRect(Math.round(cxp + x - w / 2), Math.round(cyp + gy - BR / 2), w, BR);
        // occasional chip beside the crack
        if (rnd(b * 7 + k + 3) > 0.78) {
          ctx.fillStyle = "#a8814c";
          ctx.fillRect(Math.round(cxp + x + BR), Math.round(cyp + gy - BR), BR, BR);
        }
        k++;
        if (k > 60) break;
      }
    }
    // dust / debris kicked up around the impact
    for (let i = 0; i < 26; i++) {
      const a = rnd(i + 200) * Math.PI * 2;
      const rr = R * (0.15 + rnd(i + 300) * 0.75) * Math.min(1, grow * 1.9);
      const rise = grow * 22 * (0.4 + rnd(i + 400) * 0.6);
      ctx.globalAlpha = life * 0.75;
      ctx.fillStyle = i % 3 === 0 ? "#e6d3ab" : i % 3 === 1 ? "#cbb083" : "#b19467";
      const sz = 3 + (i % 2) * 3;
      ctx.fillRect(
        Math.round(x + Math.cos(a) * rr),
        Math.round(gy + Math.sin(a) * rr * 0.45 - rise),
        sz, sz,
      );
    }
    ctx.restore();
  }

  drawRamsesArt(ctx, {
    x,
    groundY: y + 10,
    flip: flip === -1 ? -1 : 1,
    walkPhase: e.animT * 4.2,
    moving: !seated && atk === "idle" && phase === "idle",
    bob,
    staffAngle: staffAngle * (flip === -1 ? 1 : 1),
  });


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
  // Same palette and shading language as Ramses: ivory, warm beige, soft gold
  // and a warm brown outline. Every shape is stamped on the 3px pixel grid.
  const OUT = "#6b5537";
  const IVL = "#fffaf0";
  const IVO = "#f6ecd6";
  const BEI = "#e4d3ad";
  const BES = "#c9b286";
  const STN = "#dcc9a2";
  const STS = "#bda681";
  const GLD = "#e8cf95";
  const GDS = "#c1a468";
  const TEA = "#93b3ad";
  const TER = "#c78e73";

  ctx.save();
  // Soft ground shadow
  ctx.fillStyle = "rgba(107, 85, 55, 0.28)";
  ctx.beginPath(); ctx.ellipse(x, y + 12 * TPX, 44, 8, 0, 0, Math.PI * 2); ctx.fill();

  // -------- Stepped limestone plinth --------
  p(-14, 8, 28, 5, OUT);
  p(-14, 8, 28, 4, STN);
  p(-14, 8, 28, 1, IVL);
  p(-13, 10, 26, 2, STS);
  // hieroglyph frieze
  for (let i = 0; i < 6; i++) {
    p(-11 + i * 4, 10, 1, 1, BES);
    p(-9 + i * 4, 10, 1, 1, GDS);
  }

  // -------- Tall backrest --------
  // Kept a shade darker (stone/beige) than Ramses himself so his ivory linen
  // silhouette reads clearly against the throne behind him.
  p(-10, -22, 20, 25, OUT);
  p(-9, -21, 18, 23, STN);
  p(-9, -21, 18, 2, BEI);
  p(-9, 0, 18, 2, STS);
  // gilded frame
  p(-9, -21, 18, 1, GLD);
  p(-9, -19, 18, 1, GDS);
  // fluted side pilasters
  for (let i = 0; i < 2; i++) {
    p(-9 + i * 2, -18, 1, 18, BES);
    p(-8 + i * 2, -18, 1, 18, GDS);
    p(6 + i * 2, -18, 1, 18, GDS);
    p(7 + i * 2, -18, 1, 18, BES);
  }

  // -------- Winged sun-disk emblem (pixel-stamped) --------
  const ey = -14;
  p(-2, ey - 2, 4, 4, GDS);
  p(-2, ey - 2, 4, 3, GLD);
  p(-1, ey - 1, 2, 1, IVL);
  // wings sweeping out from the disk
  for (let i = 0; i < 4; i++) {
    p(-6 - i, ey - 1 + Math.floor(i / 2), 1, 2, i % 2 ? GLD : BEI);
    p(5 + i, ey - 1 + Math.floor(i / 2), 1, 2, i % 2 ? GLD : BEI);
  }
  p(-6, ey + 1, 4, 1, GDS);
  p(2, ey + 1, 4, 1, GDS);
  // tail feathers
  p(-1, ey + 2, 2, 2, TEA);
  p(-1, ey + 3, 2, 1, TER);

  // -------- Seat --------
  p(-12, 2, 24, 7, OUT);
  p(-11, 2, 22, 6, STN);
  p(-11, 2, 22, 1, BEI);
  p(-11, 6, 22, 2, STS);
  // inlaid panel band
  p(-10, 4, 20, 1, TEA);
  p(-10, 5, 20, 1, TER);

  // -------- Armrests with cobra heads --------
  for (const ax of [-14, 12]) {
    p(ax, -3, 2, 12, OUT);
    p(ax, -3, 2, 11, STN);
    p(ax, -3, 2, 1, BEI);
    p(ax, 3, 2, 1, GLD);
  }
  const cobra = (gx: number) => {
    p(gx, -7, 4, 4, OUT);
    p(gx, -7, 4, 3, GLD);
    p(gx, -7, 4, 1, IVL);
    p(gx + 1, -6, 1, 1, OUT); p(gx + 2, -6, 1, 1, OUT); // eyes
    p(gx + 1, -4, 2, 1, TER); // tongue
  };
  cobra(-14); cobra(12);

  // -------- Lion-paw feet --------
  for (const fx of [-14, 11]) {
    p(fx, 11, 3, 2, OUT);
    p(fx, 11, 3, 1, STN);
    p(fx, 12, 1, 1, BES); p(fx + 1, 12, 1, 1, STS); p(fx + 2, 12, 1, 1, BES);
  }
  ctx.restore();
}



// ---------------- staff swing wind effect ----------------
// 0..1 through the impact window (frame 3 onward), or null during the wind-up.
function staffFxProgress(e: Entity): number | null {
  const dur = (e.data?.dur as number) ?? MOSES_ATTACK.DUR;
  const windup = (e.data?.windup as number) ?? MOSES_ATTACK.WINDUP;
  const fx = (e.data?.maxTtl as number) ?? 0.18;
  const elapsed = dur - (e.ttl ?? 0);
  if (elapsed < windup) return null;
  return Math.max(0, Math.min(1, (elapsed - windup) / fx));
}

// The staff itself is drawn as part of Moses (see drawMoses) — this entity only
// paints the white wind slash that trails the crook of his own staff.
function drawStaffSwing(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, camX: number, camY: number) {
  const facing: 1 | -1 = ((e.data?.facing as number) ?? 1) === -1 ? -1 : 1;
  const progress = staffFxProgress(e);
  // Wind-up frames (1-2): the staff has not landed yet, so no FX at all.
  if (progress === null) return;
  const life = 1 - progress;
  const px = s.player.pos.x - camX;
  const groundY = s.player.pos.y - camY + 8;

  ctx.save();
  const trailStart = Math.max(0, progress - 0.75);
  const segs = 26;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const p = trailStart + t * (progress - trailStart);
    const tip = mosesStaffTip(px, groundY, facing, mosesSwingAngle(p));
    const fade = life * (0.25 + 0.75 * t);
    ctx.globalAlpha = fade * 0.55;
    ctx.fillStyle = "#ffffff";
    const outerSz = t > 0.8 ? 7 : t > 0.5 ? 6 : 5;
    ctx.fillRect(Math.round(tip.x - outerSz / 2), Math.round(tip.y - outerSz / 2), outerSz, outerSz);
    ctx.globalAlpha = fade;
    const coreSz = t > 0.8 ? 4 : 3;
    ctx.fillRect(Math.round(tip.x - coreSz / 2), Math.round(tip.y - coreSz / 2), coreSz, coreSz);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Bright impact glow at the crook of the staff mid-swing.
  const tip = mosesStaffTip(px, groundY, facing, mosesSwingAngle(progress));
  ctx.save();
  ctx.globalAlpha = life;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2); ctx.fill();
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
      ".......KKKK...",
      "......KjjjK...",
      ".....KjjjK....",
      "....KjjjK.....",
      "...KjjjK......",
      "...KjjjjKKKK..",
      "...KjjJjjjjK..",
      "....KKKKjjjK..",
      ".......KjjjK..",
      "......KjjjK...",
      ".....KjjjK....",
      "....KjjjK.....",
      "....KjK.......",
      "....KK........",
    ],
    palette: { K: "#3a2a08", j: "#ffd400", J: "#fff36a" },
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

  // Pixel-art ground shadow (stays under the body, even when downed)
  drawPixelShadow(ctx, x, y + 11, 30, {
    px: CPX, alpha: 0.26, seed: e.id, phase: e.animT, sway: downed ? 0 : 0.8,
  });


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


