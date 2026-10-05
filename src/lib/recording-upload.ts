import { transcriptFromListenResponse } from "@/lib/recording-transcript";

// Browser side of turning a call recording into a transcript. Shared by
// "Start a call" and the Calls inbox.

// Without a direct-upload token the file goes through our own server,
// which can't take a request body this big.
export const PROXY_MAX_BYTES = 4 * 1024 * 1024;

export type RecordingTranscript = { transcript: string; seconds: number; turns: number };

export function isRecordingFile(f: File): boolean {
  return /^(audio|video)\//.test(f.type) || /\.(mp4|mov|m4a|mp3|wav|webm|ogg|aac|flac|mkv)$/i.test(f.name);
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

// Straight to Deepgram with a short-lived token when the key allows it,
// otherwise through /api/recordings/transcribe (small files only).
export async function transcribeRecordingFile(
  f: File,
  { onProgress, onUploaded }: { onProgress: (p: number) => void; onUploaded: () => void },
): Promise<RecordingTranscript> {
  const tokenRes = await fetch("/api/recordings/token", { method: "POST" });
  const grant = (await tokenRes.json()) as { mode?: string; token?: string; listenUrl?: string; error?: string };
  if (!tokenRes.ok) throw new Error(grant.error || "Recording uploads aren't available right now");
  let result: RecordingTranscript;
  if (grant.mode === "direct" && grant.token && grant.listenUrl) {
    const data = await upload(grant.listenUrl, f, { Authorization: `Bearer ${grant.token}`, "Content-Type": f.type || "application/octet-stream" }, onProgress, onUploaded);
    result = transcriptFromListenResponse(data as Parameters<typeof transcriptFromListenResponse>[0]);
  } else {
    if (f.size > PROXY_MAX_BYTES) throw new Error("Large recordings can't be uploaded yet. Use one under 4 MB, or paste the transcript");
    result = (await upload("/api/recordings/transcribe", f, { "Content-Type": f.type || "application/octet-stream" }, onProgress, onUploaded)) as RecordingTranscript;
  }
  if (!result.transcript.trim()) throw new Error("No speech was found in that recording");
  return result;
}

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 * 1024 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 * 1024 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}
