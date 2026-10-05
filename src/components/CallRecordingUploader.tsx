"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFileSize, isRecordingFile, transcribeRecordingFile } from "@/lib/recording-upload";

type Stage = { kind: "idle" } | { kind: "uploading"; progress: number; name: string; size: number } | { kind: "transcribing"; name: string; size: number } | { kind: "error"; message: string };

// "Add a recording" on the Calls page: the file is transcribed straight
// from the browser and the call lands in the inbox below, just like a call
// from the phone will.
export default function CallRecordingUploader({ addAction }: { addAction: (input: { transcript: string; seconds: number }) => Promise<void> }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  async function handle(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!isRecordingFile(f)) {
      setStage({ kind: "error", message: "That isn't an audio or video file." });
      return;
    }
    setStage({ kind: "uploading", progress: 0, name: f.name, size: f.size });
    try {
      const result = await transcribeRecordingFile(f, {
        onProgress: (progress) => setStage({ kind: "uploading", progress, name: f.name, size: f.size }),
        onUploaded: () => setStage({ kind: "transcribing", name: f.name, size: f.size }),
      });
      await addAction({ transcript: result.transcript, seconds: result.seconds });
      setStage({ kind: "idle" });
      router.refresh();
    } catch (err) {
      setStage({ kind: "error", message: err instanceof Error ? `${err.message}.` : "Couldn't add that recording." });
    }
  }

  const busy = stage.kind === "uploading" || stage.kind === "transcribing";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) void handle(e.dataTransfer.files);
      }}
      className="card flex flex-col gap-2.5 px-5 py-4 transition-colors"
      style={dragging ? { borderColor: "var(--accent-blue)" } : undefined}
    >
      <input
        ref={input}
        type="file"
        accept="audio/*,video/*,.mp4,.mov,.m4a,.mp3,.wav,.webm,.mkv"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-medium">Add a call recording</div>
          <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            Drop an audio or video file of a call, or choose one. It lands below, ready to process.
          </div>
        </div>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-secondary btn-sm flex-none">
          Choose a file
        </button>
      </div>
      {(stage.kind === "uploading" || stage.kind === "transcribing") && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 truncate font-medium" title={stage.name}>{stage.name}</span>
            <span className="flex-none" style={{ color: "var(--ink-muted)" }}>{formatFileSize(stage.size)}</span>
          </div>
          {stage.kind === "uploading" ? (
            <>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--canvas)" }}>
                <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${stage.progress}%`, background: "var(--primary)" }} />
              </div>
              <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Uploading… {stage.progress}%</div>
            </>
          ) : (
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Transcribing. A long call can take a minute or two.</div>
          )}
        </div>
      )}
      {stage.kind === "error" && <div className="chip chip-warn whitespace-normal px-3 py-2 text-left text-[12.5px]">{stage.message}</div>}
    </div>
  );
}
