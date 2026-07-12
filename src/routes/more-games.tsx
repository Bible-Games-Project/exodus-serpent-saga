import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/more-games")({
  head: () => ({
    meta: [
      { title: "More Games — Exodus Survivors" },
      { name: "description", content: "More original browser games from the same studio, coming soon." },
    ],
  }),
  component: MoreGamesPage,
});

function MoreGamesPage() {
  return (
    <main className="min-h-screen bg-desert-gradient px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Menu</Link>
        <h1 className="mt-4 font-display text-4xl text-primary text-glow-gold">More Games</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          More original games are in the making. This page will soon hold links to all of them.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 text-sm text-muted-foreground backdrop-blur"
            >
              Coming soon
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
