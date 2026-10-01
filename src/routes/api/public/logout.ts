import { createFileRoute } from "@tanstack/react-router";
import { clearGateSession } from "@/lib/gate.functions";

export const Route = createFileRoute("/api/public/logout")({
  server: {
    handlers: {
      POST: async () => {
        await clearGateSession();
        return new Response(null, { status: 204 });
      },
    },
  },
});
