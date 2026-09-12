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
  const [fadeIn, setFadeIn] = useState(true);
  const [gameOver, setGameOver] = useState<null | { level: number; survivalSeconds: number; kills: number }>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [homeOpen, setHomeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();


  // The intro fade runs from the first painted frame; this clears the overlay
  // afterwards even if the animation completes before hydration attaches.
  useEffect(() => {
    const t = window.setTimeout(() => setFadeIn(false), 520);
    return () => window.clearTimeout(t);
  }, []);

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

        {fadeIn && (
          <div
            data-testid="play-fade-in"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-40 bg-black"
            style={{ animation: "exodus-play-fade-in 500ms linear forwards" }}
            onAnimationEnd={() => setFadeIn(false)}
          />
        )}

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
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(30,18,8,0.75)] p-3">
          <div
            className="pixel-panel w-[92%] max-w-md bg-[#FEEFBE] p-6 text-center"
            style={{ boxShadow: "0 6px 0 0 rgba(58,36,18,0.75)" }}
          >
            <h2 className="mb-1 font-display text-2xl uppercase tracking-[0.1em] text-[#7a3d16]">Your journey ends</h2>
            <p className="font-pixel mb-5 text-sm text-[#8a5a2c]">The desert claims all in time.</p>
            <div className="mb-5 grid grid-cols-3 gap-2 text-center">
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
                  placeholder="ENTER YOUR NAME"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  className="font-pixel w-full border-[3px] border-[#3a2412] bg-[#f6e2ad] px-3 py-2 text-sm uppercase text-[#4a2f16] placeholder:text-[#a5824f] focus:outline-none"
                />
                {submitError && <p className="font-pixel text-xs text-[#a12b2b]">{submitError}</p>}
                <PixelActionButton type="submit" variant="primary" disabled={submitting || !name.trim()}>
                  {submitting ? "Submitting…" : "Submit score"}
                </PixelActionButton>
              </form>
            ) : (
              <p className="font-pixel text-sm uppercase tracking-wider text-[#7a3d16]">Score submitted!</p>
            )}
            <div className="mt-4 flex gap-3">
              <PixelActionButton onClick={() => window.location.reload()}>Retry</PixelActionButton>
              <PixelActionButton onClick={() => navigate({ to: "/leaderboard" })}>Scores</PixelActionButton>
            </div>
            <div className="mt-3">
              <PixelActionButton onClick={() => navigate({ to: "/" })}>Home</PixelActionButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-[3px] border-[#3a2412] bg-[#f6e2ad] px-2 py-2">
      <div className="font-display text-sm text-[#4a2c10]">{value}</div>
      <div className="font-pixel text-[10px] uppercase tracking-widest text-[#8a5a2c]">{label}</div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
