import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clock3,
  File as FileIcon,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Mic,
  Send,
  ShieldCheck,
  Siren,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { getAccessStatus, lockSite, unlockSite } from "@/lib/gate.functions";

type RecentMessage = { id: number; text: string; sentAt: Date };
type SendMode = "text" | "voice" | "image" | "file" | "nudge";

const modes: { value: SendMode; label: string; icon: typeof MessageCircle }[] = [
  { value: "text", label: "Text", icon: MessageCircle },
  { value: "voice", label: "Voice note", icon: Mic },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "file", label: "File", icon: FileIcon },
  { value: "nudge", label: "SOS nudge", icon: Siren },
];

const NUDGE_COUNT = 20;
const NUDGE_INTERVAL_MS = 5000;
const SECRET_LINK =
  "https://ontarioisp.lovable.app/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAdGRleAUrY9ZleHRuA2FlbQIxMQBwZG9mAmZkaWQWUPdwjWLu4W4rbaXB4yqiPtB7dxSp_XNydGMGYXBwX2lkDzEyNDAyNDU3NDI4NzQxNAABp2JueT16bs_Ki_tSuuG5mqr4fTYzlTponCe8mGKUzh-oAbdOJJ9qzQJCc6L7_aem_H9vakYFR4a81vba4zze10w";
const tiles = [
  { letter: "T", label: "Time", className: "tips-tile-time" },
  { letter: "I", label: "Ideas", className: "tips-tile-ideas" },
  { letter: "P", label: "Places", className: "tips-tile-places" },
  { letter: "S", label: "Saved", className: "tips-tile-saved" },
] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IOS TIPS" },
      { name: "description", content: "IOS TIPS, a private iOS-inspired space." },
      { property: "og:title", content: "IOS TIPS" },
      {
        property: "og:description",
        content: "IOS TIPS, a private iOS-inspired space.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => getAccessStatus(),
  component: Index,
});

function Index() {
  const initialAccess = Route.useLoaderData();
  const [unlocked, setUnlocked] = useState(initialAccess.unlocked);
  const [sequence, setSequence] = useState("");
  const [checking, setChecking] = useState(false);
  const [incorrect, setIncorrect] = useState(false);
  const exitLockSent = useRef(false);
  const logoTapCount = useRef(0);
  const unlock = useServerFn(unlockSite);
  const lock = useServerFn(lockSite);

  useEffect(() => {
    function lockOnExit() {
      if (!unlocked || exitLockSent.current) return;
      exitLockSent.current = true;
      setUnlocked(false);
      setSequence("");
      setIncorrect(false);

      const body = new Blob();
      if (!navigator.sendBeacon("/api/public/logout", body)) {
        void fetch("/api/public/logout", {
          method: "POST",
          body,
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => {});
      }
    }

    window.addEventListener("popstate", lockOnExit);
    window.addEventListener("pagehide", lockOnExit);
    return () => {
      window.removeEventListener("popstate", lockOnExit);
      window.removeEventListener("pagehide", lockOnExit);
    };
  }, [unlocked]);

  async function tapLetter(letter: string) {
    if (checking) return;
    setIncorrect(false);
    const next = sequence + letter;
    if (next.length < 4) {
      setSequence(next);
      return;
    }
    setChecking(true);
    try {
      const result = await unlock({ data: { sequence: next } });
      if (result.ok) {
        exitLockSent.current = false;
        setUnlocked(true);
      }
      else setIncorrect(true);
    } catch {
      setIncorrect(true);
    } finally {
      setSequence("");
      setChecking(false);
    }
  }

  function tapTile(letter: string) {
    if (letter === "S" && logoTapCount.current >= 5) {
      logoTapCount.current = 0;
      window.location.assign(SECRET_LINK);
      return;
    }
    logoTapCount.current = 0;
    void tapLetter(letter);
  }

  async function relock() {
    await lock();
    exitLockSent.current = false;
    setUnlocked(false);
    setSequence("");
    setIncorrect(false);
  }

  if (unlocked) return <Sender onLock={() => void relock()} />;

  return (
    <main className="tips-home dark min-h-screen px-6 pb-12 pt-10 sm:pt-16">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md flex-col">
        <header className="flex items-center justify-between border-b border-border/70 pb-5">
          <span className="text-xs font-bold uppercase text-muted-foreground">IOS TIPS</span>
          <LockKeyhole size={17} className="text-muted-foreground" aria-label="Private" />
        </header>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mb-12">
            <button
              type="button"
              className="tips-mark"
              aria-label="TIPS logo"
              onClick={() => { logoTapCount.current = Math.min(5, logoTapCount.current + 1); }}
            >
              <span aria-hidden="true">T</span>
              <span aria-hidden="true">I</span>
              <span aria-hidden="true">P</span>
              <span aria-hidden="true">S</span>
            </button>
            <p className="mt-8 text-xs font-semibold uppercase text-muted-foreground">Your space</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">IOS<br />TIPS</h1>
          </div>

          <div className="grid grid-cols-4 gap-4 sm:gap-6" aria-label="TIPS icons">
            {tiles.map(({ letter, label, className }) => (
              <div key={letter} className="min-w-0 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={letter}
                  disabled={checking}
                  onClick={() => tapTile(letter)}
                  className={`tips-tile ${className} mx-auto flex aspect-square h-auto w-full max-w-20 rounded-[20px] p-0 text-3xl font-semibold shadow-sm hover:brightness-95 active:scale-95 sm:text-4xl`}
                >{letter}</Button>
                <span className="mt-2 block text-xs font-medium text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex h-7 items-center justify-center gap-3" role="status" aria-live="polite">
            {checking ? <LoaderCircle size={18} className="animate-spin text-muted-foreground" /> : (
              <>
                <span className="sr-only">{incorrect ? "Try again" : `${sequence.length} of 4 selected`}</span>
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className={`size-2 rounded-full transition-colors ${incorrect ? "bg-destructive" : index < sequence.length ? "bg-primary" : "bg-border"}`} />
                ))}
              </>
            )}
          </div>
        </div>
        <footer className="border-t border-border/70 pt-5 text-center text-xs text-muted-foreground">Made for the little things that matter.</footer>
      </div>
    </main>
  );
}

function Sender({ onLock }: { onLock: () => void }) {
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<SendMode>("text");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedVoice, setRecordedVoice] = useState<Blob | null>(null);
  const [nudgeProgress, setNudgeProgress] = useState<number | null>(null);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const nudgeCancelled = useRef(false);

  useEffect(
    () => () => {
      nudgeCancelled.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

  function addRecent(text: string) {
    setRecentMessages((items) =>
      [{ id: Date.now(), text, sentAt: new Date() }, ...items].slice(0, 5),
    );
  }

  async function postMessage(
    payload: FormData | { message: string; website: string; nudge?: boolean },
    nudge = false,
  ) {
    const headers = new Headers();
    const isFormData = payload instanceof FormData;
    if (!isFormData) headers.set("Content-Type", "application/json");
    if (nudge) headers.set("X-Message-Mode", "nudge");
    const response = await fetch("/api/public/send-telegram", {
      method: "POST",
      headers,
      body: isFormData ? payload : JSON.stringify(payload),
    });
    const result = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "We couldn't send your message. Please try again.");
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await postMessage({ message: trimmed, website });
      addRecent(trimmed);
      setMessage("");
      setWebsite("");
      toast.success("Sent ✓");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We couldn't send your message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function sendAttachment(file: File) {
    const form = new FormData();
    form.set("file", file, file.name);
    form.set("message", message.trim());
    form.set("website", website);
    await postMessage(form);
    addRecent(
      `${mode === "voice" ? "Voice note" : mode === "image" ? "Image" : "File"}: ${file.name}`,
    );
    setMessage("");
    setWebsite("");
    setAttachment(null);
    setRecordedVoice(null);
    toast.success("Sent ✓");
  }

  async function submitAttachment() {
    const file = attachment;
    if (!file || sending) return;
    setSending(true);
    try {
      await sendAttachment(file);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We couldn't send your file. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice recording isn't supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/ogg;codecs=opus", "audio/mp4", "audio/webm;codecs=opus"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setRecordedVoice(
          new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" }),
        );
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordedVoice(null);
      setRecording(true);
    } catch {
      toast.error("Allow microphone access to record a voice note.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function sendRecordedVoice() {
    if (!recordedVoice || sending) return;
    const extension = recordedVoice.type.includes("mp4")
      ? "m4a"
      : recordedVoice.type.includes("ogg")
        ? "ogg"
        : "webm";
    const file = new File([recordedVoice], `voice-note-${Date.now()}.${extension}`, {
      type: recordedVoice.type,
    });
    setSending(true);
    try {
      await sendAttachment(file);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't send your voice note. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function sendNudge() {
    const trimmed = message.trim();
    if (!trimmed || nudgeProgress !== null || sending) return;
    nudgeCancelled.current = false;
    setNudgeProgress(0);
    let sent = 0;
    try {
      for (let index = 0; index < NUDGE_COUNT; index += 1) {
        if (nudgeCancelled.current) break;
        if (index > 0)
          await new Promise((resolve) => window.setTimeout(resolve, NUDGE_INTERVAL_MS));
        if (nudgeCancelled.current) break;
        await postMessage({ message: trimmed, website, nudge: true }, true);
        sent += 1;
        setNudgeProgress(sent);
      }
      if (sent > 0) addRecent(`${trimmed} (${sent} nudge messages)`);
      if (sent === NUDGE_COUNT) {
        setMessage("");
        setWebsite("");
        toast.success("SOS nudge sent.");
      } else if (sent > 0) {
        toast("Nudge stopped", { description: `${sent} of ${NUDGE_COUNT} messages were sent.` });
      }
    } catch (error) {
      toast.error(
        `Nudge stopped after ${sent} of ${NUDGE_COUNT}: ${error instanceof Error ? error.message : "Sending failed."}`,
      );
    } finally {
      setNudgeProgress(null);
    }
  }

  function chooseMode(nextMode: SendMode) {
    setMode(nextMode);
    setAttachment(null);
    setRecordedVoice(null);
  }

  function onTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      mode === "text" &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <main className="sender-backdrop dark min-h-screen px-4 py-12 sm:py-20">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onLock}
              aria-label="Back to TIPS"
              title="Back to TIPS"
              className="text-muted-foreground"
            >
              <ArrowLeft size={18} />
            </Button>
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MessageCircle aria-hidden="true" size={21} />
            </span>
            <span className="text-sm font-semibold text-foreground">IOS TIPS</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLock} aria-label="Lock app" title="Lock app" className="text-muted-foreground"><LockKeyhole size={17} /> Lock</Button>
        </header>

        <section
          aria-labelledby="page-title"
          className="rounded-lg border border-border bg-card px-5 py-7 shadow-sm sm:px-9 sm:py-9"
        >
          <div className="mb-7">
            <h1 id="page-title" className="text-2xl font-semibold tracking-normal text-foreground">
              What would you like to send?
            </h1>
          </div>

          <div
            role="tablist"
            aria-label="Message type"
            className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            {modes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                disabled={nudgeProgress !== null}
                onClick={() => chooseMode(value)}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${mode === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}
              >
                <Icon aria-hidden="true" size={17} />
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) =>
              mode === "text" ? void sendMessage(event) : event.preventDefault()
            }
          >
            <label htmlFor="message" className="mb-2 block text-sm font-semibold text-foreground">
              {mode === "nudge"
                ? "Message to repeat"
                : mode === "image" || mode === "file" || mode === "voice"
                  ? "Caption (optional)"
                  : "Your message"}
            </label>
            <textarea
              ref={textareaRef}
              id="message"
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
              onKeyDown={onTextareaKeyDown}
              maxLength={1000}
              rows={4}
              placeholder={
                mode === "nudge"
                  ? "Write the message to send 20 times"
                  : mode === "image" || mode === "file" || mode === "voice"
                    ? "Add a caption"
                    : "What would you like to share?"
              }
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

            <div className="mt-2 flex items-center justify-between gap-3">
              <span id="message-count" className="text-xs tabular-nums text-muted-foreground">
                {message.length} / 1,000
              </span>
              {mode === "text" && (
                <span className="text-right text-xs text-muted-foreground">
                  Enter to send · Shift + Enter for a new line
                </span>
              )}
            </div>

            {(mode === "image" || mode === "file") && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept={mode === "image" ? "image/*" : undefined}
                  hidden
                  onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                />
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sending}
                    onClick={() => fileRef.current?.click()}
                    className="min-h-11 flex-1"
                  >
                    {mode === "image" ? (
                      <ImageIcon aria-hidden="true" />
                    ) : (
                      <FileIcon aria-hidden="true" />
                    )}
                    {attachment
                      ? "Choose another"
                      : mode === "image"
                        ? "Choose image"
                        : "Choose file"}
                  </Button>
                  <Button
                    type="button"
                    disabled={!attachment || sending}
                    onClick={() => void submitAttachment()}
                    className="min-h-11 flex-1"
                  >
                    {sending ? (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send aria-hidden="true" />
                    )}
                    {sending ? "Sending…" : `Send ${mode === "image" ? "image" : "file"}`}
                  </Button>
                </div>
                {attachment && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Remove attachment"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Files must be 20 MB or smaller.
                </p>
              </>
            )}

            {mode === "voice" && (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sending}
                  onClick={recording ? stopRecording : () => void startRecording()}
                  className="min-h-11 flex-1"
                >
                  {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
                  {recording
                    ? "Stop recording"
                    : recordedVoice
                      ? "Record again"
                      : "Record voice note"}
                </Button>
                <Button
                  type="button"
                  disabled={!recordedVoice || recording || sending}
                  onClick={() => void sendRecordedVoice()}
                  className="min-h-11 flex-1"
                >
                  {sending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                  {sending ? "Sending…" : "Send voice note"}
                </Button>
              </div>
            )}
            {recording && (
              <p className="mt-3 text-sm text-destructive" role="status">
                Recording voice note…
              </p>
            )}
            {recordedVoice && !recording && (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                Voice note ready to send.
              </p>
            )}

            {mode === "text" && (
              <Button
                type="submit"
                size="lg"
                disabled={!message.trim() || sending}
                className="mt-6 h-12 w-full text-base"
              >
                {sending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send aria-hidden="true" />
                )}
                {sending ? "Sending…" : "Send text message"}
              </Button>
            )}

            {mode === "nudge" && (
              <div className="mt-5">
                <p className="mb-3 text-sm leading-6 text-muted-foreground">
                  Sends this message {NUDGE_COUNT} times, 5 seconds apart. Keep this page open while
                  it runs.
                </p>
                {nudgeProgress === null ? (
                  <Button
                    type="button"
                    size="lg"
                    disabled={!message.trim()}
                    onClick={() => void sendNudge()}
                    className="h-12 w-full text-base"
                  >
                    <Siren aria-hidden="true" />
                    Send SOS nudge
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    onClick={() => {
                      nudgeCancelled.current = true;
                    }}
                    className="h-12 w-full text-base"
                  >
                    <Square aria-hidden="true" />
                    Stop nudge ({nudgeProgress}/{NUDGE_COUNT})
                  </Button>
                )}
              </div>
            )}
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" size={15} />
            <span>Your message is sent securely.</span>
          </div>
        </section>

        <section aria-labelledby="recent-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="recent-title" className="text-lg font-semibold text-foreground">
              Recent messages
            </h2>
            {recentMessages.length > 0 && (
              <span className="text-xs text-muted-foreground">This session</span>
            )}
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
                  <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {item.text}
                  </p>
                  <time
                    className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground"
                    dateTime={item.sentAt.toISOString()}
                  >
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
