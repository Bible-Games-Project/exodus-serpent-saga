import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameSettingsDialog } from "@/components/GameSettingsDialog";
import { PixelIcon, GEAR_ART } from "@/components/PixelIcon";
import cover from "@/assets/Fondo_Pantalla_Main_Menu.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exodus Survivors — Survive the Plagues of Egypt" },
      {
        name: "description",
        content:
          "Play as Moses in a calm, painterly bullet-heaven set in Ancient Egypt. Unleash the plagues, gather companions, outlast the desert.",
      },
      { property: "og:title", content: "Exodus Survivors — Survive the Plagues of Egypt" },
      {
        property: "og:description",
        content:
          "A pixel-art bullet-heaven in Ancient Egypt. Play as Moses, unleash the ten plagues, outlast the desert.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MainMenu,
});

function PixelLink({
  to,
  children,
  variant = "ghost",
}: {
  to: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  return (
    <Link
      to={to}
      className={[
        "pixel-btn pixel-btn-press font-display text-center uppercase",
        variant === "primary"
          ? "cover-button cover-button-primary px-8 py-3 text-lg"
          : "cover-button px-3 py-3 text-xs sm:text-sm",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function MainMenu() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Keep the title screen at its intended composition and scale: block
  // ctrl+wheel zoom, pinch-zoom and Safari zoom gestures while mounted.
  useEffect(() => {
    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey || ev.metaKey) ev.preventDefault();
    };
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ["+", "-", "=", "_", "0"].includes(ev.key)) ev.preventDefault();
    };
    const onGesture = (ev: Event) => ev.preventDefault();
    const onTouch = (ev: TouchEvent) => {
      if (ev.touches.length > 1) ev.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    document.addEventListener("gesturestart", onGesture as EventListener);
    document.addEventListener("gesturechange", onGesture as EventListener);
    document.addEventListener("gestureend", onGesture as EventListener);
    document.addEventListener("touchmove", onTouch as EventListener, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("gesturestart", onGesture as EventListener);
      document.removeEventListener("gesturechange", onGesture as EventListener);
      document.removeEventListener("gestureend", onGesture as EventListener);
      document.removeEventListener("touchmove", onTouch as EventListener);
    };
  }, []);

  return (
    <main className="cover-screen fixed inset-0 overflow-hidden">
      <img src={cover.url} alt="Exodus Survivors — Moses parts the sea" width={1920} height={1080} className="cover-bg" />
      <nav aria-label="Main menu" className="cover-menu">
        <div className="cover-play"><PixelLink to="/play" variant="primary">Play</PixelLink></div>
        <div className="cover-row">
          <PixelLink to="/leaderboard">Leaderboard</PixelLink>
          <PixelLink to="/more-games">More Games</PixelLink>
        </div>
      </nav>
      <button aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)} className="cover-gear cover-gear-btn pixel-btn-press absolute right-5 top-5 z-20 flex h-14 w-14 items-center justify-center p-0 sm:right-7 sm:top-7">
        <PixelIcon art={GEAR_ART} size={40} />
      </button>
      {import.meta.env.DEV && (
        <Link to="/test-map" className="pixel-btn pixel-btn-press absolute bottom-3 right-3 z-20 bg-secondary px-3 py-2 font-display text-[10px] uppercase text-secondary-foreground">Test Map</Link>
      )}
      <GameSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
