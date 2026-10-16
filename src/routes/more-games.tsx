import { createFileRoute, Link } from "@tanstack/react-router";
import cover from "@/assets/Fondo_Pantalla_Main_Menu.png.asset.json";

export const Route = createFileRoute("/more-games")({
  head: () => ({
    meta: [
      { title: "More Games — Exodus Survivors" },
      { name: "description", content: "More original browser games from the same studio, coming soon." },
      { property: "og:title", content: "More Games — Exodus Survivors" },
      { property: "og:description", content: "More original browser games from the same studio, coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MoreGamesPage,
});

function MoreGamesPage() {
  return (
    <main className="sub-screen px-4 py-8">
      <img src={cover.url} alt="" aria-hidden className="sub-bg" />
      <div className="relative mx-auto max-w-3xl">
        <Link to="/" className="cover-button pixel-btn-press font-display uppercase">← Menu</Link>
        <h1 className="sub-title mt-6 text-center font-display text-4xl uppercase sm:text-5xl">More Games</h1>
        <p className="sub-sub mt-3 text-center text-sm">More original games are in the making. Links coming soon.</p>
        <div className="sub-panel mt-8 grid gap-5 p-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="sub-slot flex h-32 items-center justify-center font-display text-sm uppercase">
              Coming soon
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
