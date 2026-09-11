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
// full sidebared app. The rail is a second, separate route/window — see
// src/app/companion/rail/page.tsx.
const COMPANION_URL: &str = "https://app.sealme.net/companion";
const RAIL_URL: &str = "https://app.sealme.net/companion/rail";
const COMPANION_WIDTH: f64 = 340.0;
const COMPANION_HEIGHT: f64 = 520.0;
const RAIL_WIDTH: f64 = 44.0;
const RAIL_HEIGHT: f64 = 172.0;
const COMPANION_MARGIN: f64 = 16.0;
const COMPANION_GAP: f64 = 8.0;
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

// Top-right-anchored logical position for the rail on whatever monitor it's
// opening on. Falls back to a fixed spot if the OS can't tell us about a
// primary monitor (shouldn't normally happen, but the builder still needs
// *some* position rather than failing the whole toggle).
fn rail_position(app: &tauri::AppHandle) -> (f64, f64) {
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let scale = monitor.scale_factor();
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let mon_x = mon_pos.x as f64 / scale;
        let mon_y = mon_pos.y as f64 / scale;
        let mon_w = mon_size.width as f64 / scale;
        return (mon_x + mon_w - RAIL_WIDTH - COMPANION_MARGIN, mon_y + COMPANION_MARGIN);
    }
    (100.0, 100.0)
}

// The content window sits immediately to the left of the rail, top-aligned
// with it — computed independently from the same monitor geometry (not by
// querying the rail's live position) so the two always line up consistently
// even if this runs before the rail has actually been shown yet.
fn content_position(app: &tauri::AppHandle) -> (f64, f64) {
    let (rail_x, rail_y) = rail_position(app);
    (rail_x - COMPANION_GAP - COMPANION_WIDTH, rail_y)
}

// transparent() + HudWindow gives a window the native macOS "liquid glass"
// look — a frosted, blurred-desktop-behind panel, the same material
// Spotlight/Notification Center widgets use — with rounded corners from
// `radius`. The webview's own CSS paints nothing solid behind its content
// (see CompanionPanel.tsx / CompanionRail.tsx) so the blur actually shows
// through instead of sitting behind an opaque backing. Not applied for
// `mas` builds — see the tauri dependency comment in Cargo.toml for why the
// Cargo feature itself still has to stay unconditionally on regardless.
fn apply_glass_or_plain<'a>(
    builder: tauri::WebviewWindowBuilder<'a, tauri::Wry, tauri::AppHandle>,
) -> tauri::WebviewWindowBuilder<'a, tauri::Wry, tauri::AppHandle> {
    #[cfg(not(feature = "mas"))]
    {
        builder.transparent(true).effects(
            EffectsBuilder::new()
                .effect(Effect::HudWindow)
                .state(EffectState::Active)
                .radius(COMPANION_RADIUS)
                .build(),
        )
    }
    #[cfg(feature = "mas")]
    {
        builder.background_color(tauri::webview::Color(245, 245, 247, 255))
    }
}

fn build_rail_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    let (x, y) = rail_position(app);
    eprintln!("[companion] creating rail window at ({x}, {y}), url={RAIL_URL}");
    let url = tauri::Url::parse(RAIL_URL).map_err(|e| {
        eprintln!("[companion] bad rail URL: {e}");
        e.to_string()
    })?;
    let builder = tauri::WebviewWindowBuilder::new(app, "rail", tauri::WebviewUrl::External(url))
        .title("SealMe")
        .inner_size(RAIL_WIDTH, RAIL_HEIGHT)
        .position(x, y)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(true)
        .focused(true)
        // Without this, a click on the panel while it's not the active
        // window only activates/focuses it — the click itself doesn't
        // reach any button, you'd need a second click. An always-on-top
        // utility panel like this one should feel clickable first try.
        .accept_first_mouse(true);
    match apply_glass_or_plain(builder).build() {
        Ok(w) => {
            eprintln!("[companion] rail window created");
            Ok(w)
        }
        Err(e) => {
            eprintln!("[companion] failed to create rail window: {e}");
            Err(e.to_string())
        }
    }
}

fn build_content_window(app: &tauri::AppHandle, view: &str) -> Result<tauri::WebviewWindow, String> {
    let (x, y) = content_position(app);
    let full_url = format!("{COMPANION_URL}?view={view}");
    eprintln!("[companion] creating content window at ({x}, {y}), url={full_url}");
    let url = tauri::Url::parse(&full_url).map_err(|e| {
        eprintln!("[companion] bad content URL: {e}");
        e.to_string()
    })?;
    let builder = tauri::WebviewWindowBuilder::new(app, "companion", tauri::WebviewUrl::External(url))
        .title("SealMe Companion")
        .inner_size(COMPANION_WIDTH, COMPANION_HEIGHT)
        .position(x, y)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(true)
        .shadow(true)
        .focused(true)
        .accept_first_mouse(true);
    match apply_glass_or_plain(builder).build() {
        Ok(w) => {
            eprintln!("[companion] content window created");
            Ok(w)
        }
        Err(e) => {
            eprintln!("[companion] failed to create content window: {e}");
            Err(e.to_string())
        }
    }
}

// Manual toggle only — not tied to call start/stop. Shows/hides the small
// persistent rail (and the content window along with it, if one happens to
// be open) in sync with the main window — exactly one of "main" / "rail" is
// visible after this returns; the content window is independent from then
// on, only ever shown via select_companion_view. Called from a button in
// the main window's AppShell, and symmetrically from a "back to app"
// control on the rail itself and inside the content window's header. Logs
// every step to stderr (visible in the `tauri dev` terminal) since this has
// no other feedback channel if something in here fails.
#[tauri::command]
fn toggle_companion_rail(app: tauri::AppHandle) -> Result<(), String> {
    eprintln!("[companion] rail toggle invoked");
    let main = app.get_webview_window("main");
    if main.is_none() {
        eprintln!("[companion] warning: no window labeled \"main\" found");
    }

    if let Some(rail) = app.get_webview_window("rail") {
        let visible = rail.is_visible().map_err(|e| {
            eprintln!("[companion] rail is_visible failed: {e}");
            e.to_string()
        })?;
        eprintln!("[companion] existing rail found, visible={visible}");
        if visible {
            // Show main BEFORE hiding the rail — never let every window be
            // invisible at once, even for an instant. Tauri/macOS treats
            // "zero visible windows" as "nothing left to run for" and quits
            // the whole app out from under you if the calls land in the
            // other order (confirmed: this crashed the dev process).
            if let Some(main) = main {
                main.show().map_err(|e| { eprintln!("[companion] main.show failed: {e}"); e.to_string() })?;
                main.set_focus().map_err(|e| { eprintln!("[companion] main.set_focus failed: {e}"); e.to_string() })?;
            }
            rail.hide().map_err(|e| { eprintln!("[companion] rail hide failed: {e}"); e.to_string() })?;
            if let Some(content) = app.get_webview_window("companion") {
                content.hide().map_err(|e| { eprintln!("[companion] content hide failed: {e}"); e.to_string() })?;
            }
            eprintln!("[companion] rail hidden, main restored");
            return Ok(());
        }
        let (x, y) = rail_position(&app);
        rail.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
            .map_err(|e| { eprintln!("[companion] rail set_position failed: {e}"); e.to_string() })?;
        rail.show().map_err(|e| { eprintln!("[companion] rail show failed: {e}"); e.to_string() })?;
        rail.set_focus().map_err(|e| { eprintln!("[companion] rail set_focus failed: {e}"); e.to_string() })?;
        if let Some(main) = main {
            main.hide().map_err(|e| { eprintln!("[companion] main.hide failed: {e}"); e.to_string() })?;
        }
        eprintln!("[companion] rail shown");
        return Ok(());
    }

    eprintln!("[companion] no existing rail, building one");
    let rail = build_rail_window(&app)?;
    rail.show().map_err(|e| { eprintln!("[companion] rail show failed: {e}"); e.to_string() })?;
    rail.set_focus().map_err(|e| { eprintln!("[companion] rail set_focus failed: {e}"); e.to_string() })?;
    if let Some(main) = main {
        main.hide().map_err(|e| { eprintln!("[companion] main.hide failed: {e}"); e.to_string() })?;
    }
    eprintln!("[companion] rail shown (first time)");
    Ok(())
}

// Picks (or collapses) the content window from the rail. Creates it on
// first use, positioned next to wherever the rail currently is; after
// that, re-shows/navigates the same window rather than recreating it each
// time — WebviewWindow::navigate() changes its URL in place. Picking the
// view that's already showing collapses the window back to rail-only, the
// same "tap the active icon again to close" the rail itself uses.
#[tauri::command]
fn select_companion_view(app: tauri::AppHandle, view: String) -> Result<(), String> {
    eprintln!("[companion] select_companion_view({view})");

    if let Some(content) = app.get_webview_window("companion") {
        let visible = content.is_visible().map_err(|e| { eprintln!("[companion] content is_visible failed: {e}"); e.to_string() })?;
        let current_url = content.url().map(|u| u.to_string()).unwrap_or_default();
        let already_on_view = current_url.ends_with(&format!("view={view}"));
        eprintln!("[companion] existing content found, visible={visible}, already_on_view={already_on_view}");

        if visible && already_on_view {
            content.hide().map_err(|e| { eprintln!("[companion] content hide failed: {e}"); e.to_string() })?;
            eprintln!("[companion] content hidden (same view re-picked)");
            return Ok(());
        }
        if !already_on_view {
            let full_url = format!("{COMPANION_URL}?view={view}");
            let url = tauri::Url::parse(&full_url).map_err(|e| { eprintln!("[companion] bad content URL: {e}"); e.to_string() })?;
            content.navigate(url).map_err(|e| { eprintln!("[companion] navigate failed: {e}"); e.to_string() })?;
        }
        let (x, y) = content_position(&app);
        content
            .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
            .map_err(|e| { eprintln!("[companion] content set_position failed: {e}"); e.to_string() })?;
        content.show().map_err(|e| { eprintln!("[companion] content show failed: {e}"); e.to_string() })?;
        content.set_focus().map_err(|e| { eprintln!("[companion] content set_focus failed: {e}"); e.to_string() })?;
        eprintln!("[companion] content shown at view={view}");
        return Ok(());
    }

    eprintln!("[companion] no existing content window, building one at view={view}");
    let content = build_content_window(&app, &view)?;
    content.show().map_err(|e| { eprintln!("[companion] content show failed: {e}"); e.to_string() })?;
    content.set_focus().map_err(|e| { eprintln!("[companion] content set_focus failed: {e}"); e.to_string() })?;
    eprintln!("[companion] content shown (first time) at view={view}");
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
            toggle_companion_rail,
            select_companion_view
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
