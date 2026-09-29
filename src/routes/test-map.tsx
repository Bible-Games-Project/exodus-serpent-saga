import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { hasDevAccess } from "@/lib/devAccess";

// This module is loaded only in local development. In a public release the
// route has no test controls and rejects direct visits before rendering.
const DevTestMap = lazy(() => import("@/components/DevTestMap"));

export const Route = createFileRoute("/test-map")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !hasDevAccess()) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Test Map — Exodus Survivors" },
      { name: "description", content: "Development-only sandbox for Exodus Survivors." },
      { property: "og:title", content: "Test Map — Exodus Survivors" },
      { property: "og:description", content: "Development-only sandbox for Exodus Survivors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TestMapGate,
});
function TestMapGate() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(hasDevAccess()), []);
  return ok ? <Suspense fallback={null}><DevTestMap /></Suspense> : null;
}
