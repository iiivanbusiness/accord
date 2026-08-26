mod audio;

use tauri::Manager;

// The webview is pinned to this origin (see tauri.conf.json) — hardcoded
// here too so the upload target can't be influenced by anything the loaded
// page passes in.
const APP_BASE_URL: &str = "https://app.sealme.net";

#[derive(serde::Serialize)]
struct StopCaptureResult {
    ok: bool,
    error: Option<String>,
}

#[tauri::command]
fn start_local_capture() -> Result<(), String> {
    audio::start_capture()
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
    audio::stop_capture_wav()?;
    Ok(())
}

#[tauri::command]
async fn stop_local_capture_and_upload(app: tauri::AppHandle, token: String) -> Result<StopCaptureResult, String> {
    let wav = audio::stop_capture_wav()?;
    let Some(wav_bytes) = wav else {
        return Ok(StopCaptureResult { ok: false, error: Some("No audio was captured".to_string()) });
    };

    // Persist to disk before attempting the upload so a flaky connection
    // doesn't lose the recording — only deleted once the backend confirms
    // it received and processed the call.
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_path = cache_dir.join(format!("call-{millis}.wav"));
    std::fs::write(&file_path, &wav_bytes).map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let send_result = client
        .post(format!("{APP_BASE_URL}/api/local-capture/transcribe"))
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "audio/wav")
        .body(wav_bytes)
        .send()
        .await;

    match send_result {
        Ok(res) if res.status().is_success() => {
            let _ = std::fs::remove_file(&file_path);
            Ok(StopCaptureResult { ok: true, error: None })
        }
        Ok(res) => {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            Ok(StopCaptureResult {
                ok: false,
                error: Some(format!("Upload failed ({status}): {body}. The recording is saved at {}", file_path.display())),
            })
        }
        Err(e) => Ok(StopCaptureResult {
            ok: false,
            error: Some(format!("Upload failed: {e}. The recording is saved at {}", file_path.display())),
        }),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_local_capture,
            is_local_capturing,
            discard_local_capture,
            stop_local_capture_and_upload
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
