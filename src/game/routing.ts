// Central route-refresh scheduler. Every enemy and champion stores its own
// last-refresh timestamp; no code path may recompute a route (target choice +
// heading/obstacle probing) more often than ROUTE_MIN_INTERVAL seconds of game
// time. Per-frame steering toward the last chosen target is not a refresh.
export const ROUTE_MIN_INTERVAL = 0.4;

type RouteData = Record<string, unknown>;

/** Dev instrumentation: smallest observed interval and total refreshes. */
export const routeStats = { refreshes: 0, minInterval: Infinity };

export function canRefreshRoute(d: RouteData, now: number): boolean {
  const last = d.routeAt as number | undefined;
  return last == null || now - last >= ROUTE_MIN_INTERVAL;
}

/** Records a refresh; `jitter` staggers the next one so characters don't sync. */
export function markRouteRefresh(d: RouteData, now: number, jitter = 0): void {
  const last = d.routeAt as number | undefined;
  if (last != null) {
    routeStats.refreshes++;
    const iv = now - last;
    if (iv < routeStats.minInterval) routeStats.minInterval = iv;
  }
  // Storing a later timestamp pushes the next allowed refresh past 400 ms.
  d.routeAt = now + jitter;
}
