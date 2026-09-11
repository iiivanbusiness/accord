mod audio;

use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(not(feature = "mas"))]
use tauri::window::{Effect, EffectState, EffectsBuilder};
use tauri::Manager;

// The webview is pinned to this origin (see tauri.conf.json) — hardcoded
// here too so the upload target can't be influenced by anything the loaded
// page passes in.
const APP_BASE_URL: &str = "https://app.sealme.net";

// The floating companion window's own route — a chrome-less view of the
// same app.sealme.net session (see src/app/companion/page.tsx), not the
// full sidebared app.
const COMPANION_URL: &str = "https://app.sealme.net/companion";
const COMPANION_WIDTH: f64 = 340.0;
const COMPANION_HEIGHT: f64 = 520.0;
const COMPANION_MARGIN: f64 = 16.0;
#[cfg(not(feature = "mas"))]
const COMPANION_RADIUS: f64 = 16.0;

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

// Top-right-anchored logical position for the companion window on whatever
// monitor it's opening on. Falls back to a fixed spot if the OS can't tell
// us about a primary monitor (shouldn't normally happen, but the builder
// still needs *some* position rather than failing the whole toggle).
fn companion_position(app: &tauri::AppHandle) -> (f64, f64) {
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let scale = monitor.scale_factor();
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let mon_x = mon_pos.x as f64 / scale;
        let mon_y = mon_pos.y as f64 / scale;
        let mon_w = mon_size.width as f64 / scale;
        return (mon_x + mon_w - COMPANION_WIDTH - COMPANION_MARGIN, mon_y + COMPANION_MARGIN);
    }
    (100.0, 100.0)
}

fn build_companion_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    let (x, y) = companion_position(app);
    eprintln!("[companion] creating window at ({x}, {y}), url={COMPANION_URL}");
    let url = tauri::Url::parse(COMPANION_URL).map_err(|e| {
        eprintln!("[companion] bad URL: {e}");
        e.to_string()
    })?;
    #[cfg_attr(feature = "mas", allow(unused_mut))]
    let mut builder = tauri::WebviewWindowBuilder::new(app, "companion", tauri::WebviewUrl::External(url))
        .title("SealMe Companion")
        .inner_size(COMPANION_WIDTH, COMPANION_HEIGHT)
        .position(x, y)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(true)
        .shadow(true);

    // transparent() + HudWindow gives it the native macOS "liquid glass"
    // look — a frosted, blurred-desktop-behind panel, the same material
    // Spotlight/Notification Center widgets use — with rounded corners from
    // `radius`. The webview's own CSS paints nothing solid behind its
    // content (see CompanionPanel.tsx) so the blur actually shows through
    // instead of sitting behind an opaque backing. Not called for `mas`
    // builds — see the tauri dependency comment in Cargo.toml for why the
    // Cargo feature itself still has to stay unconditionally on.
    #[cfg(not(feature = "mas"))]
    {
        builder = builder.transparent(true).effects(
            EffectsBuilder::new()
                .effect(Effect::HudWindow)
                .state(EffectState::Active)
                .radius(COMPANION_RADIUS)
                .build(),
        );
    }
    // MAS builds get a plain opaque panel instead — no glass effect, but the
    // capability is never actually exercised.
    #[cfg(feature = "mas")]
    {
        builder = builder.background_color(tauri::webview::Color(245, 245, 247, 255));
    }

    let result = builder.build();
    match result {
        Ok(w) => {
            eprintln!("[companion] window created");
            Ok(w)
        }
        Err(e) => {
            eprintln!("[companion] failed to create window: {e}");
            Err(e.to_string())
        }
    }
}

// Manual toggle only — not tied to call start/stop. Collapses the main app
// into a small always-on-top panel (and back), rather than showing both at
// once: exactly one of "main" / "companion" is visible after this returns.
// Called from a button in the main window's AppShell, and symmetrically
// from a "back to app" control inside the companion panel itself (see
// src/components/CompanionPanel.tsx) — same command either way. Logs every
// step to stderr (visible in the `tauri dev` terminal) since this has no
// other feedback channel if something in here fails.
#[tauri::command]
fn toggle_companion_window(app: tauri::AppHandle) -> Result<(), String> {
    eprintln!("[companion] toggle invoked");
    let main = app.get_webview_window("main");
    if main.is_none() {
        eprintln!("[companion] warning: no window labeled \"main\" found");
    }

    if let Some(companion) = app.get_webview_window("companion") {
        let visible = companion.is_visible().map_err(|e| {
            eprintln!("[companion] is_visible failed: {e}");
            e.to_string()
        })?;
        eprintln!("[companion] existing window found, visible={visible}");
        if visible {
            companion.hide().map_err(|e| { eprintln!("[companion] hide failed: {e}"); e.to_string() })?;
            if let Some(main) = main {
                main.show().map_err(|e| { eprintln!("[companion] main.show failed: {e}"); e.to_string() })?;
                main.set_focus().map_err(|e| { eprintln!("[companion] main.set_focus failed: {e}"); e.to_string() })?;
            }
            eprintln!("[companion] hidden, main restored");
            return Ok(());
        }
        // Window exists (created once, then hidden rather than destroyed on
        // every toggle) but isn't currently shown — reposition in case the
        // monitor layout changed since it was last opened, then show it.
        let (x, y) = companion_position(&app);
        companion
            .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
            .map_err(|e| { eprintln!("[companion] set_position failed: {e}"); e.to_string() })?;
        if let Some(main) = main {
            main.hide().map_err(|e| { eprintln!("[companion] main.hide failed: {e}"); e.to_string() })?;
        }
        companion.show().map_err(|e| { eprintln!("[companion] show failed: {e}"); e.to_string() })?;
        companion.set_focus().map_err(|e| { eprintln!("[companion] set_focus failed: {e}"); e.to_string() })?;
        eprintln!("[companion] shown");
        return Ok(());
    }

    eprintln!("[companion] no existing window, building one");
    let companion = build_companion_window(&app)?;
    if let Some(main) = main {
        main.hide().map_err(|e| { eprintln!("[companion] main.hide failed: {e}"); e.to_string() })?;
    }
    companion.show().map_err(|e| { eprintln!("[companion] show failed: {e}"); e.to_string() })?;
    companion.set_focus().map_err(|e| { eprintln!("[companion] set_focus failed: {e}"); e.to_string() })?;
    eprintln!("[companion] shown (first time)");
    Ok(())
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

// Checks https://app.sealme.net/updates/latest.json on startup and, if a
// newer version is signed and available, downloads and installs it, then
// restarts so it takes effect. Entirely on the Rust side — the webview never
// gets a say in whether/when this happens, since it's just the remote page,
// not something we want triggering updates.
//
// Not compiled into `mas` builds at all — Apple doesn't allow apps
// distributed through the Mac App Store to update themselves; the Store is
// the only update channel there.
#[cfg(all(desktop, not(feature = "mas")))]
async fn check_for_update(app: tauri::AppHandle) {
    use tauri_plugin_updater::UpdaterExt;

    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("updater unavailable: {e}");
            return;
        }
    };

    eprintln!("[updater] checking...");
    match updater.check().await {
        Ok(Some(update)) => {
            eprintln!("[updater] update found: {} -> {}", update.current_version, update.version);
            let install = update.download_and_install(|_chunk, _total| {}, || {}).await;
            match install {
                Ok(()) => {
                    eprintln!("[updater] installed, restarting");
                    tauri::process::restart(&app.env());
                }
                Err(e) => eprintln!("[updater] install failed: {e}"),
            }
        }
        Ok(None) => eprintln!("[updater] no update available"),
        Err(e) => eprintln!("[updater] check failed: {e}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `mut` is only needed to re-assign it in the updater block below, which
    // `mas` builds compile out entirely.
    #[cfg_attr(feature = "mas", allow(unused_mut))]
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    // Updater is desktop-only — there's no mobile build of this app today,
    // but gating it keeps that true if one is ever added later. Also
    // skipped for `mas` builds (see check_for_update's doc comment above).
    #[cfg(all(desktop, not(feature = "mas")))]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .setup(|app| {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(check_for_update(handle));
                Ok(())
            });
    }

    builder
        .invoke_handler(tauri::generate_handler![
            start_local_capture,
            begin_live_updates,
            is_local_capturing,
            discard_local_capture,
            stop_local_capture_and_upload,
            toggle_companion_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
