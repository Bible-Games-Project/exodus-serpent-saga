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
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
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
  push("magnet", state.magnetBoostUntil);
  push("star", state.invulnUntil);
  push("lightning", state.speedBoostUntil);
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
          <div className="mt-2 flex justify-end gap-1">
            {buffs.map((b) => (
              <div key={b.kind} className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white" style={{ borderLeft: `3px solid ${BONUSES[b.kind].color}` }}>
                {BONUSES[b.kind].emoji} {Math.ceil(b.remaining)}s
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function LoadoutBar({ state, tick: _tick, onDismissPlague, onDismissNpc }: {
  state: GameState; tick: number;
  onDismissPlague: (id: PlagueId) => void;
  onDismissNpc: (id: NpcId) => void;
}) {
  const plagues = Array.from(state.plagues.entries());
  const npcs = Array.from(state.npcs.keys());
  return (
    <div className="absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
      {plagues.map(([id, lvl]) => (
        <LoadoutPill key={id} isNew={state.newPlagues.has(id)} title={PLAGUES[id].name} subtitle={`Lv ${lvl}`} tone="plague" onClick={() => onDismissPlague(id)} />
      ))}
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

function LevelUpOverlay({ choices, onPick }: { choices: UpgradeChoice[]; onPick: (c: UpgradeChoice) => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="max-w-3xl w-[92%] rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="mb-1 text-center text-2xl">Level Up!</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">Choose your blessing</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {choices.map((c) => (
            <button key={c.id} onClick={() => onPick(c)}
              className="group relative rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-1 hover:border-primary hover:bg-secondary">
              {c.isUnlock && (
                <span className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow ${c.isCompanion ? "bg-sky-400 text-white" : "bg-yellow-400 text-black"}`} style={{ animation: "exodus-new-bounce 0.9s ease-in-out infinite" }}>
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

  // Screen shake offset applied via translate.
  const shake = s.screenShake ?? 0;
  const shX = shake ? (Math.random() - 0.5) * shake : 0;
  const shY = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(shX, shY);

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
    if (e.kind === "boilscloud") { drawParticleCloud(ctx, e, camX, camY, { backing: "rgba(96,40,120,0.9)", particle: "#3a1240", highlight: "#c078e0" }); continue; }
    if (e.kind === "firstborncloud") { drawFirstbornCloud(ctx, e, camX, camY); continue; }
    if (e.kind === "locustswarm") { drawLocustSwarm(ctx, e, camX, camY); continue; }
    if (e.kind === "hailstone") { drawHailstone(ctx, e, camX, camY); continue; }
    if (e.kind === "hailimpact") { drawHailImpact(ctx, e, camX, camY); continue; }
    if (e.kind === "fireball") { drawFireball(ctx, e, camX, camY); continue; }
    if (e.kind === "fireexplosion") { drawFireExplosion(ctx, e, camX, camY); continue; }
    if (e.kind === "redseawall") { drawRedSeaWall(ctx, e, camX, camY); continue; }
    if (e.kind === "redseaburst") { drawRedSeaBurst(ctx, e, camX, camY); continue; }
    if (e.kind === "throne") { drawThrone(ctx, e, camX, camY); continue; }
    if (e.kind === "arrow" || e.kind === "spear_e" || e.kind === "magebolt") { drawEnemyProjectile(ctx, e, camX, camY); continue; }
    if (e.kind?.startsWith("bonus_")) { drawBonus(ctx, e, camX, camY, s); continue; }
    if (e.kind === "moses") { drawMoses(ctx, e, s, camX, camY, staffSwinging); continue; }
    if (e.kind === "ramses") { drawRamses(ctx, e, camX, camY, s); continue; }

    // Programmatic enemy renderers
    if (drawProceduralEnemy(ctx, e, camX, camY)) continue;

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
  // Anchor at Moses' hand/waist. Slight vertical bob + rotation with walk.
  const walking = Math.hypot(e.vel.x, e.vel.y) > 5;
  const t = e.animT;
  const bob = walking ? Math.sin(t) * 1.4 : 0;
  const rot = -0.18 + (walking ? Math.sin(t) * 0.06 : 0);
  const cx = e.pos.x - camX + facing * 8;
  const cy = e.pos.y - camY - 22 + bob;
  const staffLen = 60;
  const tipX = cx + Math.cos(rot) * staffLen * facing;
  const tipY = cy + Math.sin(rot) * staffLen;
  ctx.save();
  ctx.strokeStyle = "#2b1d10"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.strokeStyle = "#b48355"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.fillStyle = "#5a3820";
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
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
function drawProceduralEnemy(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number): boolean {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const bob = Math.sin(e.animT) * 1;
  const flip = e.facing === -1 ? -1 : 1;

  const shadow = (r: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(x, y + 10, r, 3, 0, 0, Math.PI * 2); ctx.fill();
  };
  const hpBar = () => {
    if (e.hp < e.maxHp) {
      const bw = 22;
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(x - bw / 2, y - 30, bw, 3);
      ctx.fillStyle = "#e05a48"; ctx.fillRect(x - bw / 2, y - 30, bw * Math.max(0, e.hp / e.maxHp), 3);
    }
  };

  if (e.kind === "swordsoldier") {
    shadow(10); ctx.save();
    // dark armored soldier w/ sword
    ctx.fillStyle = "#4a4a4a"; ctx.fillRect(x - 8, y - 24 + bob, 16, 20);
    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x - 8, y - 6 + bob, 16, 4);
    ctx.fillStyle = "#8a5a3a"; ctx.fillRect(x - 6, y - 26 + bob, 12, 6); // helmet
    ctx.fillStyle = "#c0c0c0"; ctx.fillRect(x + flip * 8, y - 22 + bob, flip * 3, 18); // sword blade
    ctx.fillStyle = "#8a5a3a"; ctx.fillRect(x + flip * 8, y - 4 + bob, flip * 3, 4); // sword hilt
    ctx.restore(); hpBar(); return true;
  }
  if (e.kind === "archer") {
    shadow(9); ctx.save();
    ctx.fillStyle = "#7a5a2a"; ctx.fillRect(x - 6, y - 22 + bob, 12, 18);
    ctx.fillStyle = "#c9b090"; ctx.fillRect(x - 4, y - 26 + bob, 8, 6); // face
    ctx.fillStyle = "#3a2a10"; ctx.fillRect(x - 5, y - 26 + bob, 10, 2); // headband
    // bow
    ctx.strokeStyle = "#4a3820"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + flip * 8, y - 14 + bob, 8, -Math.PI / 2, Math.PI / 2, flip < 0); ctx.stroke();
    // string
    ctx.strokeStyle = "#eee"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + flip * 8, y - 22 + bob); ctx.lineTo(x + flip * 8, y - 6 + bob); ctx.stroke();
    ctx.restore(); hpBar(); return true;
  }
  if (e.kind === "knight") {
    shadow(16); ctx.save();
    // horse body
    ctx.fillStyle = "#4a3020"; ctx.fillRect(x - 14, y - 12 + bob, 28, 10);
    ctx.fillStyle = "#2a1810"; ctx.fillRect(x - 14, y - 4 + bob, 28, 6);
    // horse legs
    ctx.fillStyle = "#2a1810";
    ctx.fillRect(x - 12, y + bob, 3, 8); ctx.fillRect(x - 4, y + bob, 3, 8);
    ctx.fillRect(x + 3, y + bob, 3, 8); ctx.fillRect(x + 10, y + bob, 3, 8);
    // horse head
    ctx.fillStyle = "#4a3020"; ctx.fillRect(x + flip * 12, y - 18 + bob, flip * 6, 8);
    // rider
    ctx.fillStyle = "#5a5a70"; ctx.fillRect(x - 6, y - 26 + bob, 12, 14);
    ctx.fillStyle = "#8a8a9a"; ctx.fillRect(x - 5, y - 32 + bob, 10, 8);
    // spear
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 30 + bob); ctx.lineTo(x + flip * 22, y - 20 + bob); ctx.stroke();
    ctx.fillStyle = "#c0c0c0"; ctx.fillRect(x + flip * 22, y - 22 + bob, flip * 4, 3);
    ctx.restore(); hpBar(); return true;
  }
  if (e.kind === "chariot") {
    shadow(20); ctx.save();
    // horses
    ctx.fillStyle = "#3a2810"; ctx.fillRect(x + flip * 4, y - 14 + bob, flip * 16, 8);
    ctx.fillRect(x + flip * 4, y - 4 + bob, flip * 16, 6);
    ctx.fillStyle = "#5a3820";
    ctx.fillRect(x + flip * 20, y - 18 + bob, flip * 6, 8);
    // chariot cabin
    ctx.fillStyle = "#7a5030"; ctx.fillRect(x - 16 * flip, y - 16 + bob, 12, 14);
    ctx.fillStyle = "#c9a060"; ctx.fillRect(x - 15 * flip, y - 14 + bob, 10, 5);
    // wheel
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(x - 10 * flip, y + 4 + bob, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 17 * flip, y + 4 + bob); ctx.lineTo(x - 3 * flip, y + 4 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 10 * flip, y - 3 + bob); ctx.lineTo(x - 10 * flip, y + 11 + bob); ctx.stroke();
    // rider
    ctx.fillStyle = "#c0c0d0"; ctx.fillRect(x - 12 * flip, y - 28 + bob, 6, 14);
    ctx.restore(); hpBar(); return true;
  }
  if (e.kind === "mage") {
    shadow(11); ctx.save();
    // dark purple robe
    ctx.fillStyle = "#4a2060"; ctx.fillRect(x - 8, y - 24 + bob, 16, 20);
    ctx.fillStyle = "#2a1030"; ctx.fillRect(x - 8, y - 6 + bob, 16, 4);
    // hood
    ctx.fillStyle = "#301030"; ctx.fillRect(x - 7, y - 30 + bob, 14, 10);
    // glowing eyes
    ctx.fillStyle = "#ff4020"; ctx.fillRect(x - 3, y - 25 + bob, 2, 2); ctx.fillRect(x + 1, y - 25 + bob, 2, 2);
    // staff w/ orb
    ctx.strokeStyle = "#4a2810"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + flip * 8, y - 26 + bob); ctx.lineTo(x + flip * 12, y + 6 + bob); ctx.stroke();
    ctx.fillStyle = "#c060ff"; ctx.beginPath(); ctx.arc(x + flip * 8, y - 26 + bob, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x + flip * 8 - 1, y - 27 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); hpBar(); return true;
  }
  if (e.kind === "crow") {
    shadow(6); ctx.save();
    const flap = Math.sin(e.animT * 6) > 0;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(x - 5, y - 6 + bob, 10, 6);
    ctx.fillRect(x + flip * 5, y - 5 + bob, flip * 3, 3); // head
    ctx.fillStyle = "#e8c040"; ctx.fillRect(x + flip * 8, y - 4 + bob, flip * 2, 1); // beak
    // wings
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
    shadow(11); ctx.save();
    ctx.fillStyle = "#6a6a70"; ctx.fillRect(x - 12, y - 10 + bob, 24, 10);
    ctx.fillStyle = "#4a4a50"; ctx.fillRect(x - 12, y - 2 + bob, 24, 4);
    ctx.fillStyle = "#3a3a40"; // legs
    ctx.fillRect(x - 10, y + bob, 3, 6); ctx.fillRect(x - 3, y + bob, 3, 6);
    ctx.fillRect(x + 3, y + bob, 3, 6); ctx.fillRect(x + 8, y + bob, 3, 6);
    // head
    ctx.fillStyle = "#6a6a70"; ctx.fillRect(x + flip * 10, y - 14 + bob, flip * 6, 7);
    ctx.fillStyle = "#ffee40"; ctx.fillRect(x + flip * 13, y - 12 + bob, flip * 1, 1);
    // tail
    ctx.fillStyle = "#6a6a70"; ctx.fillRect(x - flip * 12, y - 12 + bob, -flip * 3, 3);
    ctx.restore(); hpBar(); return true;
  }
  if (e.kind === "lion") {
    shadow(14); ctx.save();
    ctx.fillStyle = "#c88a4a"; ctx.fillRect(x - 14, y - 12 + bob, 28, 12);
    ctx.fillStyle = "#8a5a20"; ctx.fillRect(x - 14, y - 4 + bob, 28, 4);
    // legs
    ctx.fillStyle = "#6a4a20";
    ctx.fillRect(x - 12, y + bob, 3, 7); ctx.fillRect(x - 4, y + bob, 3, 7);
    ctx.fillRect(x + 3, y + bob, 3, 7); ctx.fillRect(x + 10, y + bob, 3, 7);
    // head
    ctx.fillStyle = "#c88a4a"; ctx.fillRect(x + flip * 12, y - 16 + bob, flip * 8, 10);
    // mane
    ctx.fillStyle = "#5a3010";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(Math.round(x + flip * 16 + Math.cos(a) * 6), Math.round(y - 11 + bob + Math.sin(a) * 6), 3, 3);
    }
    ctx.fillStyle = "#ffee40"; ctx.fillRect(x + flip * 16, y - 12 + bob, flip * 1, 1);
    ctx.restore(); hpBar(); return true;
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
  const flip = e.facing === -1 ? -1 : 1;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(x, y + 12, 22, 5, 0, 0, Math.PI * 2); ctx.fill();

  let bob = 0;
  if (phase === "airborne") {
    const t = 1 - Math.max(0, Math.min(1, (d.leapT as number) / 0.75));
    // parabolic hop
    bob = -Math.sin(t * Math.PI) * 90;
  } else if (phase === "telegraph") {
    bob = -6 - Math.sin(s.now * 20) * 4;
  }

  ctx.save();
  // body — Pharaoh
  ctx.fillStyle = "#d09030"; ctx.fillRect(x - 12, y - 34 + bob, 24, 26); // torso (gold)
  ctx.fillStyle = "#8a5a10"; ctx.fillRect(x - 12, y - 12 + bob, 24, 4);
  // legs
  ctx.fillStyle = "#c07020";
  ctx.fillRect(x - 8, y - 8 + bob, 6, 12); ctx.fillRect(x + 2, y - 8 + bob, 6, 12);
  // headdress (nemes) — blue/gold striped
  ctx.fillStyle = "#3060c0"; ctx.fillRect(x - 12, y - 46 + bob, 24, 14);
  ctx.fillStyle = "#e8c040"; ctx.fillRect(x - 12, y - 44 + bob, 24, 2);
  ctx.fillRect(x - 12, y - 40 + bob, 24, 2);
  ctx.fillRect(x - 12, y - 36 + bob, 24, 2);
  // face
  ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - 6, y - 42 + bob, 12, 10);
  ctx.fillStyle = "#000"; ctx.fillRect(x - 3, y - 38 + bob, 2, 2); ctx.fillRect(x + 1, y - 38 + bob, 2, 2);
  // beard
  ctx.fillStyle = "#3a2010"; ctx.fillRect(x - 2, y - 32 + bob, 4, 6);
  // uraeus (cobra)
  ctx.fillStyle = "#e8c040"; ctx.fillRect(x - 1, y - 48 + bob, 2, 4);
  // crook & flail — held in front when active
  if (phase !== "airborne") {
    ctx.fillStyle = "#e8c040"; ctx.fillRect(x + flip * 12, y - 40 + bob, flip * 2, 20);
    ctx.fillRect(x - flip * 14, y - 38 + bob, -flip * 2, 18);
  }
  ctx.restore();

  // Land shockwave
  if (phase === "land") {
    const t = 1 - Math.max(0, Math.min(1, (d.leapT as number) / 0.4));
    const R = (d.landRadius as number) * (0.4 + t * 1.1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = "#f5d488"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y + 4, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#c9700a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 4, R * 0.75, 0, Math.PI * 2); ctx.stroke();
    // dust
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const rr = R * (0.7 + Math.random() * 0.3);
      const dx = Math.round(x + Math.cos(a) * rr);
      const dy = Math.round(y + 4 + Math.sin(a) * rr * 0.5);
      ctx.fillStyle = "#c9a06a"; ctx.fillRect(dx - 1, dy - 1, 3, 3);
    }
    // cracks
    ctx.strokeStyle = "#3a1810"; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x + Math.cos(a) * R * 0.85, y + 4 + Math.sin(a) * R * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  // HP bar (visible when active)
  if (d.active) {
    const bw = 60;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - bw / 2 - 1, y - 55 + bob - 1, bw + 2, 5);
    ctx.fillStyle = "#5a1a1a"; ctx.fillRect(x - bw / 2, y - 55 + bob, bw, 3);
    ctx.fillStyle = "#e04030"; ctx.fillRect(x - bw / 2, y - 55 + bob, bw * Math.max(0, e.hp / e.maxHp), 3);
    ctx.fillStyle = "#ffdd80"; ctx.font = "700 10px Nunito, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("RAMSES", x, y - 58 + bob);
  }
}

// ---------------- Throne ----------------
function drawThrone(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(x, y + 18, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
  // base
  ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 22, y - 4, 44, 20);
  ctx.fillStyle = "#8a5a20"; ctx.fillRect(x - 22, y + 12, 44, 4);
  // backrest
  ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 22, y - 40, 44, 40);
  ctx.fillStyle = "#e8c060"; ctx.fillRect(x - 20, y - 38, 40, 4);
  ctx.fillRect(x - 20, y - 32, 40, 2);
  // hieroglyph
  ctx.fillStyle = "#3a1810"; ctx.fillRect(x - 2, y - 20, 4, 6);
  ctx.fillRect(x - 6, y - 14, 12, 2);
  // armrests
  ctx.fillStyle = "#8a5a20"; ctx.fillRect(x - 26, y - 16, 4, 20); ctx.fillRect(x + 22, y - 16, 4, 20);
  ctx.restore();
}

// ---------------- staff swing effect ----------------
function drawStaffSwing(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, camX: number, camY: number) {
  const facing = (e.data?.facing as number) ?? 1;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / 0.18));
  const progress = 1 - life;
  const startA = facing === 1 ? -Math.PI * 0.85 : Math.PI + Math.PI * 0.85;
  const endA   = facing === 1 ?  Math.PI * 0.35 : Math.PI - Math.PI * 0.35;
  const staffLen = 60;
  const cx = s.player.pos.x - camX + facing * 5;
  const cy = s.player.pos.y - camY - 22;
  const swingAng = startA + (endA - startA) * progress;

  ctx.save();
  const trailStart = Math.max(0, progress - 0.75);
  const segs = 26;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const a = startA + (endA - startA) * (trailStart + t * (progress - trailStart));
    const fade = life * (0.25 + 0.75 * t);
    ctx.globalAlpha = fade * 0.55;
    ctx.fillStyle = "#ffffff";
    const ox = cx + Math.cos(a) * staffLen;
    const oy = cy + Math.sin(a) * staffLen;
    const outerSz = t > 0.8 ? 7 : t > 0.5 ? 6 : 5;
    ctx.fillRect(Math.round(ox - outerSz / 2), Math.round(oy - outerSz / 2), outerSz, outerSz);
    ctx.globalAlpha = fade;
    const coreSz = t > 0.8 ? 4 : 3;
    ctx.fillRect(Math.round(ox - coreSz / 2), Math.round(oy - coreSz / 2), coreSz, coreSz);
  }
  ctx.globalAlpha = 1;
  const tipX = cx + Math.cos(swingAng) * staffLen;
  const tipY = cy + Math.sin(swingAng) * staffLen;
  ctx.strokeStyle = "#2b1d10"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.strokeStyle = "#b48355"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5a3820";
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
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
  }
  ctx.restore();
}

// ---------------- Red Sea ----------------
function drawRedSeaWall(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const d = e.data!;
  const height = (d.height as number) * 2;
  const wallW = 80;
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  ctx.save();
  // main wall — layered low-poly slabs of water
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    ctx.globalAlpha = 0.7 + 0.3 * (1 - t);
    ctx.fillStyle = `rgb(${20 + t * 30}, ${60 + t * 40}, ${140 + t * 60})`;
    const w = wallW - i * 8;
    ctx.fillRect(x - w / 2, y - height / 2, w, height);
  }
  // foam crests
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  const crests = 12;
  for (let i = 0; i < crests; i++) {
    const yy = y - height / 2 + (i / crests) * height + Math.sin(e.animT * 3 + i) * 2;
    ctx.fillRect(x - wallW / 2 - 2, Math.round(yy), 4, 3);
    ctx.fillRect(x + wallW / 2 - 2, Math.round(yy), 4, 3);
  }
  // spray droplets flying ahead
  ctx.fillStyle = "rgba(200,230,255,0.8)";
  for (let i = 0; i < 20; i++) {
    const yy = y - height / 2 + Math.random() * height;
    const xx = x + (Math.sign(e.vel.x)) * (wallW / 2 + 4 + Math.random() * 40);
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
function drawBonus(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState) {
  const kind = (e.data?.bonusKind as BonusKind) ?? "heart";
  const def = BONUSES[kind];
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY) + Math.round(Math.sin(s.now * 4 + e.id) * 2);
  ctx.save();
  // halo
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = def.color;
  ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  if (kind === "heart") {
    ctx.fillStyle = "#ff5060";
    // pixel heart
    const H = [
      "..XX.XX..",
      ".XXXXXXX.",
      ".XXXXXXX.",
      "..XXXXX..",
      "...XXX...",
      "....X....",
    ];
    for (let ry = 0; ry < H.length; ry++) for (let rx = 0; rx < H[ry].length; rx++) {
      if (H[ry][rx] === "X") ctx.fillRect(x - 4 + rx, y - 5 + ry, 1, 1);
    }
  } else if (kind === "magnet") {
    ctx.fillStyle = "#c04040";
    ctx.fillRect(x - 5, y - 5, 3, 6); ctx.fillRect(x + 2, y - 5, 3, 6);
    ctx.fillStyle = "#a0a0a0";
    ctx.fillRect(x - 5, y + 1, 3, 3); ctx.fillRect(x + 2, y + 1, 3, 3);
    ctx.fillStyle = "#c04040"; ctx.fillRect(x - 5, y - 5, 10, 2);
  } else if (kind === "star") {
    ctx.fillStyle = "#ffd54a";
    const S = ["....X....",".XXXXXXX.","..XXXXX..","...XXX...","..XX.XX..",".X.....X."];
    for (let ry = 0; ry < S.length; ry++) for (let rx = 0; rx < S[ry].length; rx++) {
      if (S[ry][rx] === "X") ctx.fillRect(x - 4 + rx, y - 4 + ry, 1, 1);
    }
    ctx.fillStyle = "#fff8b0"; ctx.fillRect(x - 1, y - 2, 2, 2);
  } else if (kind === "lightning") {
    ctx.fillStyle = "#ffe040";
    const L = ["...XXX.","..XX...",".XXXX..","...XX..","..XX...",".XX....","XX....."];
    for (let ry = 0; ry < L.length; ry++) for (let rx = 0; rx < L[ry].length; rx++) {
      if (L[ry][rx] === "X") ctx.fillRect(x - 3 + rx, y - 4 + ry, 1, 1);
    }
    ctx.fillStyle = "#fffbaa"; ctx.fillRect(x, y - 2, 1, 4);
  }
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
  const particles = e.data?.particles as Array<{ ox: number; oy: number; phase: number; amp: number; wing: number }> | undefined;
  if (!particles) return;
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const t = e.animT;
  const r = (e.data?.radius as number) ?? 130;
  ctx.save();
  ctx.globalAlpha = 0.35;
  const grd = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  grd.addColorStop(0, "rgba(50,40,20,0.9)");
  grd.addColorStop(1, "rgba(50,40,20,0)");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const p of particles) {
    const jx = Math.cos(t * 5 + p.phase) * p.amp;
    const jy = Math.sin(t * 6.4 + p.phase * 1.1) * p.amp;
    const x = Math.round(cx + p.ox + jx);
    const y = Math.round(cy + p.oy + jy);
    ctx.fillStyle = "#7a5a20"; ctx.fillRect(x, y, 3, 2);
    ctx.fillStyle = "#3a2a10"; ctx.fillRect(x, y + 1, 3, 1);
    const flap = Math.sin(t * 22 + p.wing) > 0;
    ctx.fillStyle = "rgba(220,200,120,0.85)";
    if (flap) { ctx.fillRect(x - 1, y - 1, 2, 1); ctx.fillRect(x + 2, y - 1, 2, 1); }
    else { ctx.fillRect(x - 1, y, 2, 1); ctx.fillRect(x + 2, y, 2, 1); }
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
  const cx = e.pos.x - camX;
  const cy = e.pos.y - camY;
  const R = (e.data?.radius as number) ?? 60;
  const rNow = R * (1 - life * 0.7) + 6;
  ctx.save();
  ctx.globalAlpha = life * 0.55;
  const grd = ctx.createRadialGradient(cx, cy, rNow * 0.2, cx, cy, rNow);
  grd.addColorStop(0, "rgba(220,240,255,0.9)");
  grd.addColorStop(0.6, "rgba(140,180,220,0.5)");
  grd.addColorStop(1, "rgba(140,180,220,0)");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, rNow, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = life * 0.9;
  ctx.strokeStyle = "#eaf4ff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, rNow * 0.9, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = life;
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = rNow * (0.6 + 0.35 * ((i * 7) % 5) / 5);
    const sx = Math.round(cx + Math.cos(a) * rr);
    const sy = Math.round(cy + Math.sin(a) * rr);
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#b8d4ec";
    ctx.fillRect(sx - 1, sy - 1, 3, 3);
    ctx.fillStyle = "#4a6a90"; ctx.fillRect(sx, sy, 1, 1);
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
