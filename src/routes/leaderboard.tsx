import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "@/lib/leaderboard";
import cover from "@/assets/Fondo_Pantalla_Main_Menu.png.asset.json";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Exodus Survivors" },
      { name: "description", content: "Top 100 survivors of the desert. See who has outlasted the plagues." },
      { property: "og:title", content: "Leaderboard — Exodus Survivors" },
      { property: "og:description", content: "Top 100 survivors of the desert. See who has outlasted the plagues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
    <main className="sub-screen px-4 py-8">
      <img src={cover.url} alt="" aria-hidden className="sub-bg" />
      <div className="relative mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="cover-button pixel-btn-press font-display uppercase">← Menu</Link>
          <Link to="/shop" className="cover-button cover-button-primary pixel-btn-press font-display uppercase" style={{ fontSize: 15 }}>Play</Link>
        </div>
        <h1 className="sub-title mt-6 text-center font-display text-4xl uppercase sm:text-5xl">Leaderboard</h1>
        <p className="sub-sub mt-3 text-center text-sm">The 100 greatest survivors of the plagues.</p>

        <div className="sub-panel mt-8 overflow-hidden">
          {isLoading && <div className="p-6 text-center text-sm">Loading scores…</div>}
          {error && <div className="p-6 text-center text-sm">Couldn't load the leaderboard.</div>}
          {data && data.length === 0 && (
            <div className="p-8 text-center text-sm">
              No survivors yet. Be the first — <Link to="/shop" className="underline">play now</Link>.
            </div>
          )}
          {data && data.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sub-head font-display text-xs uppercase">
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
                  <tr key={row.id} className="sub-row">
                    <td className="px-4 py-2 font-display">{i + 1}</td>
                    <td className="px-4 py-2 font-bold">{row.player_name}</td>
                    <td className="px-4 py-2 text-right">{row.level}</td>
                    <td className="px-4 py-2 text-right">{formatTime(row.survival_seconds)}</td>
                    <td className="px-4 py-2 text-right text-xs">{new Date(row.created_at).toLocaleDateString()}</td>
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
