mod audio;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

// The webview is pinned to this origin (see tauri.conf.json) — hardcoded
// here too so the upload target can't be influenced by anything the loaded
// page passes in.
const APP_BASE_URL: &str = "https://app.sealme.net";

// How often to send a live chunk while the call is still going, mirroring
// the ~1 minute delay the existing Recall bot flow already has.
const LIVE_UPDATE_INTERVAL_SECS: u64 = 60;

// Signals the background live-update loop to stop. A single global is fine
// here — same as the Swift side's CaptureSession.shared, there is only ever
// one call being recorded at a time.
static LIVE_UPDATES_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(serde::Serialize)]
struct StopCaptureResult {
    ok: bool,
    error: Option<String>,
}

#[tauri::command]
fn start_local_capture() -> Result<(), String> {
    audio::start_capture()
}

// Called once the caller has a token (i.e. once startLocalCapture's deal
// actually exists) — starts a background loop that periodically uploads
// whatever's been captured since the last chunk, so deal terms fill in
// while the call is still happening instead of only at the very end.
#[tauri::command]
fn begin_live_updates(app: tauri::AppHandle, token: String) {
    LIVE_UPDATES_ACTIVE.store(true, Ordering::SeqCst);
    std::thread::spawn(move || {
        while LIVE_UPDATES_ACTIVE.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_secs(LIVE_UPDATE_INTERVAL_SECS));
            if !LIVE_UPDATES_ACTIVE.load(Ordering::SeqCst) {
                break;
            }
            if let Ok(Some(wav)) = audio::snapshot_delta_wav() {
                tauri::async_runtime::block_on(upload_chunk(&app, &token, wav, false));
            }
        }
    });
}

#[tauri::command]
fn is_local_capturing() -> bool {
    audio::is_capturing()
}

// Used when capture started successfully but the deal it was meant for
// couldn't be created (e.g. plan call limit reached) — stops the recording
// and throws the audio away rather than leaving it running with nothing to
// upload it to.
#[tauri::command]
fn discard_local_capture() -> Result<(), String> {
    LIVE_UPDATES_ACTIVE.store(false, Ordering::SeqCst);
    audio::stop_capture_wav()?;
    Ok(())
}

#[tauri::command]
async fn stop_local_capture_and_upload(app: tauri::AppHandle, token: String) -> Result<StopCaptureResult, String> {
    LIVE_UPDATES_ACTIVE.store(false, Ordering::SeqCst);

    // Whatever arrived since the last periodic chunk (or the whole call, if
    // live updates never got a chance to fire) — every earlier chunk was
    // already transcribed and appended server-side, so there's no need to
    // resend anything that's already been sent.
    let final_chunk = audio::snapshot_delta_wav()?.unwrap_or_default();
    audio::stop_capture_wav()?;

    Ok(upload_chunk(&app, &token, final_chunk, true).await)
}

/// Shared by both the periodic live pings and the final call. Persists the
/// chunk to disk before attempting the upload so a flaky connection doesn't
/// lose audio — only deleted once the backend confirms it processed it.
async fn upload_chunk(app: &tauri::AppHandle, token: &str, wav_bytes: Vec<u8>, is_final: bool) -> StopCaptureResult {
    let file_path = if wav_bytes.is_empty() {
        None
    } else {
        match app.path().app_cache_dir() {
            Ok(cache_dir) => {
                let _ = std::fs::create_dir_all(&cache_dir);
                let millis = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis())
                    .unwrap_or(0);
                let suffix = if is_final { "final" } else { "live" };
                let path = cache_dir.join(format!("call-{millis}-{suffix}.wav"));
                let _ = std::fs::write(&path, &wav_bytes);
                Some(path)
            }
            Err(_) => None,
        }
    };

    let client = reqwest::Client::new();
    let url = format!("{APP_BASE_URL}/api/local-capture/transcribe?final={}", if is_final { "true" } else { "false" });
    let send_result = client
        .post(url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "audio/wav")
        .body(wav_bytes)
        .send()
        .await;

    match send_result {
        Ok(res) if res.status().is_success() => {
            if let Some(path) = &file_path {
                let _ = std::fs::remove_file(path);
            }
            StopCaptureResult { ok: true, error: None }
        }
        Ok(res) => {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            let saved = file_path.map(|p| format!(" The recording is saved at {}.", p.display())).unwrap_or_default();
            StopCaptureResult { ok: false, error: Some(format!("Upload failed ({status}): {body}.{saved}")) }
        }
        Err(e) => {
            let saved = file_path.map(|p| format!(" The recording is saved at {}.", p.display())).unwrap_or_default();
            StopCaptureResult { ok: false, error: Some(format!("Upload failed: {e}.{saved}")) }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_local_capture,
            begin_live_updates,
            is_local_capturing,
            discard_local_capture,
            stop_local_capture_and_upload
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
