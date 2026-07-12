import { useEffect, useRef, useState } from "react";
import { AARON, FLY, FROG, GEM, JACKAL, MOSES, MOSES_NOSTAFF, PALM, PYRAMID, ROCK, SERPENT, SOLDIER, renderSprite, type Sprite } from "./sprites";
import { applyUpgrade, createInitialState, dismissNewNpc, dismissNewPlague, update } from "./engine";
import { PLAGUES } from "./plagues";
import { NPCS } from "./npcs";
import type { Entity, GameState, NpcId, PlagueId, UpgradeChoice } from "./types";

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
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, "#eccf9e");
  grd.addColorStop(1, "#dbb47f");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
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
          ix = (jx / mag) * n;
          iy = (jy / mag) * n;
        }
      }
      s.input.x = ix;
      s.input.y = iy;
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

function LoadoutBar({
  state,
  tick: _tick,
  onDismissPlague,
  onDismissNpc,
}: {
  state: GameState;
  tick: number;
  onDismissPlague: (id: PlagueId) => void;
  onDismissNpc: (id: NpcId) => void;
}) {
  const plagues = Array.from(state.plagues.entries());
  const npcs = Array.from(state.npcs.keys());
  return (
    <div className="absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
      {plagues.map(([id, lvl]) => (
        <LoadoutPill
          key={id}
          isNew={state.newPlagues.has(id)}
          title={PLAGUES[id].name}
          subtitle={`Lv ${lvl}`}
          tone="plague"
          onClick={() => onDismissPlague(id)}
        />
      ))}
      {npcs.map((id) => (
        <LoadoutPill
          key={id}
          isNew={state.newNpcs.has(id)}
          title={NPCS[id].name}
          subtitle="Companion"
          tone="ally"
          onClick={() => onDismissNpc(id)}
        />
      ))}
    </div>
  );
}

function LoadoutPill({
  isNew,
  title,
  subtitle,
  tone,
  onClick,
}: {
  isNew: boolean;
  title: string;
  subtitle: string;
  tone: "plague" | "ally";
  onClick: () => void;
}) {
  const toneCls = tone === "plague"
    ? "border-primary/50 bg-black/40 text-white"
    : "border-gold/50 bg-black/40 text-white";
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
        <span
          className="absolute -right-1.5 -top-2 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none tracking-wider text-black shadow"
          style={{ animation: "exodus-new-bounce 0.9s ease-in-out infinite" }}
        >
          NEW
        </span>
      )}
    </button>
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
              className="group relative rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-1 hover:border-primary hover:bg-secondary"
            >
              {c.isUnlock && (
                <span
                  className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow ${c.isCompanion ? "bg-sky-400 text-white" : "bg-yellow-400 text-black"}`}
                  style={{ animation: "exodus-new-bounce 0.9s ease-in-out infinite" }}
                >
                  NEW
                </span>
              )}
              <div className="mb-2 text-sm font-bold text-primary">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.description}</div>
              {c.scripture && (
                <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] italic leading-snug text-foreground/80">
                  {c.scripture}
                </div>
              )}
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

  const grd = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.2, viewW / 2, viewH / 2, viewH * 0.9);
  grd.addColorStop(0, "rgba(255,220,170,0)");
  grd.addColorStop(1, "rgba(140,80,40,0.28)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, viewW, viewH);

  const camX = cam.x - viewW / 2;
  const camY = cam.y - viewH / 2;

  // 1) Ground-level pass — blood pools always render BENEATH all characters
  //    so Moses, allies, and enemies visually walk on top of them.
  for (const e of s.entities.values()) {
    if (e.kind !== "bloodpool") continue;
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

  // 2) Depth-sorted pass for everything else.
  const drawList: Entity[] = [];
  let staffSwinging = false;
  for (const e of s.entities.values()) {
    if (e.kind === "bloodpool") continue;
    if (e.kind === "staffswing") staffSwinging = true;
    drawList.push(e);
  }
  drawList.sort((a, b) => a.pos.y - b.pos.y);

  for (const e of drawList) {
    // Staff swing — the staff sprite on Moses is hidden this frame (via
    // MOSES_NOSTAFF) and we render an animated swinging staff sweeping through
    // an arc from Moses' hand, trailed by a chunky pixel-art crescent slash.
    if (e.kind === "staffswing") {
      void e.data?.range;
      const facing = (e.data?.facing as number) ?? 1;
      const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / 0.18));
      const progress = 1 - life;
      // Overhead swing — from up-behind to down-forward. Reads clearly as
      // a top-to-bottom axe/staff strike.
      const startA = facing === 1 ? -Math.PI * 0.85 : Math.PI + Math.PI * 0.85;
      const endA   = facing === 1 ?  Math.PI * 0.35 : Math.PI - Math.PI * 0.35;
      // Fixed staff length identical to Moses' idle staff (visible column
      // is 20 pixels tall × SCALE=3 = 60 on-screen pixels).
      const staffLen = 60;
      // Pivot at Moses' hand near waist — never at feet or groin.
      const cx = s.player.pos.x - camX + facing * 5;
      const cy = s.player.pos.y - camY - 22;
      const swingAng = startA + (endA - startA) * progress;

      ctx.save();
      // Elegant white slash — trails behind the tip along the arc.
      // Length is approximately twice the previous crescent by trailing the
      // full past sweep with brighter, larger tail pixels.
      const trailStart = Math.max(0, progress - 0.75);
      const segs = 26;
      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1);
        const a = startA + (endA - startA) * (trailStart + t * (progress - trailStart));
        const fade = life * (0.25 + 0.75 * t);
        // outer glow
        ctx.globalAlpha = fade * 0.55;
        ctx.fillStyle = "#ffffff";
        const ox = cx + Math.cos(a) * staffLen;
        const oy = cy + Math.sin(a) * staffLen;
        const outerSz = t > 0.8 ? 7 : t > 0.5 ? 6 : 5;
        ctx.fillRect(Math.round(ox - outerSz / 2), Math.round(oy - outerSz / 2), outerSz, outerSz);
        // bright core
        ctx.globalAlpha = fade;
        ctx.fillStyle = "#ffffff";
        const coreSz = t > 0.8 ? 4 : 3;
        ctx.fillRect(Math.round(ox - coreSz / 2), Math.round(oy - coreSz / 2), coreSz, coreSz);
      }
      // The swinging staff itself — length matches the idle staff exactly.
      ctx.globalAlpha = 1;
      const tipX = cx + Math.cos(swingAng) * staffLen;
      const tipY = cy + Math.sin(swingAng) * staffLen;
      ctx.strokeStyle = "#2b1d10";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = "#8a5a34";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = "#b48355";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
      // white glowing tip
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, Math.PI * 2); ctx.fill();
      // knob at pivot so staff never looks detached
      ctx.fillStyle = "#5a3820";
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }

    if (e.kind === "companionmelee") {
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
      continue;
    }

    if (e.kind === "bolt") {
      const boltKind = (e.data?.boltKind as string | undefined) ?? "default";
      const color = (e.data?.boltColor as string | undefined) ?? "#f0e8b4";
      const x = e.pos.x - camX;
      const y = e.pos.y - camY;
      const angle = (e.data?.angle as number | undefined) ?? Math.atan2(e.vel.y, e.vel.x);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      if (boltKind === "spear") {
        // Joshua — long spear shaft with steel tip.
        ctx.fillStyle = "#5a3820"; ctx.fillRect(-10, -1, 18, 2);
        ctx.fillStyle = color; ctx.fillRect(6, -2, 6, 4);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(10, -1, 2, 2);
      } else if (boltKind === "waterbowl") {
        // Miriam — a splash of water.
        ctx.fillStyle = "#3f7bbf"; ctx.fillRect(-4, -4, 8, 8);
        ctx.fillStyle = color; ctx.fillRect(-3, -3, 6, 6);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-1, -1, 2, 2);
      } else if (boltKind === "aaronstaff") {
        // Aaron's melee flash — handled by companionmelee above, this branch
        // is unused for Aaron, kept for safety.
        ctx.fillStyle = color; ctx.fillRect(-6, -2, 12, 4);
      } else if (boltKind === "flint") {
        // Zipporah — sharp flint sliver.
        ctx.fillStyle = "#4a4a4a"; ctx.fillRect(-4, -1, 8, 2);
        ctx.fillStyle = color; ctx.fillRect(-3, -1, 6, 2);
      } else {
        // wisdom / prayer / reed — pulsing glowing orb with cross-glow.
        ctx.fillStyle = color; ctx.fillRect(-4, -1, 8, 2); ctx.fillRect(-1, -4, 2, 8);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-1, -1, 2, 2);
      }
      ctx.restore();
      continue;
    }



    // Gnat swarm — dedicated renderer draws every mosquito distinctly.
    if (e.kind === "gnatswarm") {
      drawGnatSwarm(ctx, e, camX, camY);
      continue;
    }
    if (e.kind === "livestockcloud") {
      drawParticleCloud(ctx, e, camX, camY, {
        backing: "rgba(60,110,40,0.9)",
        particle: "#2f4a1a",
        highlight: "#8ab24a",
      });
      continue;
    }
    if (e.kind === "boilscloud") {
      drawParticleCloud(ctx, e, camX, camY, {
        backing: "rgba(96,40,120,0.9)",
        particle: "#3a1240",
        highlight: "#c078e0",
      });
      continue;
    }
    if (e.kind === "firstborncloud") {
      drawFirstbornCloud(ctx, e, camX, camY);
      continue;
    }
    if (e.kind === "locustswarm") {
      drawLocustSwarm(ctx, e, camX, camY);
      continue;
    }
    if (e.kind === "hailstone") {
      drawHailstone(ctx, e, camX, camY);
      continue;
    }
    if (e.kind === "hailimpact") {
      drawHailImpact(ctx, e, camX, camY);
      continue;
    }
    if (e.kind === "fireball") {
      drawFireball(ctx, e, camX, camY);
      continue;
    }
    if (e.kind === "fireexplosion") {
      drawFireExplosion(ctx, e, camX, camY);
      continue;
    }


    // Hide Moses' built-in staff column while he's swinging so we don't
    // render two staffs on top of each other.
    const sprite = e.kind === "moses" && staffSwinging ? MOSES_NOSTAFF : SPRITE_MAP[e.kind];
    if (!sprite) continue;
    const frameIdx = Math.floor(e.animT) % sprite.frames.length;
    const flip = e.facing === -1;

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

    if (e.kind === "serpent") {
      // Rotate the sprite (and its shadow) so it always faces the direction
      // it's travelling — never tail-first.
      const angle = (e.data?.angle as number | undefined) ?? Math.atan2(e.vel.y, e.vel.x);
      const rotImg = renderSprite(sprite, frameIdx, SCALE, false);
      ctx.save();
      ctx.translate(e.pos.x - camX, e.pos.y - camY + 6);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(0, 0, rotImg.width * 0.45, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(e.pos.x - camX, e.pos.y - camY);
      ctx.rotate(angle);
      ctx.drawImage(rotImg, -rotImg.width / 2, -rotImg.height / 2);
      ctx.restore();
    } else {
      const downed = e.team === "ally" && e.data?.downedUntil != null;
      const shadowY = Math.round(e.pos.y - camY + 8);
      const shadowScale = e.kind === "frog" ? Math.max(0.5, 1 - Math.abs(hopOffY) / 40) : 1;
      ctx.fillStyle = `rgba(0,0,0,${0.18 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(sx + drawW / 2, shadowY, img.width * 0.35 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      if (downed) {
        // Fallen companion — rotated on side, dimmed, with resting glyph.
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
    }

    // Companion health bar — green, mirrors Moses' HP bar style.
    if (e.team === "ally") {
      const bw = 26;
      const bx = sx + drawW / 2 - bw / 2;
      const by = sy - 5;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = "#1e5a1e";
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = "#4ec24e";
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
    }

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


  // 3) Plague of Darkness — dim the world with a lamp-circle around Moses.
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
    // warm lamp glow inside the safe circle
    const lamp = ctx.createRadialGradient(px, py, 0, px, py, holeR);
    lamp.addColorStop(0, `rgba(255,200,120,${0.25 * k})`);
    lamp.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

// ---------------- shared hazard renderers ----------------
function drawParticleCloud(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  camX: number,
  camY: number,
  tint: { backing: string; particle: string; highlight?: string },
) {
  const particles = e.data?.particles as
    | Array<{ ox: number; oy: number; phase: number; amp: number; size: number }>
    | undefined;
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
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
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
  const particles = e.data?.particles as
    | Array<{ ox: number; oy: number; phase: number; amp: number; wing: number }>
    | undefined;
  if (!particles) return;
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const t = e.animT;
  const r = (e.data?.radius as number) ?? 130;
  // backing darkening — locusts blot out the sun
  ctx.save();
  ctx.globalAlpha = 0.35;
  const grd = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  grd.addColorStop(0, "rgba(50,40,20,0.9)");
  grd.addColorStop(1, "rgba(50,40,20,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // individual locusts
  for (const p of particles) {
    const jx = Math.cos(t * 5 + p.phase) * p.amp;
    const jy = Math.sin(t * 6.4 + p.phase * 1.1) * p.amp;
    const x = Math.round(cx + p.ox + jx);
    const y = Math.round(cy + p.oy + jy);
    // body — brown/tan
    ctx.fillStyle = "#7a5a20";
    ctx.fillRect(x, y, 3, 2);
    ctx.fillStyle = "#3a2a10";
    ctx.fillRect(x, y + 1, 3, 1);
    // wings flap
    const flap = Math.sin(t * 22 + p.wing) > 0;
    ctx.fillStyle = "rgba(220,200,120,0.85)";
    if (flap) {
      ctx.fillRect(x - 1, y - 1, 2, 1);
      ctx.fillRect(x + 2, y - 1, 2, 1);
    } else {
      ctx.fillRect(x - 1, y, 2, 1);
      ctx.fillRect(x + 2, y, 2, 1);
    }
  }
}

function drawHailstone(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  // long trailing streak
  ctx.strokeStyle = "rgba(200,225,255,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - e.vel.x * 0.08, y - e.vel.y * 0.08);
  ctx.lineTo(x, y);
  ctx.stroke();
  // chunky pixel-art ice boulder
  ctx.fillStyle = "#4a6a90"; ctx.fillRect(x - 5, y - 4, 10, 9);
  ctx.fillStyle = "#8fb0d4"; ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.fillStyle = "#dbe9f7"; ctx.fillRect(x - 3, y - 3, 6, 6);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 2, y - 3, 3, 3);
  ctx.fillStyle = "#a8c8e4"; ctx.fillRect(x + 1, y + 1, 2, 2);
}

function drawHailImpact(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const maxTtl = (e.data?.maxTtl as number) ?? 0.45;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / maxTtl));
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const R = (e.data?.radius as number) ?? 60;
  const rNow = R * (1 - life * 0.7) + 6;
  ctx.save();
  // frosty shockwave ring
  ctx.globalAlpha = life * 0.55;
  const grd = ctx.createRadialGradient(cx, cy, rNow * 0.2, cx, cy, rNow);
  grd.addColorStop(0, "rgba(220,240,255,0.9)");
  grd.addColorStop(0.6, "rgba(140,180,220,0.5)");
  grd.addColorStop(1, "rgba(140,180,220,0)");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, rNow, 0, Math.PI * 2); ctx.fill();
  // ring outline
  ctx.globalAlpha = life * 0.9;
  ctx.strokeStyle = "#eaf4ff";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, rNow * 0.9, 0, Math.PI * 2); ctx.stroke();
  // scattered ice shards
  ctx.globalAlpha = life;
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = rNow * (0.6 + 0.35 * ((i * 7) % 5) / 5);
    const sx = Math.round(cx + Math.cos(a) * rr);
    const sy = Math.round(cy + Math.sin(a) * rr);
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#b8d4ec";
    ctx.fillRect(sx - 1, sy - 1, 3, 3);
    ctx.fillStyle = "#4a6a90";
    ctx.fillRect(sx, sy, 1, 1);
  }
  ctx.restore();
}

function drawFireball(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const t = e.animT || 0;
  ctx.save();
  // long, bright fire trail — layered fading blobs
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
  // outer flame flicker
  const flick = Math.sin(t * 30) * 1.5;
  ctx.fillStyle = "#7a1400"; ctx.fillRect(x - 10, y - 10, 20, 20);
  ctx.fillStyle = "#ff3010"; ctx.fillRect(x - 9, y - 9, 18, 18);
  ctx.fillStyle = "#ff7020"; ctx.fillRect(x - 7 + flick, y - 7, 14, 14);
  ctx.fillStyle = "#ffb050"; ctx.fillRect(x - 5, y - 5, 10, 10);
  ctx.fillStyle = "#ffe090"; ctx.fillRect(x - 3, y - 3 + flick, 6, 6);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 2, y - 2, 4, 4);
  // ember flecks trailing outside the core
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
  // outer smoke halo
  ctx.globalAlpha = life * 0.6;
  const smoke = ctx.createRadialGradient(cx, cy, rNow * 0.4, cx, cy, rNow * 1.25);
  smoke.addColorStop(0, "rgba(80,20,0,0.6)");
  smoke.addColorStop(1, "rgba(60,20,10,0)");
  ctx.fillStyle = smoke;
  ctx.beginPath(); ctx.arc(cx, cy, rNow * 1.25, 0, Math.PI * 2); ctx.fill();
  // main fireball
  ctx.globalAlpha = life;
  const grd = ctx.createRadialGradient(cx, cy, rNow * 0.15, cx, cy, rNow);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(0.25, "#fff2b0");
  grd.addColorStop(0.55, "#ff8020");
  grd.addColorStop(0.85, "#c02010");
  grd.addColorStop(1, "rgba(80,20,0,0)");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, rNow, 0, Math.PI * 2); ctx.fill();
  // shockwave ring
  ctx.globalAlpha = life * 0.8;
  ctx.strokeStyle = "#ffd070";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, rNow * 0.85, 0, Math.PI * 2); ctx.stroke();
  // ember shrapnel — chunky pixels flung outward
  ctx.globalAlpha = life;
  const embers = 22;
  for (let i = 0; i < embers; i++) {
    const a = (i / embers) * Math.PI * 2 + (1 - life) * 2;
    const rr = rNow * (0.75 + ((i * 13) % 7) / 20);
    const px = Math.round(cx + Math.cos(a) * rr);
    const py = Math.round(cy + Math.sin(a) * rr);
    ctx.fillStyle = i % 3 === 0 ? "#fff4b0" : i % 3 === 1 ? "#ff8020" : "#ffcc40";
    ctx.fillRect(px - 1, py - 1, 3, 3);
    ctx.fillStyle = "#3a0800";
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.restore();
}

// Firstborn cloud — a bright, holy white glow that drifts across the field.
function drawFirstbornCloud(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const particles = e.data?.particles as
    | Array<{ ox: number; oy: number; phase: number; amp: number; size: number }>
    | undefined;
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
  // Outer holy halo
  ctx.globalAlpha = 0.35 * fade;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 1.35);
  halo.addColorStop(0, "rgba(255,250,220,0.95)");
  halo.addColorStop(0.5, "rgba(255,240,180,0.4)");
  halo.addColorStop(1, "rgba(255,240,180,0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fill();
  // Inner bright core
  ctx.globalAlpha = 0.85 * fade;
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.6, "rgba(255,250,210,0.7)");
  core.addColorStop(1, "rgba(255,250,210,0)");
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Sparkling motes swirling inside the cloud
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
      // tiny gold twinkle
      if (shimmer > 0.9) {
        ctx.fillStyle = "#ffd070";
        ctx.fillRect(x - 1, y, 1, 1);
        ctx.fillRect(x + p.size, y, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// Gnat swarm — every mosquito is drawn as a distinct tiny insect with
// flapping wings, so the swarm reads as hundreds of individual bugs rather
// than a solid cloud.
function drawGnatSwarm(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const particles = e.data?.particles as
    | Array<{ ox: number; oy: number; phase: number; amp: number }>
    | undefined;
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

  // Very faint haze so the swarm reads as a cloud outline without hiding the bugs.
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
    // wings
    ctx.fillStyle = "rgba(70,55,40,0.75)";
    if (flap) {
      ctx.fillRect(x - 2, y - 1, 1, 1);
      ctx.fillRect(x + 2, y - 1, 1, 1);
    } else {
      ctx.fillRect(x - 2, y, 1, 1);
      ctx.fillRect(x + 2, y, 1, 1);
    }
    // body outline
    ctx.fillStyle = "#0a0805";
    ctx.fillRect(x - 1, y, 2, 2);
    // tiny brown highlight so the bug pops
    ctx.fillStyle = "#4a341f";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
