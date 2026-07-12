
DROP POLICY IF EXISTS "Anyone can submit a run" ON public.leaderboard;
REVOKE INSERT ON public.leaderboard FROM anon;
REVOKE INSERT ON public.leaderboard FROM authenticated;
