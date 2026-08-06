import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/game/GameCanvas";
import { submitScore } from "@/lib/leaderboard";
import { PixelIcon, HOME_ART, GEAR_ART } from "@/components/PixelIcon";
import { PixelModal, PixelActionButton, GameSettingsDialog } from "@/components/GameSettingsDialog";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play — Exodus Survivors" },
      { name: "description", content: "Survive the plagues. Play Exodus Survivors right in your browser." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayPage,
});

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pixel-btn pixel-btn-press flex h-11 w-11 items-center justify-center bg-[#f6e2ad] p-0"
    >
      {children}
    </button>
  );
}

function PlayPage() {
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState<null | { level: number; survivalSeconds: number; kills: number }>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [homeOpen, setHomeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();

  // Keep the game at its intended scale: block ctrl+wheel zoom, pinch-zoom and
  // Safari zoom gestures while the play route is mounted.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    const onGesture = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "_", "0"].includes(e.key)) e.preventDefault();
    };
    const onTouch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouch, { passive: false });
    document.addEventListener("gesturestart", onGesture as EventListener);
    document.addEventListener("gesturechange", onGesture as EventListener);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouch);
      document.removeEventListener("gesturestart", onGesture as EventListener);
      document.removeEventListener("gesturechange", onGesture as EventListener);
    };
  }, []);

  return (
    <main className="fixed inset-0 flex flex-col bg-background" style={{ touchAction: "none" }}>
      <div className="relative flex-1">
        <GameCanvas
          paused={paused || homeOpen || settingsOpen}
          onTogglePause={() => setPaused((p) => !p)}
          onGameOver={(info) => setGameOver(info)}
        />

        {/* Corner controls */}
        <div className="absolute left-3 top-3 z-20">
          <IconButton label="Return to home menu" onClick={() => setHomeOpen(true)}>
            <PixelIcon art={HOME_ART} size={24} />
          </IconButton>
        </div>
        <div className="absolute right-3 top-3 z-20">
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <PixelIcon art={GEAR_ART} size={24} />
          </IconButton>
        </div>


        <PixelModal open={homeOpen} onClose={() => setHomeOpen(false)} title="Return to Home?">
          <p className="font-pixel mb-5 text-center text-sm text-[#6b4520]">Your current run will be lost.</p>
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
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-[92%] max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
            <h2 className="mb-1 font-display text-3xl text-primary">Your journey ends</h2>
            <p className="mb-6 text-sm text-muted-foreground">The desert claims all in time.</p>
            <div className="mb-6 grid grid-cols-3 gap-3 text-center">
              <Stat label="Level" value={gameOver.level} />
              <Stat label="Time" value={formatTime(gameOver.survivalSeconds)} />
              <Stat label="Kills" value={gameOver.kills} />
            </div>
            {!submitted ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  setSubmitting(true);
                  setSubmitError(null);
                  try {
                    await submitScore({
                      player_name: name.trim(),
                      level: gameOver.level,
                      survival_seconds: gameOver.survivalSeconds,
                    });
                    setSubmitted(true);
                  } catch (err) {
                    setSubmitError((err as Error).message);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {submitError && <p className="text-xs text-destructive">{submitError}</p>}
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit score"}
                </button>
              </form>
            ) : (
              <p className="text-sm text-primary">Score submitted!</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-secondary"
              >
                Play again
              </button>
              <button
                onClick={() => navigate({ to: "/leaderboard" })}
                className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-secondary"
              >
                Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
