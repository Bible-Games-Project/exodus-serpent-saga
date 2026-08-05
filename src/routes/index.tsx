import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ backgroundColor: MENU_CREAM }}>
      {/* Pixel-art desert backdrop — pyramids, dunes, palms and rocks in a
          warm, near-monochromatic cream palette. */}
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

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-8 px-6 py-14 md:flex-row md:items-end md:justify-between">
        {/* Title + menu */}
        <div className="flex flex-col items-center text-center md:items-start md:pb-12 md:text-left">
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
            <PixelButton onClick={() => setSettingsOpen(true)}>Settings</PixelButton>
          </nav>
        </div>

        {/* Moses — the exact gameplay sprite, gently idling. */}
        <div
          className="relative flex shrink-0 items-end justify-center"
          style={{ animation: "exodus-menu-float 4.5s ease-in-out infinite" }}
        >
          <MosesMenuSprite zoom={2} className="drop-shadow-[0_10px_12px_rgba(120,80,40,0.28)] md:hidden" />
          <MosesMenuSprite zoom={3} className="hidden drop-shadow-[0_14px_16px_rgba(120,80,40,0.28)] md:block" />
        </div>
      </section>

      <footer className="font-pixel absolute bottom-3 left-0 right-0 z-10 text-center text-xs text-[#8a5a2c]">
        v0.1 — an original desert bullet-heaven
      </footer>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}
