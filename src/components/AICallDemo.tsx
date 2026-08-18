"use client";

import { useEffect, useRef, useState } from "react";

type Turn = {
  speaker: "agency" | "client";
  text: string;
  fill?: { label: string; value: string };
};

const SCRIPT: Turn[] = [
  { speaker: "agency", text: "Thanks for hopping on. Excited to talk through the social media package for Acme Fitness." },
  { speaker: "client", text: "Happy to be here. We're really looking for someone to own our Instagram and TikTok." },
  { speaker: "agency", text: "Perfect, so on our end that would be full social media management.", fill: { label: "Service", value: "Social Media Management" } },
  { speaker: "client", text: "Exactly. How many reels are we talking per month?" },
  { speaker: "agency", text: "We'd do twelve reels a month, mixing in a couple of carousels.", fill: { label: "Deliverables", value: "12 Reels / month" } },
  { speaker: "client", text: "That sounds great. And what would that run us?" },
  { speaker: "agency", text: "For that scope, we'd do twenty five hundred a month.", fill: { label: "Fee", value: "€2,500 / month" } },
  { speaker: "client", text: "Twenty five hundred works on our end." },
  { speaker: "agency", text: "Great — and would you want that billed monthly, in advance?", fill: { label: "Payment terms", value: "Monthly, in advance" } },
  { speaker: "client", text: "Yeah, monthly in advance is fine for us." },
  { speaker: "agency", text: "When would you want to kick things off?" },
  { speaker: "client", text: "If we could start May first, that would be ideal.", fill: { label: "Start date", value: "May 1, 2026" } },
  { speaker: "agency", text: "May first it is. I'll get everything drawn up for a three month run to start.", fill: { label: "Duration", value: "3 months" } },
  { speaker: "client", text: "Perfect, looking forward to it." },
];

export default function AICallDemo() {
  const [status, setStatus] = useState<"idle" | "playing" | "unsupported" | "done">("idle");
  const [activeSpeaker, setActiveSpeaker] = useState<"agency" | "client" | null>(null);
  const [captionIndex, setCaptionIndex] = useState(-1);
  const [filled, setFilled] = useState<{ label: string; value: string }[]>([]);
  const voicesRef = useRef<{ agency?: SpeechSynthesisVoice; client?: SpeechSynthesisVoice }>({});
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("unsupported");
      return;
    }
    function pickVoices() {
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      if (voices.length === 0) return;
      voicesRef.current.agency = voices[0];
      voicesRef.current.client = voices.find((v) => v.name !== voices[0].name) ?? voices[0];
    }
    pickVoices();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVoices);
  }, []);

  function play() {
    if (status === "unsupported") return;
    window.speechSynthesis.cancel();
    stoppedRef.current = false;
    setFilled([]);
    setCaptionIndex(-1);
    setStatus("playing");
    speakFrom(0);
  }

  function speakFrom(i: number) {
    if (stoppedRef.current || i >= SCRIPT.length) {
      setStatus("done");
      setActiveSpeaker(null);
      return;
    }
    const turn = SCRIPT[i];
    const utterance = new SpeechSynthesisUtterance(turn.text);
    const voice = turn.speaker === "agency" ? voicesRef.current.agency : voicesRef.current.client;
    if (voice) utterance.voice = voice;
    utterance.pitch = turn.speaker === "agency" ? 1 : 1.25;
    utterance.rate = 1;

    utterance.onstart = () => {
      setActiveSpeaker(turn.speaker);
      setCaptionIndex(i);
    };
    utterance.onend = () => {
      if (turn.fill) setFilled((prev) => [...prev, turn.fill!]);
      speakFrom(i + 1);
    };
    utterance.onerror = () => speakFrom(i + 1);

    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setActiveSpeaker(null);
  }

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const current = captionIndex >= 0 ? SCRIPT[captionIndex] : null;

  return (
    <div className="card mb-6 overflow-hidden">
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Watch a call become a contract</h2>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          A real (synthesized) conversation — deal terms fill in the moment they're said.
        </div>
      </div>

      <div className="grid gap-0" style={{ gridTemplateColumns: "1fr 280px" }}>
        <div className="p-5">
          <div className="mb-4 grid grid-cols-2 gap-3">
            {(["agency", "client"] as const).map((speaker) => (
              <div
                key={speaker}
                className="flex flex-col items-center gap-2 rounded-[14px] py-6 transition-shadow"
                style={{
                  background: "var(--surface-2)",
                  border: activeSpeaker === speaker ? "1.5px solid var(--accent-blue)" : "1px solid var(--hairline)",
                  boxShadow: activeSpeaker === speaker ? "0 0 0 4px rgba(0,153,255,0.12)" : "none",
                }}
              >
                <div
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-full font-display text-[16px] font-semibold"
                  style={{ background: "var(--surface-1)", color: "var(--ink)" }}
                >
                  {speaker === "agency" ? "HM" : "AF"}
                </div>
                <span className="text-[12.5px] font-medium">{speaker === "agency" ? "Horizon Media" : "Acme Fitness"}</span>
                {activeSpeaker === speaker && (
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((b) => (
                      <span
                        key={b}
                        className="inline-block w-[3px] rounded-full"
                        style={{ height: "10px", background: "var(--accent-blue)", animation: `talkbar 0.9s ${b * 0.15}s ease-in-out infinite` }}
                      />
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="min-h-[52px] rounded-[10px] px-4 py-3 text-[13.5px]" style={{ background: "var(--canvas)", border: "1px solid var(--hairline-soft)", color: "var(--ink)" }}>
            {status === "unsupported" ? (
              <span style={{ color: "var(--ink-muted)" }}>Your browser doesn&apos;t support speech synthesis — try this in Chrome.</span>
            ) : current ? (
              <>
                <span className="font-medium" style={{ color: "var(--ink-muted)" }}>
                  {current.speaker === "agency" ? "Horizon Media: " : "Acme Fitness: "}
                </span>
                {current.text}
              </>
            ) : (
              <span style={{ color: "var(--ink-muted)" }}>Press play to start the call.</span>
            )}
          </div>

          <div className="mt-4 flex gap-2.5">
            {status !== "playing" ? (
              <button onClick={play} disabled={status === "unsupported"} className="btn btn-primary btn-sm">
                {status === "done" ? "Replay" : "▶ Play call"}
              </button>
            ) : (
              <button onClick={stop} className="btn btn-secondary btn-sm">
                Stop
              </button>
            )}
          </div>
        </div>

        <div className="p-5" style={{ borderLeft: "1px solid var(--hairline)" }}>
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Deal terms captured live
          </div>
          {filled.length === 0 ? (
            <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>Nothing yet — start the call.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {filled.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-2" style={{ background: "var(--surface-2)", animation: "fillIn 0.4s ease" }}>
                  <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{f.label}</span>
                  <span className="text-[12px] font-semibold">{f.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes talkbar { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
          @keyframes fillIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        }
      `}</style>
    </div>
  );
}
