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
  push("shield", state.shieldUntil);

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

const PLAGUE_ICONS: Partial<Record<PlagueId, { emoji: string; bg: string }>> = {
  staff:     { emoji: "🪄", bg: "linear-gradient(135deg,#8a5a34,#c9a05a)" },
  serpent:   { emoji: "🐍", bg: "linear-gradient(135deg,#4d7a3e,#7fa96b)" },
  blood:     { emoji: "🩸", bg: "linear-gradient(135deg,#5a1a1a,#a12b2b)" },
  frogs:     { emoji: "🐸", bg: "linear-gradient(135deg,#2d5a3d,#5a8a5c)" },
  gnats:     { emoji: "🦟", bg: "linear-gradient(135deg,#2b1d14,#7a5a2a)" },
  flies:     { emoji: "🪰", bg: "linear-gradient(135deg,#2b1d14,#4a2c18)" },
  livestock: { emoji: "🐂", bg: "linear-gradient(135deg,#2d5a3d,#4d7a3e)" },
  boils:     { emoji: "🫧", bg: "linear-gradient(135deg,#4d3a5c,#8a6d9e)" },
  hail:      { emoji: "❄️", bg: "linear-gradient(135deg,#2b4a7a,#8ec8ff)" },
  fire:      { emoji: "🔥", bg: "linear-gradient(135deg,#5a1a1a,#e05a48)" },
  locusts:   { emoji: "🦗", bg: "linear-gradient(135deg,#4a2c18,#c9a05a)" },
  darkness:  { emoji: "🌑", bg: "linear-gradient(135deg,#0a0805,#2b1d14)" },
  firstborn: { emoji: "💀", bg: "linear-gradient(135deg,#2b1d14,#a17048)" },
  pillar:    { emoji: "🔆", bg: "linear-gradient(135deg,#c9700a,#e6c261)" },
  redsea:    { emoji: "🌊", bg: "linear-gradient(135deg,#0f1b3d,#3060c0)" },
};

const NPC_ICON: Record<NpcId, string> = {
  bithiah: "👸", aaron: "🧙", miriam: "🎶", jethro: "🧓",
  zipporah: "🌿", joshua: "🗡", hur: "🛡", elder: "📜",
};

const PASSIVE_ICON: Record<string, { emoji: string; bg: string }> = {
  maxHp:  { emoji: "❤️", bg: "linear-gradient(135deg,#a12b2b,#e05a48)" },
  speed:  { emoji: "👟", bg: "linear-gradient(135deg,#2b4a7a,#8ec8ff)" },
  damage: { emoji: "⚔️", bg: "linear-gradient(135deg,#5a1a1a,#c9700a)" },
  magnet: { emoji: "🧲", bg: "linear-gradient(135deg,#4d3a5c,#c04040)" },
};

function iconFor(c: UpgradeChoice): { emoji: string; bg: string } {
  if (c.npc) return { emoji: NPC_ICON[c.npc] ?? "✨", bg: "linear-gradient(135deg,#0f3460,#3b82f6)" };
  if (c.plague) return PLAGUE_ICONS[c.plague] ?? { emoji: "✨", bg: "linear-gradient(135deg,#4d3a5c,#8a6d9e)" };
  // passive — infer id from choice id "passive-<id>-..."
  const m = /^passive-([a-zA-Z]+)-/.exec(c.id);
  if (m && PASSIVE_ICON[m[1]]) return PASSIVE_ICON[m[1]];
  return { emoji: "✨", bg: "linear-gradient(135deg,#4d3a5c,#8a6d9e)" };
}

function LevelUpOverlay({ choices, onPick }: { choices: UpgradeChoice[]; onPick: (c: UpgradeChoice) => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="max-w-3xl w-[92%] rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="mb-1 text-center text-2xl">Level Up!</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">Choose your blessing</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {choices.map((c) => {
            const icon = iconFor(c);
            return (
              <button key={c.id} onClick={() => onPick(c)}
                className="group relative rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-1 hover:border-primary hover:bg-secondary">
                {c.isUnlock && (
                  <span className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow ${c.isCompanion ? "bg-sky-400 text-white" : "bg-yellow-400 text-black"}`} style={{ animation: "exodus-new-bounce 0.9s ease-in-out infinite" }}>
                    NEW
                  </span>
                )}
                <div className="mb-3 flex h-20 items-center justify-center rounded-lg text-4xl shadow-inner" style={{ background: icon.bg }}>
                  <span style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))" }}>{icon.emoji}</span>
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
  drawShepherdStaff(ctx, gripX, gripY, rot, facing, 62);
}

// Shared shepherd's-crook renderer: the grip sits at (gx, gy). The staff is a
// mostly-straight wooden shaft; only the upper ~20% curves in a soft S that
// ends in a small hooked tip — a classic shepherd's rod, never a "1" shape.
function drawShepherdStaff(ctx: CanvasRenderingContext2D, gx: number, gy: number, tiltRadians: number, facing: number, length: number) {
  const dirX = Math.cos(tiltRadians) * facing;
  const dirY = Math.sin(tiltRadians);
  const perpX = -dirY * facing;
  const perpY = dirX * facing;

  const buttLen = length * 0.25;
  const shaftLen = length * 0.80;
  const buttX = gx - dirX * buttLen;
  const buttY = gy - dirY * buttLen;
  const shaftTopX = gx + dirX * shaftLen;
  const shaftTopY = gy + dirY * shaftLen;

  ctx.save();
  ctx.lineCap = "round";
  const drawShaft = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.strokeStyle = "#2b1d10"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = "#b48355"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  drawShaft(buttX, buttY, shaftTopX, shaftTopY);

  // Upper S-curve crook (soft, small).
  const crookLen = length * 0.20;
  const bendAmt = length * 0.09;
  const c1X = shaftTopX + dirX * crookLen * 0.35 + perpX * bendAmt * 0.7;
  const c1Y = shaftTopY + dirY * crookLen * 0.35 + perpY * bendAmt * 0.7;
  const c2X = shaftTopX + dirX * crookLen * 0.55 - perpX * bendAmt * 0.2;
  const c2Y = shaftTopY + dirY * crookLen * 0.55 - perpY * bendAmt * 0.2;
  const endX = shaftTopX + dirX * crookLen * 0.55 - perpX * bendAmt * 1.4;
  const endY = shaftTopY + dirY * crookLen * 0.55 - perpY * bendAmt * 1.4;

  const drawCurve = (col: string, lw: number) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(shaftTopX, shaftTopY);
    ctx.bezierCurveTo(c1X, c1Y, c2X, c2Y, endX, endY);
    ctx.stroke();
  };
  drawCurve("#2b1d10", 6);
  drawCurve("#8a5a34", 4);
  drawCurve("#b48355", 2);

  ctx.fillStyle = "#5a3820";
  ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fill();
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

  // Egyptian sword-soldier — bronze helmet, linen kilt, khopesh curved sword.
  if (e.kind === "swordsoldier") {
    shadow(10); ctx.save();
    // legs
    ctx.fillStyle = "#4a2a14"; ctx.fillRect(x - 5, y + bob, 4, 8);
    ctx.fillRect(x + 1, y + bob, 4, 8);
    ctx.fillStyle = "#2b1a08"; ctx.fillRect(x - 5, y + 7 + bob, 4, 2);
    ctx.fillRect(x + 1, y + 7 + bob, 4, 2);
    // white kilt with red trim
    ctx.fillStyle = "#f4e2c1"; ctx.fillRect(x - 7, y - 4 + bob, 14, 6);
    ctx.fillStyle = "#a12b2b"; ctx.fillRect(x - 7, y + 1 + bob, 14, 1);
    // torso — copper-toned skin
    ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - 6, y - 14 + bob, 12, 10);
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(x - 6, y - 8 + bob, 12, 2); // belt shadow
    // face
    ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - 5, y - 22 + bob, 10, 8);
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 3, y - 18 + bob, 2, 1);
    ctx.fillRect(x + 1, y - 18 + bob, 2, 1);
    // bronze helmet
    ctx.fillStyle = "#b98550"; ctx.fillRect(x - 6, y - 26 + bob, 12, 6);
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 6, y - 26 + bob, 12, 2);
    ctx.fillStyle = "#7a5230"; ctx.fillRect(x - 6, y - 22 + bob, 12, 1);
    // shield on left arm (facing side)
    ctx.fillStyle = "#7a5230"; ctx.fillRect(x - flip * 8, y - 15 + bob, -flip * 3, 12);
    ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - flip * 8, y - 12 + bob, -flip * 3, 5);
    // khopesh — curved sickle-sword
    ctx.save();
    ctx.translate(x + flip * 8, y - 15 + bob);
    ctx.scale(flip, 1);
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -4, 12, 6); ctx.stroke();
    ctx.strokeStyle = "#dbe9f7"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -4, 12, 6); ctx.stroke();
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(-1, -1, 3, 4);
    ctx.restore();
    ctx.restore(); hpBar(); return true;
  }
  // Nubian archer — leather cap, linen tunic, quiver on back, recurve bow.
  if (e.kind === "archer") {
    shadow(9); ctx.save();
    // legs
    ctx.fillStyle = "#4a2a14"; ctx.fillRect(x - 4, y + bob, 3, 8); ctx.fillRect(x + 1, y + bob, 3, 8);
    // tunic
    ctx.fillStyle = "#d8b98a"; ctx.fillRect(x - 6, y - 12 + bob, 12, 12);
    ctx.fillStyle = "#a17048"; ctx.fillRect(x - 6, y - 4 + bob, 12, 2);
    // belt
    ctx.fillStyle = "#4a2a14"; ctx.fillRect(x - 6, y - 6 + bob, 12, 1);
    // face
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(x - 5, y - 20 + bob, 10, 8);
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 3, y - 16 + bob, 2, 1); ctx.fillRect(x + 1, y - 16 + bob, 2, 1);
    // leather cap
    ctx.fillStyle = "#4a2a14"; ctx.fillRect(x - 5, y - 24 + bob, 10, 5);
    ctx.fillStyle = "#7a4a2b"; ctx.fillRect(x - 5, y - 24 + bob, 10, 2);
    // quiver on back
    ctx.fillStyle = "#7a4a2b"; ctx.fillRect(x - flip * 7, y - 20 + bob, -flip * 3, 12);
    ctx.fillStyle = "#f4e2c1"; ctx.fillRect(x - flip * 7, y - 22 + bob, -flip * 3, 2);
    // recurve bow drawn on facing side
    ctx.save();
    ctx.translate(x + flip * 8, y - 12 + bob);
    ctx.scale(flip, 1);
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.quadraticCurveTo(9, -5, 6, 0); ctx.quadraticCurveTo(9, 5, 0, 10);
    ctx.stroke();
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.quadraticCurveTo(9, -5, 6, 0); ctx.quadraticCurveTo(9, 5, 0, 10);
    ctx.stroke();
    ctx.strokeStyle = "#f6efdc"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
    ctx.restore();
    ctx.restore(); hpBar(); return true;
  }
  // Mounted knight — white/tan horse with brown mane, spear-armed rider.
  if (e.kind === "knight") {
    shadow(18); ctx.save();
    // horse body
    ctx.fillStyle = "#d8b98a"; ctx.fillRect(x - 14, y - 10 + bob, 28, 10);
    ctx.fillStyle = "#a17048"; ctx.fillRect(x - 14, y - 3 + bob, 28, 3);
    // legs
    ctx.fillStyle = "#c99a6c";
    ctx.fillRect(x - 12, y + bob, 3, 9); ctx.fillRect(x - 6, y + bob, 3, 9);
    ctx.fillRect(x + 4, y + bob, 3, 9); ctx.fillRect(x + 10, y + bob, 3, 9);
    ctx.fillStyle = "#2b1d14";
    ctx.fillRect(x - 12, y + 8 + bob, 3, 2); ctx.fillRect(x - 6, y + 8 + bob, 3, 2);
    ctx.fillRect(x + 4, y + 8 + bob, 3, 2); ctx.fillRect(x + 10, y + 8 + bob, 3, 2);
    // head + neck
    ctx.fillStyle = "#d8b98a"; ctx.fillRect(x + flip * 12, y - 16 + bob, flip * 6, 4);
    ctx.fillRect(x + flip * 14, y - 20 + bob, flip * 5, 8);
    // mane
    ctx.fillStyle = "#7a4a2b"; ctx.fillRect(x + flip * 10, y - 14 + bob, flip * 4, 4);
    ctx.fillRect(x + flip * 8, y - 12 + bob, flip * 3, 3);
    // eye + mouth
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(x + flip * 17, y - 17 + bob, 1, 1);
    // rider — Egyptian officer
    ctx.fillStyle = "#a12b2b"; ctx.fillRect(x - 6, y - 22 + bob, 12, 10); // cloak
    ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - 4, y - 28 + bob, 8, 6); // face
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 2, y - 25 + bob, 1, 1); ctx.fillRect(x + 1, y - 25 + bob, 1, 1);
    ctx.fillStyle = "#b98550"; ctx.fillRect(x - 4, y - 32 + bob, 8, 5); // bronze helm
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 4, y - 32 + bob, 8, 2);
    // spear held up
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - flip * 2, y - 22 + bob); ctx.lineTo(x + flip * 22, y - 34 + bob); ctx.stroke();
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - flip * 2, y - 22 + bob); ctx.lineTo(x + flip * 22, y - 34 + bob); ctx.stroke();
    ctx.fillStyle = "#dbe9f7";
    ctx.beginPath();
    ctx.moveTo(x + flip * 22, y - 34 + bob);
    ctx.lineTo(x + flip * 26, y - 40 + bob);
    ctx.lineTo(x + flip * 24, y - 32 + bob);
    ctx.closePath(); ctx.fill();
    ctx.restore(); hpBar(); return true;
  }
  // Egyptian war chariot — two horses, spoked wheel, standing driver with reins.
  if (e.kind === "chariot") {
    shadow(22); ctx.save();
    // twin horse bodies (back + front stacked slightly)
    ctx.fillStyle = "#7a4a2b"; ctx.fillRect(x + flip * 4, y - 12 + bob, flip * 18, 8);
    ctx.fillStyle = "#4a2a14"; ctx.fillRect(x + flip * 4, y - 5 + bob, flip * 18, 3);
    // horse legs
    ctx.fillStyle = "#2b1a08";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + flip * (6 + i * 4), y + bob, 2, 8);
    // horse heads
    ctx.fillStyle = "#7a4a2b"; ctx.fillRect(x + flip * 20, y - 18 + bob, flip * 5, 8);
    ctx.fillStyle = "#4a2a14"; ctx.fillRect(x + flip * 20, y - 12 + bob, flip * 5, 2);
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x + flip * 22, y - 20 + bob, flip * 2, 2); // plume
    // reins
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + flip * 20, y - 12 + bob); ctx.lineTo(x - flip * 6, y - 18 + bob); ctx.stroke();
    // chariot cab (gold + blue Egyptian pattern)
    ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - flip * 16, y - 16 + bob, flip * 12, 14);
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x - flip * 16, y - 16 + bob, flip * 12, 3);
    ctx.fillStyle = "#3060c0"; ctx.fillRect(x - flip * 16, y - 12 + bob, flip * 12, 2);
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - flip * 16, y - 3 + bob, flip * 12, 2);
    // spoked wheel
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 2;
    const wx = x - flip * 10, wy = y + 4 + bob, wr = 8;
    ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); ctx.stroke();
    }
    ctx.fillStyle = "#e6c261"; ctx.fillRect(wx - 2, wy - 2, 4, 4);
    // driver
    ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - flip * 12, y - 30 + bob, 6, 5);
    ctx.fillStyle = "#3060c0"; ctx.fillRect(x - flip * 12, y - 25 + bob, 6, 10);
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x - flip * 12, y - 32 + bob, 6, 3); // nemes
    ctx.restore(); hpBar(); return true;
  }
  // Sorcerer/mage — dark hooded robe with glowing staff orb (Egyptian priest-magician).
  if (e.kind === "mage") {
    shadow(11); ctx.save();
    // robe base
    ctx.fillStyle = "#4d3a5c"; ctx.fillRect(x - 8, y - 24 + bob, 16, 20);
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 8, y - 6 + bob, 16, 3);
    ctx.fillStyle = "#8a6d9e"; ctx.fillRect(x - 8, y - 12 + bob, 16, 2);
    // hood + shadow face
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 7, y - 30 + bob, 14, 8);
    ctx.fillStyle = "#8a6d9e"; ctx.fillRect(x - 7, y - 30 + bob, 14, 2);
    ctx.fillStyle = "#ff4020"; ctx.fillRect(x - 3, y - 25 + bob, 2, 2); ctx.fillRect(x + 1, y - 25 + bob, 2, 2);
    // ankh amulet
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 1, y - 14 + bob, 2, 4);
    ctx.fillRect(x - 3, y - 12 + bob, 6, 1);
    // staff w/ orb
    ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + flip * 9, y - 26 + bob); ctx.lineTo(x + flip * 12, y + 8 + bob); ctx.stroke();
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + flip * 9, y - 26 + bob); ctx.lineTo(x + flip * 12, y + 8 + bob); ctx.stroke();
    ctx.fillStyle = "#c060ff"; ctx.beginPath(); ctx.arc(x + flip * 9, y - 28 + bob, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x + flip * 8, y - 30 + bob, 2, 0, Math.PI * 2); ctx.fill();
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
  // Desert wolf — layered fur tones, upright ears, tucked snout.
  if (e.kind === "wolf") {
    shadow(12); ctx.save();
    // body
    ctx.fillStyle = "#8a7a68"; ctx.fillRect(x - 12, y - 12 + bob, 24, 10);
    ctx.fillStyle = "#5a4a38"; ctx.fillRect(x - 12, y - 4 + bob, 24, 4);
    // fur tufts along back
    ctx.fillStyle = "#c9b090";
    ctx.fillRect(x - 10, y - 14 + bob, 3, 2);
    ctx.fillRect(x - 4, y - 14 + bob, 3, 2);
    ctx.fillRect(x + 3, y - 14 + bob, 3, 2);
    ctx.fillRect(x + 9, y - 13 + bob, 2, 2);
    // legs
    ctx.fillStyle = "#5a4a38";
    ctx.fillRect(x - 10, y + bob, 3, 7); ctx.fillRect(x - 3, y + bob, 3, 7);
    ctx.fillRect(x + 3, y + bob, 3, 7); ctx.fillRect(x + 8, y + bob, 3, 7);
    ctx.fillStyle = "#2b1d14";
    ctx.fillRect(x - 10, y + 6 + bob, 3, 1); ctx.fillRect(x - 3, y + 6 + bob, 3, 1);
    ctx.fillRect(x + 3, y + 6 + bob, 3, 1); ctx.fillRect(x + 8, y + 6 + bob, 3, 1);
    // head + snout
    ctx.fillStyle = "#8a7a68"; ctx.fillRect(x + flip * 10, y - 15 + bob, flip * 7, 7);
    ctx.fillStyle = "#c9b090"; ctx.fillRect(x + flip * 14, y - 12 + bob, flip * 4, 4); // snout
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(x + flip * 17, y - 11 + bob, 1, 1); // nose
    // ears (pointed triangles)
    ctx.fillStyle = "#5a4a38";
    ctx.fillRect(x + flip * 11, y - 18 + bob, flip * 2, 3);
    ctx.fillRect(x + flip * 14, y - 18 + bob, flip * 2, 3);
    // amber eye
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x + flip * 13, y - 13 + bob, 1, 1);
    // tail
    ctx.fillStyle = "#8a7a68"; ctx.fillRect(x - flip * 12, y - 13 + bob, -flip * 4, 3);
    ctx.fillStyle = "#c9b090"; ctx.fillRect(x - flip * 15, y - 12 + bob, -flip * 2, 2);
    ctx.restore(); hpBar(); return true;
  }
  // Desert lion — golden coat, thick tri-tone mane, dark tufted tail.
  if (e.kind === "lion") {
    shadow(15); ctx.save();
    // body
    ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 14, y - 12 + bob, 28, 12);
    ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 14, y - 4 + bob, 28, 4);
    ctx.fillStyle = "#8a5a20"; ctx.fillRect(x - 14, y - 1 + bob, 28, 2);
    // legs
    ctx.fillStyle = "#c9a05a";
    ctx.fillRect(x - 12, y + bob, 3, 8); ctx.fillRect(x - 4, y + bob, 3, 8);
    ctx.fillRect(x + 3, y + bob, 3, 8); ctx.fillRect(x + 10, y + bob, 3, 8);
    ctx.fillStyle = "#2b1d14";
    ctx.fillRect(x - 12, y + 7 + bob, 3, 2); ctx.fillRect(x - 4, y + 7 + bob, 3, 2);
    ctx.fillRect(x + 3, y + 7 + bob, 3, 2); ctx.fillRect(x + 10, y + 7 + bob, 3, 2);
    // mane — three tones, layered
    const maneX = x + flip * 14;
    const maneY = y - 12 + bob;
    ctx.fillStyle = "#5a3010";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(Math.round(maneX + Math.cos(a) * 9), Math.round(maneY + Math.sin(a) * 9), 3, 3);
    }
    ctx.fillStyle = "#8a5a20";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      ctx.fillRect(Math.round(maneX + Math.cos(a) * 6), Math.round(maneY + Math.sin(a) * 6), 3, 3);
    }
    // face
    ctx.fillStyle = "#e6c261"; ctx.fillRect(maneX - flip * 3, maneY - 3, flip * 8, 8);
    ctx.fillStyle = "#c9a05a"; ctx.fillRect(maneX + flip * 2, maneY + 2, flip * 4, 3); // muzzle
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(maneX + flip * 4, maneY + 3, 1, 1); // nose
    ctx.fillStyle = "#f6efdc"; ctx.fillRect(maneX + flip * 1, maneY - 1, 1, 1); // eye highlight
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(maneX + flip * 2, maneY - 1, 1, 1); // pupil
    // tail
    ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - flip * 13, y - 14 + bob, -flip * 3, 3);
    ctx.fillStyle = "#8a5a20"; ctx.fillRect(x - flip * 16, y - 13 + bob, -flip * 3, 4);
    ctx.fillStyle = "#5a3010"; ctx.fillRect(x - flip * 18, y - 11 + bob, -flip * 2, 3); // tail tuft
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
  const seated = !!d.seated;
  const flip = e.facing === -1 ? -1 : 1;
  const idleBob = Math.sin(s.now * 1.2) * 1.5;

  // shadow (bigger — Ramses is roughly twice a human)
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(x, y + 16, 28, 6, 0, 0, Math.PI * 2); ctx.fill();

  let bob = 0;
  if (phase === "airborne") {
    const t = 1 - Math.max(0, Math.min(1, (d.leapT as number) / 0.75));
    bob = -Math.sin(t * Math.PI) * 110;
  } else if (phase === "telegraph") {
    bob = -6 - Math.sin(s.now * 20) * 4;
  } else if (seated) {
    // seated on throne — very small breathing motion.
    bob = idleBob * 0.4;
  } else {
    bob = idleBob;
  }

  // ---- body (roughly 2x human height: ~70 tall) ----
  ctx.save();
  // Legs / kilt — white with gold trim
  ctx.fillStyle = "#f6efdc"; ctx.fillRect(x - 12, y - 14 + bob, 24, 20);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 12, y - 14 + bob, 24, 3);
  ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 12, y + 3 + bob, 24, 3);
  // gold vertical stripe center of kilt
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 2, y - 12 + bob, 4, 16);
  // Legs proper (below kilt)
  ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - 9, y + 6 + bob, 6, 10); ctx.fillRect(x + 3, y + 6 + bob, 6, 10);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 10, y + 14 + bob, 8, 2); ctx.fillRect(x + 2, y + 14 + bob, 8, 2); // anklets
  // Torso — bare copper skin with gold usekh collar
  ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - 12, y - 32 + bob, 24, 18);
  ctx.fillStyle = "#8a5a34"; ctx.fillRect(x - 12, y - 16 + bob, 24, 2);
  // Usekh collar (broad gold necklace)
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 12, y - 32 + bob, 24, 5);
  ctx.fillStyle = "#3060c0"; ctx.fillRect(x - 12, y - 30 + bob, 24, 2);
  ctx.fillStyle = "#a12b2b"; ctx.fillRect(x - 12, y - 28 + bob, 24, 1);
  // pectoral scarab
  ctx.fillStyle = "#3060c0"; ctx.fillRect(x - 3, y - 25 + bob, 6, 4);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 2, y - 24 + bob, 4, 2);

  // Neck
  ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - 5, y - 36 + bob, 10, 4);

  // ---- Head — 16x14 face ----
  ctx.fillStyle = "#c99a6c"; ctx.fillRect(x - 8, y - 50 + bob, 16, 14);
  // eye makeup (Egyptian kohl)
  ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 6, y - 44 + bob, 5, 2); ctx.fillRect(x + 1, y - 44 + bob, 5, 2);
  ctx.fillStyle = "#f6efdc"; ctx.fillRect(x - 5, y - 43 + bob, 3, 1); ctx.fillRect(x + 2, y - 43 + bob, 3, 1);
  ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 4, y - 43 + bob, 1, 1); ctx.fillRect(x + 3, y - 43 + bob, 1, 1);
  // pharaoh's beard
  ctx.fillStyle = "#4a2c18"; ctx.fillRect(x - 2, y - 36 + bob, 4, 6);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 2, y - 30 + bob, 4, 1);

  // ---- Nemes headdress (blue + gold striped) — flares outward at shoulders ----
  // Top crown of the nemes
  ctx.fillStyle = "#3060c0"; ctx.fillRect(x - 10, y - 58 + bob, 20, 10);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#e6c261" : "#3060c0";
    ctx.fillRect(x - 10 + i * 4, y - 58 + bob, 4, 10);
  }
  // Nemes side flaps
  ctx.fillStyle = "#3060c0"; ctx.fillRect(x - 13, y - 48 + bob, 3, 12); ctx.fillRect(x + 10, y - 48 + bob, 3, 12);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 13, y - 48 + bob, 3, 2); ctx.fillRect(x + 10, y - 48 + bob, 3, 2);
  ctx.fillRect(x - 13, y - 42 + bob, 3, 2); ctx.fillRect(x + 10, y - 42 + bob, 3, 2);
  // Front brow band
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 10, y - 50 + bob, 20, 3);
  // Uraeus (cobra) — rearing over brow
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 2, y - 63 + bob, 4, 5);
  ctx.fillStyle = "#a12b2b"; ctx.fillRect(x - 1, y - 62 + bob, 2, 2);
  ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 2, y - 58 + bob, 4, 1);

  // ---- Royal staff (was'-scepter with forked base) — held in front unless airborne ----
  if (phase !== "airborne") {
    const staffX = x + flip * 14;
    const topY = y - 62 + bob;
    const botY = y + 14 + bob;
    // shaft
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(staffX - 1, topY, 3, botY - topY);
    ctx.fillStyle = "#e6c261"; ctx.fillRect(staffX, topY + 2, 1, botY - topY - 4);
    ctx.fillStyle = "#c9a05a"; ctx.fillRect(staffX, topY + 4, 1, 6);
    // was-scepter head (stylized animal head)
    ctx.fillStyle = "#e6c261"; ctx.fillRect(staffX - 3, topY - 4, 8, 6);
    ctx.fillStyle = "#3060c0"; ctx.fillRect(staffX - 3, topY - 4, 8, 2);
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(staffX + 3, topY - 2, 1, 1); // eye
    // forked base
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(staffX - 3, botY - 2, 3, 3); ctx.fillRect(staffX + 1, botY - 2, 3, 3);
  }
  ctx.restore();

  // Land shockwave
  if (phase === "land") {
    const t = 1 - Math.max(0, Math.min(1, (d.leapT as number) / 0.4));
    const R = (d.landRadius as number) * (0.4 + t * 1.1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = "#f5d488"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y + 6, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#c9700a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 6, R * 0.75, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = R * (0.7 + Math.random() * 0.3);
      const dx = Math.round(x + Math.cos(a) * rr);
      const dy = Math.round(y + 6 + Math.sin(a) * rr * 0.5);
      ctx.fillStyle = i % 2 ? "#c9a06a" : "#e6c261";
      ctx.fillRect(dx - 1, dy - 1, 3, 3);
    }
    ctx.strokeStyle = "#3a1810"; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      ctx.beginPath(); ctx.moveTo(x, y + 6);
      const lx = x + Math.cos(a) * R * 0.85;
      const ly = y + 6 + Math.sin(a) * R * 0.85;
      ctx.lineTo(lx, ly); ctx.stroke();
    }
    ctx.restore();
  }

  // HP bar (visible when active only)
  if (d.active) {
    const bw = 72;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x - bw / 2 - 1, y - 74 + bob - 1, bw + 2, 6);
    ctx.fillStyle = "#5a1a1a"; ctx.fillRect(x - bw / 2, y - 74 + bob, bw, 4);
    ctx.fillStyle = "#e04030"; ctx.fillRect(x - bw / 2, y - 74 + bob, bw * Math.max(0, e.hp / e.maxHp), 4);
    ctx.fillStyle = "#ffdd80"; ctx.font = "700 11px Nunito, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("RAMSES", x, y - 78 + bob);
  }
}

// ---------------- Throne ----------------
function drawThrone(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number) {
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  ctx.save();
  // large shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(x, y + 28, 34, 7, 0, 0, Math.PI * 2); ctx.fill();

  // ---- base plinth (stepped) ----
  ctx.fillStyle = "#a17048"; ctx.fillRect(x - 30, y + 22, 60, 8);
  ctx.fillStyle = "#7a4a2b"; ctx.fillRect(x - 30, y + 28, 60, 3);
  ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 30, y + 22, 60, 2);

  // ---- seat block ----
  ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 26, y + 4, 52, 20);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 26, y + 4, 52, 3);
  ctx.fillStyle = "#8a5a20"; ctx.fillRect(x - 26, y + 20, 52, 3);
  // side hieroglyph panels (blue + red)
  ctx.fillStyle = "#3060c0"; ctx.fillRect(x - 24, y + 8, 48, 3);
  ctx.fillStyle = "#a12b2b"; ctx.fillRect(x - 24, y + 15, 48, 2);
  // hieroglyph symbols on front panel
  ctx.fillStyle = "#2b1d14";
  for (let i = 0; i < 4; i++) {
    const gx = x - 18 + i * 12;
    ctx.fillRect(gx, y + 12, 2, 3);
    ctx.fillRect(gx - 1, y + 15, 4, 1);
  }

  // ---- backrest — tall, rounded top ----
  ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 24, y - 52, 48, 56);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 24, y - 52, 48, 3);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 24, y - 46, 48, 2);
  // rounded corners hint
  ctx.fillStyle = "#a17048"; ctx.fillRect(x - 24, y - 52, 3, 3); ctx.fillRect(x + 21, y - 52, 3, 3);
  // Sun disk with rays at top center
  ctx.fillStyle = "#e6c261"; ctx.beginPath(); ctx.arc(x, y - 40, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c9700a"; ctx.beginPath(); ctx.arc(x, y - 40, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#e6c261"; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 9, y - 40 + Math.sin(a) * 9);
    ctx.lineTo(x + Math.cos(a) * 13, y - 40 + Math.sin(a) * 13);
    ctx.stroke();
  }
  // Vertical blue+gold striping on backrest sides
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#3060c0" : "#e6c261";
    ctx.fillRect(x - 24 + i * 2, y - 30, 2, 30);
    ctx.fillRect(x + 16 + i * 2, y - 30, 2, 30);
  }

  // ---- armrests: cobra-headed ----
  ctx.fillStyle = "#c9a05a"; ctx.fillRect(x - 30, y - 6, 6, 24); ctx.fillRect(x + 24, y - 6, 6, 24);
  ctx.fillStyle = "#e6c261"; ctx.fillRect(x - 30, y - 6, 6, 3); ctx.fillRect(x + 24, y - 6, 6, 3);
  // cobra heads on top of armrests
  const cobra = (cx: number) => {
    ctx.fillStyle = "#e6c261"; ctx.fillRect(cx - 3, y - 14, 6, 8);
    ctx.fillStyle = "#3060c0"; ctx.fillRect(cx - 3, y - 14, 6, 2);
    ctx.fillStyle = "#2b1d14"; ctx.fillRect(cx - 2, y - 10, 1, 1); ctx.fillRect(cx + 1, y - 10, 1, 1);
    ctx.fillStyle = "#a12b2b"; ctx.fillRect(cx - 1, y - 7, 2, 1);
  };
  cobra(x - 27); cobra(x + 27);

  // ---- legs (lion paws) ----
  ctx.fillStyle = "#8a5a20"; ctx.fillRect(x - 26, y + 24, 6, 6); ctx.fillRect(x + 20, y + 24, 6, 6);
  ctx.fillStyle = "#2b1d14"; ctx.fillRect(x - 26, y + 29, 6, 2); ctx.fillRect(x + 20, y + 29, 6, 2);
  ctx.restore();
}


// ---------------- staff swing effect ----------------
function drawStaffSwing(ctx: CanvasRenderingContext2D, e: Entity, s: GameState, camX: number, camY: number) {
  const facing = (e.data?.facing as number) ?? 1;
  const life = Math.max(0, Math.min(1, (e.ttl ?? 0) / 0.18));
  const progress = 1 - life;
  const startA = facing === 1 ? -Math.PI * 0.85 : Math.PI + Math.PI * 0.85;
  const endA   = facing === 1 ?  Math.PI * 0.35 : Math.PI - Math.PI * 0.35;
  const staffLen = 62;
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
  void BONUSES[kind]; // ensures import is used
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY) + Math.round(Math.sin(s.now * 3 + e.id) * 3);
  // 3× larger pixel art, no glowing halo.
  const px = 3;
  const draw = (grid: string[], palette: Record<string, string>, ox: number, oy: number) => {
    for (let ry = 0; ry < grid.length; ry++) {
      for (let rx = 0; rx < grid[ry].length; rx++) {
        const c = palette[grid[ry][rx]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x + (rx + ox) * px, y + (ry + oy) * px, px, px);
      }
    }
  };
  ctx.save();
  // soft ground shadow (subtle, not a glow)
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(x, y + 12, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (kind === "heart") {
    const H = [
      ".RR.RR.",
      "RHRRRHR",
      "RHRRRRR",
      "RRRRRRR",
      ".RRRRR.",
      "..RRR..",
      "...R...",
    ];
    draw(H, { R: "#ff3050", H: "#ffb0b8" }, -3, -3);
  } else if (kind === "magnet") {
    const M = [
      "RR...RR",
      "RR...RR",
      "RRW.WRR",
      "RRW.WRR",
      "SS...SS",
      "SS...SS",
    ];
    draw(M, { R: "#c02030", W: "#ffffff", S: "#a0a0a0" }, -3, -3);
  } else if (kind === "star") {
    const S = [
      "...Y...",
      "..YHY..",
      "YYYHYYY",
      ".YYYYY.",
      "..YHY..",
      ".Y...Y.",
    ];
    draw(S, { Y: "#ffd54a", H: "#fff8b0" }, -3, -3);
  } else if (kind === "lightning") {
    const L = [
      "..YYY.",
      ".YYY..",
      "YYY...",
      "WYYYY.",
      "...YY.",
      "..YY..",
      ".YY...",
      "YY....",
    ];
    draw(L, { Y: "#ffe040", W: "#fffbaa" }, -3, -4);
  } else if (kind === "shield") {
    // Egyptian round shield with cross emblem
    const D = [
      ".BBBBB.",
      "BWWWWWB",
      "BWCGCWB",
      "BWGGGWB",
      "BWCGCWB",
      "BWWWWWB",
      ".BBBBB.",
      "..BBB..",
    ];
    draw(D, { B: "#2b4a7a", W: "#dbe9f7", C: "#e6c261", G: "#8ec8ff" }, -3, -4);
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

// ---------------- Companions (per-NPC procedural renderer) ----------------
// Each companion has a distinct silhouette, colours and weapon. When their
// `attackT` counter is active, an extra weapon-swing pose is drawn overlaying
// the base body so the player sees the actual attack motion.
type CompanionStyle = {
  robe: string; robeShade: string;
  head: string;      // head cover colour
  headTop: string;   // highlight
  weapon: (ctx: CanvasRenderingContext2D, x: number, y: number, bob: number, flip: number, swing: number) => void;
};

const COMPANION_STYLES: Partial<Record<import("./types").NpcId, CompanionStyle>> = {
  bithiah: {
    robe: "#c9a05a", robeShade: "#8a5a20", head: "#3060c0", headTop: "#e6c261",
    weapon: (ctx, x, y, bob, flip, swing) => {
      // Reed staff — thin gold rod with lotus tip
      const angle = -0.3 + swing * 1.6;
      ctx.save();
      ctx.translate(x + flip * 6, y - 14 + bob);
      ctx.rotate(angle * flip);
      ctx.fillStyle = "#c9a05a"; ctx.fillRect(0, -1, 22, 2);
      ctx.fillStyle = "#e6c261"; ctx.beginPath(); ctx.arc(22, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
  },
  aaron: {
    robe: "#d06544", robeShade: "#8f3a26", head: "#f6efdc", headTop: "#e6c261",
    weapon: (ctx, x, y, bob, flip, swing) => {
      // Overhead staff swing (sacred rod)
      const angle = -1.4 + swing * 2.2;
      ctx.save();
      ctx.translate(x + flip * 4, y - 18 + bob);
      ctx.rotate(angle * flip);
      ctx.fillStyle = "#2b1d14"; ctx.fillRect(-2, -1, 28, 3);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(-2, 0, 28, 1);
      ctx.fillStyle = "#e6c261"; ctx.fillRect(24, -3, 4, 6);
      ctx.restore();
    },
  },
  miriam: {
    robe: "#d97e8c", robeShade: "#8a4753", head: "#f4e2c1", headTop: "#c9a05a",
    weapon: (ctx, x, y, bob, flip, _swing) => {
      // Water bowl — held forward, sloshing during attack
      const wobble = _swing > 0 ? Math.sin(_swing * 8) * 2 : 0;
      const bx = x + flip * 9;
      const by = y - 14 + bob;
      ctx.fillStyle = "#7a4a2b"; ctx.fillRect(bx - 4, by, 8, 5);
      ctx.fillStyle = "#3060c0"; ctx.fillRect(bx - 3, by + 1, 6, 3);
      ctx.fillStyle = "#8ec8ff"; ctx.fillRect(bx - 3, by + 1 + wobble, 6, 1);
      if (_swing > 0) {
        ctx.fillStyle = "#8ec8ff";
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(bx + flip * (4 + i * 3), by - 2 - i, 2, 2);
        }
      }
    },
  },
  jethro: {
    robe: "#8a6d9e", robeShade: "#4d3a5c", head: "#f6efdc", headTop: "#8a5a34",
    weapon: (ctx, x, y, bob, flip, swing) => {
      // Walking stick — curved, planted; slight raise on swing
      const angle = 0.15 - swing * 0.6;
      ctx.save();
      ctx.translate(x + flip * 8, y - 14 + bob);
      ctx.rotate(angle * flip);
      ctx.strokeStyle = "#2b1d14"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(3, -18, 8, -16); ctx.stroke();
      ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(3, -18, 8, -16); ctx.stroke();
      ctx.restore();
    },
  },
  zipporah: {
    robe: "#5a8a5c", robeShade: "#2d5a3d", head: "#a12b2b", headTop: "#e6c261",
    weapon: (ctx, x, y, bob, flip, swing) => {
      // Flint knife — quick chop
      const angle = -0.8 + swing * 1.8;
      ctx.save();
      ctx.translate(x + flip * 6, y - 12 + bob);
      ctx.rotate(angle * flip);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(0, -1, 4, 3);
      ctx.fillStyle = "#dbe9f7"; ctx.fillRect(4, -2, 10, 4);
      ctx.fillStyle = "#a0a0a0"; ctx.fillRect(4, -2, 10, 1);
      ctx.restore();
    },
  },
  joshua: {
    robe: "#3060c0", robeShade: "#0f1b3d", head: "#b98550", headTop: "#e6c261",
    weapon: (ctx, x, y, bob, flip, swing) => {
      // Spear — held level, thrust forward during swing
      const push = swing * 8;
      ctx.save();
      ctx.translate(x + flip * (6 + push), y - 14 + bob);
      ctx.scale(flip, 1);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(0, -1, 22, 2);
      ctx.fillStyle = "#4a2c18"; ctx.fillRect(0, 0, 22, 1);
      ctx.fillStyle = "#dbe9f7";
      ctx.beginPath();
      ctx.moveTo(22, -1); ctx.lineTo(30, -3); ctx.lineTo(30, 3); ctx.lineTo(22, 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#a0a0a0";
      ctx.beginPath();
      ctx.moveTo(22, -1); ctx.lineTo(30, -3); ctx.lineTo(30, 0); ctx.lineTo(22, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    },
  },
  hur: {
    robe: "#a12b2b", robeShade: "#5a1a1a", head: "#2b4a7a", headTop: "#e6c261",
    weapon: (ctx, x, y, bob, flip, swing) => {
      // Sword — overhead slash
      const angle = -1.3 + swing * 2.2;
      ctx.save();
      ctx.translate(x + flip * 6, y - 16 + bob);
      ctx.rotate(angle * flip);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(-1, 0, 3, 4); // hilt
      ctx.fillStyle = "#e6c261"; ctx.fillRect(-3, 4, 7, 2); // guard
      ctx.fillStyle = "#dbe9f7"; ctx.fillRect(-1, 6, 3, 18); // blade
      ctx.fillStyle = "#a0a0a0"; ctx.fillRect(-1, 6, 1, 18);
      ctx.restore();
    },
  },
  elder: {
    robe: "#4d3a5c", robeShade: "#2b1d14", head: "#f6efdc", headTop: "#c9a05a",
    weapon: (ctx, x, y, bob, flip, _swing) => {
      // Prayer scroll held forward with glow on attack
      const bx = x + flip * 8;
      const by = y - 14 + bob;
      ctx.fillStyle = "#f4e2c1"; ctx.fillRect(bx - 3, by, 8, 8);
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(bx - 3, by, 8, 1);
      ctx.fillStyle = "#2b1d14";
      ctx.fillRect(bx - 1, by + 3, 4, 1); ctx.fillRect(bx - 1, by + 5, 4, 1);
      if (_swing > 0) {
        ctx.globalAlpha = _swing;
        ctx.fillStyle = "#fff8b0"; ctx.beginPath(); ctx.arc(bx + 2, by + 4, 6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    },
  },
};

function drawCompanion(ctx: CanvasRenderingContext2D, e: Entity, camX: number, camY: number, s: GameState): boolean {
  const style = COMPANION_STYLES[e.kind as import("./types").NpcId];
  if (!style) return false;
  const x = Math.round(e.pos.x - camX);
  const y = Math.round(e.pos.y - camY);
  const walking = Math.hypot(e.vel.x, e.vel.y) > 5 || Math.abs(Math.sin(e.animT)) > 0.4;
  const bob = walking ? Math.round(Math.sin(e.animT * 1.2) * 1.4) : 0;
  const flip = e.facing === -1 ? -1 : 1;
  const downed = e.data?.downedUntil != null;
  const attackT = (e.data?.attackT as number | undefined) ?? 0;
  const attackTMax = (e.data?.attackTMax as number | undefined) ?? 0.28;
  const swing = attackT > 0 ? 1 - attackT / attackTMax : 0; // 0..1 progress

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(x, y + 10, 12, 3, 0, 0, Math.PI * 2); ctx.fill();

  if (downed) {
    // Fallen — draw a small rotated body on the ground
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.translate(x, y + 4);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = style.robe; ctx.fillRect(-8, -6, 16, 12);
    ctx.fillStyle = style.robeShade; ctx.fillRect(-8, 0, 16, 6);
    ctx.fillStyle = style.head; ctx.fillRect(-4, -12, 8, 6);
    ctx.restore();
    ctx.fillStyle = "#f0e0a0"; ctx.font = "700 10px Nunito, sans-serif"; ctx.textAlign = "center";
    const remain = Math.max(0, Math.ceil((e.data!.downedUntil as number) - s.now));
    ctx.fillText(`${remain}s`, x, y - 4);
    return true;
  }

  ctx.save();
  // legs
  ctx.fillStyle = style.robeShade;
  ctx.fillRect(x - 4, y + bob, 3, 8); ctx.fillRect(x + 1, y + bob, 3, 8);
  ctx.fillStyle = "#2b1d14";
  ctx.fillRect(x - 4, y + 7 + bob, 3, 2); ctx.fillRect(x + 1, y + 7 + bob, 3, 2);
  // robe/torso
  ctx.fillStyle = style.robe; ctx.fillRect(x - 7, y - 14 + bob, 14, 18);
  ctx.fillStyle = style.robeShade; ctx.fillRect(x - 7, y - 6 + bob, 14, 3);
  ctx.fillRect(x - 7, y + 1 + bob, 14, 2);
  // trim band
  ctx.fillStyle = style.headTop; ctx.fillRect(x - 7, y - 14 + bob, 14, 2);
  // face (kept generic; head cover distinguishes)
  ctx.fillStyle = "#e6c39a"; ctx.fillRect(x - 5, y - 22 + bob, 10, 8);
  ctx.fillStyle = "#2b1d14";
  ctx.fillRect(x - 3, y - 18 + bob, 1, 1); ctx.fillRect(x + 2, y - 18 + bob, 1, 1);
  // head cover (silhouette differentiator)
  ctx.fillStyle = style.head; ctx.fillRect(x - 6, y - 26 + bob, 12, 6);
  ctx.fillStyle = style.headTop; ctx.fillRect(x - 6, y - 26 + bob, 12, 2);
  // side flaps for headdress feel
  ctx.fillStyle = style.head; ctx.fillRect(x - 7, y - 22 + bob, 2, 4); ctx.fillRect(x + 5, y - 22 + bob, 2, 4);
  ctx.restore();

  // Weapon — drawn on top; passes swing progress for attack pose
  style.weapon(ctx, x, y, bob, flip, swing);

  // ally HP bar
  const bw = 26;
  const bx = x - bw / 2;
  const by = y - 32;
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
  ctx.fillStyle = "#1e5a1e"; ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = "#4ec24e"; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);

  return true;
}

