import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock3, LoaderCircle, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type RecentMessage = { id: number; text: string; sentAt: Date };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Send a message | Telegram channel" },
      { name: "description", content: "Write and send a message to the Telegram channel." },
      { property: "og:title", content: "Send a message | Telegram channel" },
      { property: "og:description", content: "Write and send a message to the Telegram channel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const response = await fetch("/api/public/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, website }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "We couldn't send your message. Please try again.");
      }
      setRecentMessages((items) => [
        { id: Date.now(), text: trimmed, sentAt: new Date() },
        ...items,
      ].slice(0, 5));
      setMessage("");
      setWebsite("");
      toast.success("Sent ✓");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function onTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <main className="sender-backdrop min-h-screen px-4 py-12 sm:py-20">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MessageCircle aria-hidden="true" size={21} />
            </span>
            <span className="text-sm font-semibold text-foreground">CHANNEL NOTE</span>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-success" /> Connected
          </span>
        </header>

        <section aria-labelledby="page-title" className="rounded-lg border border-border bg-card px-5 py-7 shadow-sm sm:px-9 sm:py-9">
          <div className="mb-7">
            <p className="mb-2 text-sm font-medium text-primary">Telegram channel</p>
            <h1 id="page-title" className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">Send a message</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Compose your note and send it straight to the channel.</p>
          </div>

          <form onSubmit={(event) => void sendMessage(event)}>
            <label htmlFor="message" className="mb-2 block text-sm font-semibold text-foreground">Your message</label>
            <textarea
              ref={textareaRef}
              id="message"
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
              onKeyDown={onTextareaKeyDown}
              maxLength={1000}
              rows={4}
              placeholder="What would you like to share?"
              className="message-textarea w-full resize-y rounded-md border border-input bg-background px-4 py-3 text-base leading-6 text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              aria-describedby="message-count"
            />
            <input
              aria-hidden="true"
              autoComplete="off"
              className="pointer-events-none absolute -left-[9999px] h-px w-px opacity-0"
              name="website"
              tabIndex={-1}
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />

            <div className="mt-2 flex items-center justify-between">
              <span id="message-count" className="text-xs tabular-nums text-muted-foreground">{message.length} / 1,000</span>
              <span className="text-xs text-muted-foreground">Enter to send · Shift + Enter for a new line</span>
            </div>

            <Button type="submit" size="lg" disabled={!message.trim() || sending} className="mt-6 h-12 w-full text-base">
              {sending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {sending ? "Sending…" : "Send message"}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" size={15} />
            <span>Your message is sent securely.</span>
          </div>
        </section>

        <section aria-labelledby="recent-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="recent-title" className="text-lg font-semibold text-foreground">Recent messages</h2>
            {recentMessages.length > 0 && <span className="text-xs text-muted-foreground">This session</span>}
          </div>
          {recentMessages.length === 0 ? (
            <div className="flex items-center gap-3 border-t border-border py-5 text-sm text-muted-foreground">
              <Clock3 aria-hidden="true" size={17} />
              Messages you send will appear here.
            </div>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {recentMessages.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                  <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{item.text}</p>
                  <time className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground" dateTime={item.sentAt.toISOString()}>
                    {item.sentAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
