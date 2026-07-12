import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsDialog } from "@/components/SettingsDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exodus Survivors — Survive the Plagues of Egypt" },
      {
        name: "description",
        content:
          "Play as Moses in a calm, painterly bullet-heaven set in Ancient Egypt. Unleash the plagues, gather companions, outlast the desert.",
      },
    ],
  }),
  component: MainMenu,
});

function MainMenu() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-desert-gradient">
      {/* Decorative distant pyramids silhouette */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full opacity-70"
        viewBox="0 0 1200 300"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="dune" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c69a6c" />
            <stop offset="100%" stopColor="#a17048" />
          </linearGradient>
        </defs>
        <polygon points="0,220 200,120 340,220" fill="#b98550" opacity="0.55" />
        <polygon points="260,220 480,90 700,220" fill="#a17048" opacity="0.7" />
        <polygon points="600,220 820,140 1040,220" fill="#b98550" opacity="0.55" />
        <path d="M0 220 C 300 260, 600 200, 900 240 S 1200 210, 1200 300 L 0 300 Z" fill="url(#dune)" />
      </svg>

      {/* Sun */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[10%] top-[12%] size-40 rounded-full"
        style={{
          background: "radial-gradient(circle, #ffe4a8 0%, #f2b26b 60%, transparent 75%)",
          filter: "blur(2px)",
        }}
      />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.35em] text-muted-foreground">A tale from the desert</p>
        <h1 className="text-glow-gold font-display text-5xl leading-tight text-primary sm:text-6xl md:text-7xl">
          EXODUS
          <br />
          <span className="text-foreground">SURVIVORS</span>
        </h1>
        <p className="mt-6 max-w-md text-sm text-muted-foreground sm:text-base">
          Guide Moses across the shifting sands. Unleash the plagues, rally your kin, and see how long you can last.
        </p>

        <nav className="mt-12 flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/play"
            className="rounded-xl bg-primary px-6 py-4 text-lg font-bold uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Play
          </Link>
          <Link
            to="/leaderboard"
            className="rounded-xl border border-border bg-card/70 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-foreground backdrop-blur transition hover:bg-card"
          >
            Leaderboard
          </Link>
          <Link
            to="/more-games"
            className="rounded-xl border border-border bg-card/70 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-foreground backdrop-blur transition hover:bg-card"
          >
            More Games
          </Link>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-xl border border-border bg-card/70 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-foreground backdrop-blur transition hover:bg-card"
          >
            Settings
          </button>
        </nav>

        <footer className="absolute bottom-4 left-0 right-0 text-center text-xs text-muted-foreground/80">
          v0.1 — an original desert bullet-heaven
        </footer>
      </section>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}
