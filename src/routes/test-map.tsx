import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// This module is loaded only in local development. In a public release the
// route has no test controls and rejects direct visits before rendering.
const DevTestMap = import.meta.env.DEV
  ? lazy(() => import("@/components/DevTestMap"))
  : null;

export const Route = createFileRoute("/test-map")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
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
  component: () => DevTestMap ? <Suspense fallback={null}><DevTestMap /></Suspense> : null,
});