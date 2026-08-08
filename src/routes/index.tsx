import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { MosesMenuSprite } from "@/components/MosesMenuSprite";
import menuDesert from "@/assets/menu-desert.png";

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

const MENU_CREAM = "#FEEFBE";

function PixelButton({
  children,
  variant = "primary",
  ...rest
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
} & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...rest}
      className={[
        "pixel-btn pixel-btn-press font-display uppercase",
        variant === "primary"
          ? "bg-[#e9c168] px-6 py-4 text-lg tracking-[0.18em] text-[#3a2412]"
          : "bg-[#f6e2ad] px-6 py-3 text-sm tracking-[0.16em] text-[#4a2f16]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

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
          ? "bg-[#e9c168] px-6 py-4 text-lg tracking-[0.18em] text-[#3a2412]"
          : "bg-[#f6e2ad] px-6 py-3 text-sm tracking-[0.16em] text-[#4a2f16]",
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
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: MENU_CREAM, touchAction: "pan-y" }}
    >
      {/* Layer 1 — pixel-art desert backdrop (pyramids, dunes, palms, rocks). */}
      <img
        src={menuDesert}
        alt=""
        aria-hidden
        width={1920}
        height={1088}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ imageRendering: "pixelated" }}
      />
      {/* Warm light wash so the UI reads cleanly over the art. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 25%, rgba(254,239,190,0.55) 0%, rgba(254,239,190,0.12) 45%, rgba(196,148,88,0.30) 100%)",
        }}
      />

      {/* Layer 2 — Moses, purely decorative, on his own absolute layer on the
          left so he can never overlap, push or re-centre the menu. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-10 hidden items-end md:flex lg:left-[4%] xl:left-[8%]"
        style={{ animation: "exodus-menu-float 4.5s ease-in-out infinite" }}
      >
        <MosesMenuSprite zoom={3} className="drop-shadow-[0_14px_16px_rgba(120,80,40,0.28)]" />
      </div>

      {/* Layer 3 — centered title + menu, independent of every other layer. */}
      <section className="relative z-20 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 py-14 text-center">
        <div className="flex flex-col items-center">
          <p className="font-pixel mb-3 text-xs uppercase tracking-[0.42em] text-[#8a5a2c]">
            A tale from the desert
          </p>
          <h1
            className="font-display text-4xl leading-[1.15] uppercase text-[#4a2c10] sm:text-5xl md:text-6xl"
            style={{ textShadow: `3px 3px 0 ${MENU_CREAM}, 6px 6px 0 rgba(122,80,38,0.35)` }}
          >
            Exodus
            <br />
            <span className="text-[#b5731f]">Survivors</span>
          </h1>
          <p className="font-pixel mt-6 max-w-sm text-base leading-relaxed text-[#6b4520]">
            Guide Moses across the shifting sands. Unleash the plagues, rally your kin, and see how
            long you can last.
          </p>

          <nav className="mt-10 flex w-full max-w-xs flex-col gap-3">
            <PixelLink to="/play" variant="primary">
              Play
            </PixelLink>
            <PixelLink to="/leaderboard">Leaderboard</PixelLink>
            <PixelLink to="/more-games">More Games</PixelLink>
            <PixelButton variant="ghost" onClick={() => setSettingsOpen(true)}>Settings</PixelButton>
          </nav>
        </div>

        {/* Mobile-only Moses: below the menu, still in its own container. */}
        <div
          aria-hidden
          className="pointer-events-none flex justify-center md:hidden"
          style={{ animation: "exodus-menu-float 4.5s ease-in-out infinite" }}
        >
          <MosesMenuSprite zoom={2} className="drop-shadow-[0_10px_12px_rgba(120,80,40,0.28)]" />
        </div>
      </section>

      <footer className="font-pixel absolute bottom-3 left-0 right-0 z-20 text-center text-xs text-[#8a5a2c]">
        v0.1 — an original desert bullet-heaven
      </footer>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}
