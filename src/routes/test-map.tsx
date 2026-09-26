import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/game/GameCanvas";
import { PixelIcon, HOME_ART, GEAR_ART } from "@/components/PixelIcon";
import { PixelModal, PixelActionButton, GameSettingsDialog } from "@/components/GameSettingsDialog";
import { enemySpriteUrl } from "@/components/testMapSprites";
import {
  TEST_ATTACK_ORDER,
  defaultTestMapConfig,
  testAttackName,
  testEnemyKinds,
  testEnemyLabel,
} from "@/game/testMap";
import type { TestMapConfig } from "@/game/types";

export const Route = createFileRoute("/test-map")({
  beforeLoad: () => {
    // The sandbox is intentionally absent from public play, including direct URLs.
    if (!import.meta.env.DEV) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Test Map — Exodus Survivors" },
      {
        name: "description",
        content: "A sandbox arena for Exodus Survivors: choose which plagues, enemies and Pharaoh phase are active.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Test Map — Exodus Survivors" },
      { property: "og:description", content: "Development-only sandbox for Exodus Survivors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TestMapPage,
});

const RAMSES_LEVELS: Array<{ level: 1 | 2 | 3 | 4; label: string }> = [
  { level: 1, label: "1 · Throne" },
  { level: 2, label: "2 · Walk + Staff" },
  { level: 3, label: "3 · Jump Attack" },
  { level: 4, label: "4 · Chariot" },
];

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "pixel-btn pixel-btn-press font-display px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em]",
        active ? "bg-[#e9c168] text-[#3a2412]" : "bg-[#f6e2ad] text-[#7a5a30]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ConfigScreen({ onStart }: { onStart: (cfg: TestMapConfig) => void }) {
  const [cfg, setCfg] = useState<TestMapConfig>(() => defaultTestMapConfig());
  const kinds = testEnemyKinds();

  const toggle = (kind: string) =>
    setCfg((c) => ({ ...c, enemies: { ...c.enemies, [kind]: !c.enemies[kind] } }));

  const setAll = (on: boolean) =>
    setCfg((c) => {
      const enemies: Record<string, boolean> = {};
      for (const k of kinds) enemies[k] = on;
      return { ...c, enemies };
    });

  return (
    <main className="min-h-screen bg-[#FEEFBE] px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="font-display mb-1 text-center text-2xl uppercase tracking-[0.14em] text-[#4a2c10]">
          Test Map
        </h1>
        <p className="font-pixel mb-6 text-center text-xs uppercase tracking-[0.18em] text-[#8a5a2c]">
          Choose the powers and foes for this sandbox run
        </p>

        {/* Attacks */}
        <section className="pixel-panel mb-5 bg-[#f6e2ad] p-5">
          <h2 className="font-display mb-3 text-sm uppercase tracking-[0.16em] text-[#4a2c10]">
            Maximum Plague Attack
          </h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <Chip active={cfg.maxAttackIndex < 0} onClick={() => setCfg((c) => ({ ...c, maxAttackIndex: -1 }))}>
              Staff only
            </Chip>
            {TEST_ATTACK_ORDER.map((_, i) => (
              <Chip key={i} active={cfg.maxAttackIndex === i} onClick={() => setCfg((c) => ({ ...c, maxAttackIndex: i }))}>
                {i}
              </Chip>
            ))}
          </div>
          <p className="font-pixel text-[11px] leading-relaxed text-[#7a5a30]">
            {cfg.maxAttackIndex < 0
              ? "Only Moses' staff strike."
              : `Everything up to ${cfg.maxAttackIndex} — ${testAttackName(cfg.maxAttackIndex)}.`}
          </p>
        </section>

        {/* Enemies */}
        <section className="pixel-panel mb-5 bg-[#f6e2ad] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-sm uppercase tracking-[0.16em] text-[#4a2c10]">Enemies</h2>
            <div className="flex gap-2">
              <Chip active={false} onClick={() => setAll(true)}>All on</Chip>
              <Chip active={false} onClick={() => setAll(false)}>All off</Chip>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {kinds.map((k) => {
              const url = enemySpriteUrl(k);
              const on = cfg.enemies[k] === true;
              return (
                <button
                  key={k}
                  onClick={() => toggle(k)}
                  className={[
                    "pixel-btn pixel-btn-press flex items-center gap-2 px-2 py-2 text-left",
                    on ? "bg-[#e9c168]" : "bg-[#efdcae] opacity-70",
                  ].join(" ")}
                >
                  <span className="flex h-12 w-9 shrink-0 items-end justify-center">
                    {url ? (
                      <img
                        src={url}
                        alt=""
                        aria-hidden
                        className="max-h-12 w-auto"
                        style={{ imageRendering: "pixelated" }}
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-pixel block truncate text-[11px] uppercase tracking-wider text-[#4a2f16]">
                      {testEnemyLabel(k)}
                    </span>
                    <span className="font-display block text-[10px] uppercase tracking-[0.16em] text-[#7a5a30]">
                      {on ? "On" : "Off"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Ramses */}
        <section className="pixel-panel mb-6 bg-[#f6e2ad] p-5">
          <div className="mb-3 flex items-center gap-3">
            {enemySpriteUrl("ramses") && (
              <img
                src={enemySpriteUrl("ramses")}
                alt=""
                aria-hidden
                className="h-14 w-auto"
                style={{ imageRendering: "pixelated" }}
              />
            )}
            <h2 className="font-display flex-1 text-sm uppercase tracking-[0.16em] text-[#4a2c10]">Ramses</h2>
            <Chip active={cfg.ramses} onClick={() => setCfg((c) => ({ ...c, ramses: !c.ramses }))}>
              {cfg.ramses ? "On" : "Off"}
            </Chip>
          </div>
          {cfg.ramses && (
            <div className="flex flex-wrap gap-2">
              {RAMSES_LEVELS.map((r) => (
                <Chip
                  key={r.level}
                  active={cfg.ramsesLevel === r.level}
                  onClick={() => setCfg((c) => ({ ...c, ramsesLevel: r.level }))}
                >
                  {r.label}
                </Chip>
              ))}
            </div>
          )}
        </section>

        <div className="mx-auto max-w-xs space-y-3">
          <PixelActionButton variant="primary" onClick={() => onStart(cfg)}>
            Start test map
          </PixelActionButton>
        </div>
      </div>
    </main>
  );
}

function TestMapPage() {
  const [cfg, setCfg] = useState<TestMapConfig | null>(null);
  const [paused, setPaused] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameOver, setGameOver] = useState<null | { level: number; survivalSeconds: number; kills: number }>(null);
  const navigate = useNavigate();

  // Keep the arena at its intended scale, exactly as the normal play route does.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "_", "0"].includes(e.key)) e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!cfg) return <ConfigScreen onStart={(c) => setCfg(c)} />;

  return (
    <main className="fixed inset-0 flex flex-col bg-background" style={{ touchAction: "none" }}>
      <div className="relative flex-1">
        <GameCanvas
          testConfig={cfg}
          paused={paused || homeOpen || settingsOpen}
          onTogglePause={() => setPaused((p) => !p)}
          onGameOver={(info) => setGameOver(info)}
        />

        <div className="absolute left-3 top-3 z-20">
          <button
            aria-label="Return to home menu"
            title="Return to home menu"
            onClick={() => setHomeOpen(true)}
            className="pixel-btn pixel-btn-press flex h-11 w-11 items-center justify-center bg-[#f6e2ad] p-0"
          >
            <PixelIcon art={HOME_ART} size={24} />
          </button>
        </div>
        <div className="absolute right-3 top-3 z-20">
          <button
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
            className="pixel-btn pixel-btn-press flex h-11 w-11 items-center justify-center bg-[#f6e2ad] p-0"
          >
            <PixelIcon art={GEAR_ART} size={24} />
          </button>
        </div>

        <PixelModal open={homeOpen} onClose={() => setHomeOpen(false)} title="Leave Test Map?">
          <p className="font-pixel mb-5 text-center text-sm text-[#6b4520]">This test run will be lost.</p>
          <div className="flex gap-3">
            <PixelActionButton onClick={() => setHomeOpen(false)}>Cancel</PixelActionButton>
            <PixelActionButton variant="primary" onClick={() => navigate({ to: "/" })}>
              Return to Home
            </PixelActionButton>
          </div>
        </PixelModal>

        <GameSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>

      {gameOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(30,18,8,0.75)] p-3">
          <div
            className="pixel-panel w-[92%] max-w-md bg-[#FEEFBE] p-6 text-center"
            style={{ boxShadow: "0 6px 0 0 rgba(58,36,18,0.75)" }}
          >
            <h2 className="font-display mb-1 text-2xl uppercase tracking-[0.1em] text-[#7a3d16]">Test run ended</h2>
            <p className="font-pixel mb-5 text-sm text-[#8a5a2c]">
              Level {gameOver.level} · {Math.floor(gameOver.survivalSeconds)}s · {gameOver.kills} kills
            </p>
            <div className="space-y-3">
              <PixelActionButton
                variant="primary"
                onClick={() => {
                  setGameOver(null);
                  setCfg(null);
                }}
              >
                Change setup
              </PixelActionButton>
              <PixelActionButton onClick={() => navigate({ to: "/" })}>Home</PixelActionButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
