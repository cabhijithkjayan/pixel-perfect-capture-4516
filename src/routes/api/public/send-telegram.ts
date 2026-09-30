import { createFileRoute } from "@tanstack/react-router";

type RequestBody = { message?: unknown; website?: unknown };

const requestTimes = new Map<string, number[]>();

export const Route = createFileRoute("/api/public/send-telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip")
          ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? "unknown";
        const now = Date.now();
        const recent = (requestTimes.get(ip) ?? []).filter((time) => now - time < 60_000);
        if (recent.length >= 5) {
          return Response.json({ ok: false, error: "Too many messages. Please wait a minute and try again." }, { status: 429 });
        }

        let body: RequestBody;
        try {
          body = await request.json() as RequestBody;
        } catch {
          return Response.json({ ok: false, error: "Please enter a valid message." }, { status: 400 });
        }
        if (body.website) return Response.json({ ok: true });

        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message || message.length > 1000) {
          return Response.json({ ok: false, error: "Please enter a message of 1,000 characters or fewer." }, { status: 400 });
        }

        const appKey = process.env["LOVABLE_API_KEY"];
        const telegramKey = process.env["TELEGRAM_API_KEY"];
        const channelId = process.env["TELEGRAM_CHAT_ID"];
        if (!appKey || !telegramKey || !channelId) {
          console.error("Telegram sender is missing a required server setting.");
          return Response.json({ ok: false, error: "Sending is not set up yet. Please try again later." }, { status: 503 });
        }

        requestTimes.set(ip, [...recent, now]);
        try {
          const result = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${appKey}`,
              "X-Connection-Api-Key": telegramKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ chat_id: channelId, text: message, disable_web_page_preview: true }),
          });
          if (!result.ok) {
            const providerError = await result.text();
            console.error(`Telegram send failed [${result.status}]: ${providerError}`);
            return Response.json({ ok: false, error: "We couldn't send your message. Please try again." }, { status: 502 });
          }
          const resultBody = await result.json() as { ok?: boolean; description?: string };
          if (!resultBody.ok) {
            console.error(`Telegram send failed: ${resultBody.description ?? "Unknown provider error"}`);
            return Response.json({ ok: false, error: "We couldn't send your message. Please try again." }, { status: 502 });
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Telegram send request failed.", error);
          return Response.json({ ok: false, error: "We couldn't send your message. Please try again." }, { status: 502 });
        }
      },
    },
  },
});