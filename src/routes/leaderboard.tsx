import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "@/lib/leaderboard";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Exodus Survivors" },
      { name: "description", content: "Top 100 survivors of the desert. See who has outlasted the plagues." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLeaderboard(100),
  });

  return (
    <main className="min-h-screen bg-desert-gradient px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Menu</Link>
          <Link to="/play" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
            Play
          </Link>
        </div>
        <h1 className="font-display text-4xl text-primary text-glow-gold">Leaderboard</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">The 100 greatest survivors of the plagues.</p>

        <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur">
          {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading scores…</div>}
          {error && <div className="p-6 text-center text-sm text-destructive">Couldn't load the leaderboard.</div>}
          {data && data.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No survivors yet. Be the first — <Link to="/play" className="underline text-primary">play now</Link>.
            </div>
          )}
          {data && data.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-right">Level</th>
                  <th className="px-4 py-3 text-right">Time</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.id} className="border-t border-border/60 hover:bg-secondary/40">
                    <td className="px-4 py-2 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-semibold">{row.player_name}</td>
                    <td className="px-4 py-2 text-right">{row.level}</td>
                    <td className="px-4 py-2 text-right">{formatTime(row.survival_seconds)}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
