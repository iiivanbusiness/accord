//! Safe Rust wrapper around the ScreenCaptureKit bridge in
//! `native/audio_capture.swift`. macOS-only.

#[cfg(target_os = "macos")]
extern "C" {
    fn sealme_audio_start() -> i32;
    fn sealme_audio_is_capturing() -> i32;
    fn sealme_audio_stop_wav(out_ptr: *mut *mut u8, out_len: *mut usize) -> i32;
    fn sealme_audio_free(ptr: *mut u8, len: usize);
}

#[cfg(target_os = "macos")]
pub fn start_capture() -> Result<(), String> {
    let code = unsafe { sealme_audio_start() };
    match code {
        0 => Ok(()),
        -100 => Err("Capture is already running".to_string()),
        -1 => Err("No display available to capture from".to_string()),
        -2 => Err("Couldn't start capture — check Screen Recording permission in System Settings".to_string()),
        -3 => Err("Couldn't access the microphone — check Microphone permission in System Settings".to_string()),
        other => Err(format!("Unknown audio capture error: {other}")),
    }
}

#[cfg(target_os = "macos")]
pub fn is_capturing() -> bool {
    unsafe { sealme_audio_is_capturing() != 0 }
}

/// Stops the active capture and returns the recorded call as a 16-bit PCM
/// WAV file. Returns `Ok(None)` if nothing was captured (e.g. a silent call).
#[cfg(target_os = "macos")]
pub fn stop_capture_wav() -> Result<Option<Vec<u8>>, String> {
    let mut ptr: *mut u8 = std::ptr::null_mut();
    let mut len: usize = 0;

    let code = unsafe { sealme_audio_stop_wav(&mut ptr, &mut len) };
    if code != 0 || ptr.is_null() {
        return Ok(None);
    }

    let wav = unsafe { std::slice::from_raw_parts(ptr, len).to_vec() };
    unsafe { sealme_audio_free(ptr, len) };
    Ok(Some(wav))
}

#[cfg(not(target_os = "macos"))]
pub fn start_capture() -> Result<(), String> {
    Err("Local call capture is only supported on macOS right now".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn is_capturing() -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
pub fn stop_capture_wav() -> Result<Option<Vec<u8>>, String> {
    Err("Local call capture is only supported on macOS right now".to_string())
}
