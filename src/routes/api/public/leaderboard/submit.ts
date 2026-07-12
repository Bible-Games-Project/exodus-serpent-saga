import { createFileRoute } from "@tanstack/react-router";

// Guest-friendly leaderboard submission endpoint. Anyone can post a score,
// but writes go through the server (admin key) with strict validation.
export const Route = createFileRoute("/api/public/leaderboard/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const b = body as { player_name?: unknown; level?: unknown; survival_seconds?: unknown };
        const name = typeof b.player_name === "string" ? b.player_name.trim().slice(0, 24) : "";
        const level = Number(b.level);
        const seconds = Number(b.survival_seconds);

        if (!name || !/^[\w\s\-\.']{1,24}$/.test(name)) {
          return new Response("Invalid name", { status: 400 });
        }
        if (!Number.isFinite(level) || level < 1 || level > 9999) {
          return new Response("Invalid level", { status: 400 });
        }
        if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) {
          return new Response("Invalid time", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("leaderboard").insert({
          player_name: name,
          level: Math.floor(level),
          survival_seconds: Math.floor(seconds),
        });
        if (error) {
          console.error("[leaderboard/submit]", error);
          return new Response("Server error", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
