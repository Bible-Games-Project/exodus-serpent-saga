// Developer-only features (Test Map) are available in local dev and on the
// editor preview hosts only (Lovable and the bgp-admin Cloudflare Pages
// preview). The published site never matches these hosts.
export function hasDevAccess(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h.startsWith("id-preview--") ||
    h.endsWith("-dev.lovable.app") ||
    h.endsWith(".lovableproject.com") ||
    h === "bgp-exodus-serpent-saga.pages.dev" ||
    h.endsWith(".bgp-exodus-serpent-saga.pages.dev")
  );
}
