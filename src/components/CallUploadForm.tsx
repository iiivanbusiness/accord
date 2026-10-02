"use client";

import { useRef, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { transcriptFromCaptionFile, transcriptFromListenResponse } from "@/lib/recording-transcript";

type Stage = { kind: "idle" } | { kind: "uploading"; progress: number } | { kind: "transcribing" } | { kind: "ready"; seconds: number; turns: number } | { kind: "error"; message: string };

// Without a direct-upload token the file goes through our own server,
// which can't take a request body this big.
const PROXY_MAX_BYTES = 4 * 1024 * 1024;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 * 1024 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 * 1024 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

// Sends a file with upload progress (fetch can't report it) and resolves to
// the parsed JSON response.
function upload(url: string, file: File, headers: Record<string, string>, onProgress: (p: number) => void, onUploaded: () => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = onUploaded;
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error((body as { error?: string } | null)?.error || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again"));
    xhr.send(file);
  });
}

// "Recording or transcript" on Start a call: upload the call's video or
// audio (transcribed by Deepgram, then shown for a check) or paste the
// transcript / load it from a text file. Either way the same deal
// extraction runs on the text.
export default function CallUploadForm({
  templates,
  action,
}: {
  templates: { id: string; name: string }[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [source, setSource] = useState<"recording" | "text">("recording");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [textFileNote, setTextFileNote] = useState<string | null>(null);
  const recordingInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLInputElement>(null);

  async function transcribe(f: File) {
    setFile(f);
    setTranscript("");
    setStage({ kind: "uploading", progress: 0 });
    try {
      const tokenRes = await fetch("/api/recordings/token", { method: "POST" });
      const grant = (await tokenRes.json()) as { mode?: string; token?: string; listenUrl?: string; error?: string };
      if (!tokenRes.ok) throw new Error(grant.error || "Recording uploads aren't available right now");
      const onProgress = (progress: number) => setStage({ kind: "uploading", progress });
      const onUploaded = () => setStage({ kind: "transcribing" });
      let result: { transcript: string; seconds: number; turns: number };
      if (grant.mode === "direct" && grant.token && grant.listenUrl) {
        const data = await upload(grant.listenUrl, f, { Authorization: `Bearer ${grant.token}`, "Content-Type": f.type || "application/octet-stream" }, onProgress, onUploaded);
        result = transcriptFromListenResponse(data as Parameters<typeof transcriptFromListenResponse>[0]);
      } else {
        if (f.size > PROXY_MAX_BYTES) throw new Error("Large recordings can't be uploaded yet. Use one under 4 MB, or paste the transcript");
        result = (await upload("/api/recordings/transcribe", f, { "Content-Type": f.type || "application/octet-stream" }, onProgress, onUploaded)) as typeof result;
      }
      if (!result.transcript.trim()) throw new Error("No speech was found in that recording");
      setTranscript(result.transcript);
      setStage({ kind: "ready", seconds: result.seconds, turns: result.turns });
    } catch (err) {
      setStage({ kind: "error", message: err instanceof Error ? `${err.message}.` : "Couldn't transcribe that recording." });
    }
  }

  function pickRecording(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!/^(audio|video)\//.test(f.type) && !/\.(mp4|mov|m4a|mp3|wav|webm|ogg|aac|flac|mkv)$/i.test(f.name)) {
      setStage({ kind: "error", message: "That isn't an audio or video file." });
      return;
    }
    void transcribe(f);
  }

  async function pickTextFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const raw = await f.text();
    const isCaptions = /\.(vtt|srt)$/i.test(f.name) || raw.trimStart().startsWith("WEBVTT");
    setTranscript(isCaptions ? transcriptFromCaptionFile(raw) : raw.trim());
    setTextFileNote(`Loaded ${f.name}. Check it below, then pick a template.`);
  }

  const busy = stage.kind === "uploading" || stage.kind === "transcribing";
  const canSubmit = transcript.trim().length > 0 && !busy;
  const tab = (key: "recording" | "text", label: string) => (
    <button
      type="button"
      onClick={() => setSource(key)}
      disabled={busy}
      aria-pressed={source === key}
      className="btn btn-sm flex-1 justify-center"
      style={source === key ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "transparent", color: "var(--ink-muted)" }}
    >
      {label}
    </button>
  );

  return (
    <form action={action} className="card flex max-w-[560px] flex-col gap-4 p-6">
      <input type="hidden" name="source" value={source === "recording" ? "recording" : "text"} />
      <div className="flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--hairline)", background: "var(--surface-1)" }}>
        {tab("recording", "Recording")}
        {tab("text", "Transcript")}
      </div>

      {source === "recording" ? (
        <div className="flex flex-col gap-3">
          <input
            ref={recordingInput}
            type="file"
            accept="audio/*,video/*,.mp4,.mov,.m4a,.mp3,.wav,.webm,.mkv"
            className="hidden"
            onChange={(e) => {
              pickRecording(e.target.files);
              e.target.value = "";
            }}
          />
          {stage.kind === "idle" || stage.kind === "error" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickRecording(e.dataTransfer.files);
              }}
              className="flex flex-col items-center gap-2.5 rounded-[14px] border border-dashed px-5 py-8 text-center transition-colors"
              style={{ borderColor: dragging ? "var(--accent-blue)" : "var(--hairline)", background: dragging ? "var(--canvas)" : undefined }}
            >
              <div className="text-[14px] font-medium">Drop the call recording here</div>
              <div className="max-w-[380px] text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                Video or audio from Zoom, Meet, Teams or your phone: MP4, MOV, M4A, MP3, WAV or WEBM. SealMe turns it into a transcript you can check before anything else happens.
              </div>
              <button type="button" onClick={() => recordingInput.current?.click()} className="btn btn-secondary btn-sm mt-1">
                Choose a file
              </button>
              {stage.kind === "error" && <div className="chip chip-warn mt-1 whitespace-normal px-3 py-2 text-left text-[12.5px]">{stage.message}</div>}
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-[14px] border px-4 py-3.5" style={{ borderColor: "var(--hairline)" }}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate font-medium" title={file?.name}>{file?.name}</span>
                <span className="flex-none" style={{ color: "var(--ink-muted)" }}>{file ? formatSize(file.size) : ""}</span>
              </div>
              {stage.kind === "uploading" && (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--canvas)" }}>
                    <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${stage.progress}%`, background: "var(--primary)" }} />
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Uploading… {stage.progress}%</div>
                </>
              )}
              {stage.kind === "transcribing" && (
                <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                  Transcribing the call. A long recording can take a minute or two.
                </div>
              )}
              {stage.kind === "ready" && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
                  <span>
                    Transcript ready · {formatDuration(stage.seconds)} of audio{stage.turns ? ` · ${stage.turns} turns` : ""}
                  </span>
                  <button type="button" onClick={() => recordingInput.current?.click()} className="font-medium" style={{ color: "var(--accent-blue)" }}>
                    Use a different file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{textFileNote ?? "Paste it below, or load a .txt, .vtt or .srt file."}</div>
          <input
            ref={textInput}
            type="file"
            accept=".txt,.vtt,.srt,.md,text/plain,text/vtt"
            className="hidden"
            onChange={(e) => {
              void pickTextFile(e.target.files);
              e.target.value = "";
            }}
          />
          <button type="button" onClick={() => textInput.current?.click()} className="btn btn-secondary btn-sm flex-none">
            Upload a text file
          </button>
        </div>
      )}

      {(source === "text" || stage.kind === "ready") && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{source === "recording" ? "Transcript (you can fix names or anything misheard)" : "Call transcript"}</span>
          <textarea
            name="transcript"
            required
            rows={12}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={"Agency: Hey, thanks for hopping on...\nClient: Of course, excited to talk about..."}
            className="input font-mono-tab text-[12.5px]"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Template</span>
        <select name="templateId" required className="input" defaultValue="">
          <option value="" style={{ background: "var(--surface-1)" }}>
            Choose a template
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id} style={{ background: "var(--surface-1)" }}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {canSubmit ? (
        <SubmitButton className="btn btn-primary mt-2 w-full justify-center" pendingText="Reading the call, this can take up to a minute…">
          Extract deal terms
        </SubmitButton>
      ) : (
        <button type="button" disabled className="btn btn-primary mt-2 w-full justify-center" style={{ opacity: 0.5 }}>
          {busy ? "Waiting for the transcript…" : "Extract deal terms"}
        </button>
      )}
    </form>
  );
}
