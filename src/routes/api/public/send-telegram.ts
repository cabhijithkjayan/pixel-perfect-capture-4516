import { createFileRoute } from "@tanstack/react-router";

type RequestBody = { message?: unknown; website?: unknown };

const requestTimes = new Map<string, number[]>();
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

type MediaKind = { method: string; field: string; label: string };

function mediaKindFor(file: File): MediaKind | null {
  const type = file.type.toLowerCase();
  if (type.startsWith("image/")) return { method: "sendPhoto", field: "photo", label: "Photo" };
  if (type.startsWith("video/")) return { method: "sendVideo", field: "video", label: "Video" };
  if (type.startsWith("audio/"))
    return { method: "sendVoice", field: "voice", label: "Voice note" };
  return { method: "sendDocument", field: "document", label: "File" };
}

export const Route = createFileRoute("/api/public/send-telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        const isNudge = request.headers.get("x-message-mode") === "nudge";
        const now = Date.now();
        const limitKey = `${ip}:${isNudge ? "nudge" : "single"}`;
        const windowMs = isNudge ? 120_000 : 60_000;
        const requestLimit = isNudge ? 20 : 5;
        const recent = (requestTimes.get(limitKey) ?? []).filter((time) => now - time < windowMs);
        if (recent.length >= requestLimit) {
          return Response.json(
            { ok: false, error: "Too many messages. Please wait a minute and try again." },
            { status: 429 },
          );
        }

        const contentType = request.headers.get("content-type") ?? "";
        let message = "";
        let file: File | null = null;

        if (contentType.includes("multipart/form-data")) {
          let form: FormData;
          try {
            form = await request.formData();
          } catch {
            return Response.json(
              { ok: false, error: "Please enter a valid message." },
              { status: 400 },
            );
          }
          if (form.get("website")) return Response.json({ ok: true });
          const rawMessage = form.get("message");
          message = typeof rawMessage === "string" ? rawMessage.trim() : "";
          const rawFile = form.get("file");
          file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
        } else {
          let body: RequestBody;
          try {
            body = (await request.json()) as RequestBody;
          } catch {
            return Response.json(
              { ok: false, error: "Please enter a valid message." },
              { status: 400 },
            );
          }
          if (body.website) return Response.json({ ok: true });
          message = typeof body.message === "string" ? body.message.trim() : "";
        }

        if (message.length > 1000) {
          return Response.json(
            { ok: false, error: "Please enter a message of 1,000 characters or fewer." },
            { status: 400 },
          );
        }
        if (!message && !file) {
          return Response.json(
            { ok: false, error: "Please enter a message or attach a file." },
            { status: 400 },
          );
        }

        let media: MediaKind | null = null;
        if (file) {
          media = mediaKindFor(file);
          if (!media) {
            return Response.json(
              { ok: false, error: "Please attach a photo, video, or voice note." },
              { status: 400 },
            );
          }
          if (file.size > MAX_FILE_BYTES) {
            return Response.json(
              { ok: false, error: "That file is too large. Please keep it under 20 MB." },
              { status: 400 },
            );
          }
        }

        const appKey = process.env["LOVABLE_API_KEY"];
        const telegramKey = process.env["TELEGRAM_API_KEY"];
        const channelId = process.env["TELEGRAM_CHAT_ID"];
        if (!appKey || !telegramKey || !channelId) {
          console.error("Telegram sender is missing a required server setting.");
          return Response.json(
            { ok: false, error: "Sending is not set up yet. Please try again later." },
            { status: 503 },
          );
        }

        const authHeaders = {
          Authorization: `Bearer ${appKey}`,
          "X-Connection-Api-Key": telegramKey,
        };

        requestTimes.set(limitKey, [...recent, now]);
        try {
          let result: Response;
          if (file && media) {
            const form = new FormData();
            form.set("chat_id", channelId);
            if (message) form.set("caption", message);
            form.set(media.field, file, file.name || "upload");
            result = await fetch(`https://connector-gateway.lovable.dev/telegram/${media.method}`, {
              method: "POST",
              headers: authHeaders,
              body: form,
            });
          } else {
            result = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
              method: "POST",
              headers: { ...authHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: channelId,
                text: message,
                disable_web_page_preview: true,
              }),
            });
          }
          if (!result.ok) {
            const providerError = await result.text();
            console.error(`Telegram send failed [${result.status}]: ${providerError}`);
            return Response.json(
              { ok: false, error: "We couldn't send your message. Please try again." },
              { status: 502 },
            );
          }
          const resultBody = (await result.json()) as { ok?: boolean; description?: string };
          if (!resultBody.ok) {
            console.error(
              `Telegram send failed: ${resultBody.description ?? "Unknown provider error"}`,
            );
            return Response.json(
              { ok: false, error: "We couldn't send your message. Please try again." },
              { status: 502 },
            );
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Telegram send request failed.", error);
          return Response.json(
            { ok: false, error: "We couldn't send your message. Please try again." },
            { status: 502 },
          );
        }
      },
    },
  },
});
