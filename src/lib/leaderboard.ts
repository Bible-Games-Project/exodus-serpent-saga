import { supabase } from "@/integrations/supabase/client";

export type LeaderboardRow = {
  id: string;
  player_name: string;
  level: number;
  survival_seconds: number;
  created_at: string;
};

export async function fetchLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("id, player_name, level, survival_seconds, created_at")
    .order("level", { ascending: false })
    .order("survival_seconds", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

export async function submitScore(input: {
  player_name: string;
  level: number;
  survival_seconds: number;
}): Promise<void> {
  const res = await fetch("/api/public/leaderboard/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
}
