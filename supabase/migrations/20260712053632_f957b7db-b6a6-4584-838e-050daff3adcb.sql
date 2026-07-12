
CREATE TABLE public.leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (char_length(player_name) BETWEEN 1 AND 24),
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 9999),
  survival_seconds INTEGER NOT NULL CHECK (survival_seconds >= 0 AND survival_seconds <= 86400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX leaderboard_rank_idx ON public.leaderboard (level DESC, survival_seconds DESC, created_at ASC);

GRANT SELECT, INSERT ON public.leaderboard TO anon;
GRANT SELECT, INSERT ON public.leaderboard TO authenticated;
GRANT ALL ON public.leaderboard TO service_role;

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard is publicly readable"
  ON public.leaderboard FOR SELECT
  USING (true);

CREATE POLICY "Anyone can submit a run"
  ON public.leaderboard FOR INSERT
  WITH CHECK (true);
