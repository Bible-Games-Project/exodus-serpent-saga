import { useEffect, useRef, useState } from "react";
import { AARON, FLY, FROG, GEM, JACKAL, MOSES, PALM, PYRAMID, ROCK, SERPENT, SOLDIER, renderSprite, type Sprite } from "./sprites";
import { applyUpgrade, createInitialState, update } from "./engine";
import type { Entity, GameState, UpgradeChoice } from "./types";

const SPRITE_MAP: Record<string, Sprite> = {
  moses: MOSES,
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
  // Companions — Aaron sprite is reused with a tint hint; different NPCs
  // are visually distinguished by their name label rendered above them.
  bithiah: AARON,
  aaron: AARON,
  miriam: AARON,
  jethro: AARON,
  zipporah: AARON,
  joshua: AARON,
  hur: AARON,
  elder: AARON,
};

const SCALE = 3; // pixel scale — each sprite pixel becomes 3 screen px

// Chunky sand tile drawn once and tiled — subtle warm gradient.
function makeSandTile(): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, "#eccf9e");
  grd.addColorStop(1, "#dbb47f");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  // sparse dots
  g.fillStyle = "rgba(120,80,50,0.08)";
  for (let i = 0; i < 40; i++) {
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
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
  const [uiTick, setUiTick] = useState(0); // trigger overlay re-renders

  useEffect(() => {
    stateRef.current = createInitialState();
    const cnv = canvasRef.current!;
    const ctx = cnv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const sandTile = makeSandTile();

    // ----- input -----
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (e.key === "Escape" || e.key.toLowerCase() === "p") onTogglePause();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // touch joystick
    const joystick = { active: false, cx: 0, cy: 0, x: 0, y: 0 };
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      joystick.active = true;
      joystick.cx = t.clientX;
      joystick.cy = t.clientY;
      joystick.x = t.clientX;
      joystick.y = t.clientY;
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

    // ----- resize -----
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cnv.width = Math.floor(cnv.clientWidth * dpr);
      cnv.height = Math.floor(cnv.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // ----- loop -----
    let last = performance.now();
    let raf = 0;
    let uiCounter = 0;
    let gameOverFired = false;

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      const s = stateRef.current;
      // read input
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
          ix = (jx / mag) * n;
          iy = (jy / mag) * n;
        }
      }
      s.input.x = ix;
      s.input.y = iy;
      s.paused = paused;

      if (!paused && !s.gameOver && !s.levelUpPending) update(s, dt);

      draw(ctx, cnv, s, sandTile);

      if (s.gameOver && !gameOverFired) {
        gameOverFired = true;
        onGameOver({ level: s.level, survivalSeconds: Math.floor(s.survivalSeconds), kills: s.kills });
      }

      // trigger overlay re-renders infrequently
      uiCounter++;
      if (uiCounter % 6 === 0) setUiTick((v) => v + 1);

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
          {pending && (
            <LevelUpOverlay
              choices={pending}
              onPick={(c) => {
                applyUpgrade(s, c);
                setUiTick((v) => v + 1);
              }}
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

function HUD({ state, tick: _tick }: { state: GameState; tick: number }) {
  const p = state.player;
  const xpPct = Math.min(1, state.xp / state.xpToNext);
  const hpPct = Math.max(0, p.hp / p.maxHp);
  const mins = Math.floor(state.survivalSeconds / 60);
  const secs = Math.floor(state.survivalSeconds % 60);
  return (
    <>
      {/* XP bar top */}
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
      </div>
    </>
  );
}

function LevelUpOverlay({ choices, onPick }: { choices: UpgradeChoice[]; onPick: (c: UpgradeChoice) => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="max-w-3xl w-[92%] rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="mb-1 text-center text-2xl">Level Up!</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">Choose your blessing</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {choices.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className="group rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-1 hover:border-primary hover:bg-secondary"
            >
              <div className="mb-2 text-sm font-bold text-primary">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- drawing ----------------
function draw(ctx: CanvasRenderingContext2D, cnv: HTMLCanvasElement, s: GameState, sandTile: HTMLCanvasElement) {
  const w = cnv.width;
  const h = cnv.height;

  // Sand background — tile relative to camera for parallax
  const cam = s.camera;
  const dpr = w / cnv.clientWidth;
  const viewW = cnv.clientWidth;
  const viewH = cnv.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);

  const tileSize = 64;
  const offX = -((cam.x * 0.5) % tileSize);
  const offY = -((cam.y * 0.5) % tileSize);
  for (let y = offY - tileSize; y < viewH + tileSize; y += tileSize) {
    for (let x = offX - tileSize; x < viewW + tileSize; x += tileSize) {
      ctx.drawImage(sandTile, x, y);
    }
  }

  // Warm vignette
  const grd = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.2, viewW / 2, viewH / 2, viewH * 0.9);
  grd.addColorStop(0, "rgba(255,220,170,0)");
  grd.addColorStop(1, "rgba(140,80,40,0.28)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, viewW, viewH);

  // World-to-screen offset
  const camX = cam.x - viewW / 2;
  const camY = cam.y - viewH / 2;

  // Sort by y for pseudo-depth
  const drawList: Entity[] = [];
  for (const e of s.entities.values()) drawList.push(e);
  drawList.sort((a, b) => a.pos.y - b.pos.y);

  for (const e of drawList) {
    // Blood pool — draw as a soft red radial stain on the sand.
    if (e.kind === "bloodpool") {
      const cx = e.pos.x - camX;
      const cy = e.pos.y - camY;
      const r = (e.data?.radius as number) ?? 90;
      const alpha = Math.min(1, (e.ttl ?? 0) / 1.5) * 0.55;
      const grd2 = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      grd2.addColorStop(0, `rgba(140,20,20,${alpha})`);
      grd2.addColorStop(0.7, `rgba(120,10,10,${alpha * 0.6})`);
      grd2.addColorStop(1, "rgba(120,10,10,0)");
      ctx.fillStyle = grd2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const sprite = SPRITE_MAP[e.kind];
    if (!sprite) continue;
    const frameIdx = Math.floor(e.animT) % sprite.frames.length;
    const flip = e.facing === -1;

    // Frog hop — compute vertical offset and squash/stretch from hopT.
    let hopOffY = 0;
    let scaleY = 1;
    let scaleX = 1;
    let frogFrame = frameIdx;
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
    // Soft shadow — stays on the ground even while frogs hop.
    const shadowY = Math.round(e.pos.y - camY + 8);
    const shadowScale = e.kind === "frog" ? Math.max(0.5, 1 - Math.abs(hopOffY) / 40) : 1;
    ctx.fillStyle = `rgba(0,0,0,${0.18 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(sx + drawW / 2, shadowY, img.width * 0.35 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, sx, sy, drawW, drawH);

    // Ally name floating label
    if (e.team === "ally" && e.data?.npcLabel) {
      ctx.font = "600 10px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillText(String(e.data.npcLabel), sx + drawW / 2 + 1, sy - 3);
      ctx.fillStyle = "#f6efdc";
      ctx.fillText(String(e.data.npcLabel), sx + drawW / 2, sy - 4);
    }

    // Enemy HP bar
    if (e.team === "enemy" && e.hp < e.maxHp) {
      const bw = 22;
      const bx = sx + drawW / 2 - bw / 2;
      const by = sy - 5;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = "#e05a48";
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
    }
  }
}
