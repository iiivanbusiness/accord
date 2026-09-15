//! Native call capture for Windows, mirroring `native/audio_capture.swift`.
//!
//! Two independent sources are captured for the duration of the call and
//! mixed into a single stereo WAV on stop/snapshot, in the exact same layout
//! the macOS side produces (see `deepgram.ts`'s CHANNEL_LABELS comment):
//!   - left channel:  system audio output, captured via a WASAPI loopback
//!     stream on the default render (playback) device — the other person's
//!     voice, since that's what plays through your speakers
//!   - right channel: the microphone, captured via a normal WASAPI capture
//!     stream on the default capture device — your own voice
//! WASAPI's shared-mode `autoconvert` does the resampling/downmixing down to
//! 16kHz mono itself, so there's no hand-written resampler here (unlike the
//! Swift side, which uses AVAudioConverter for the same purpose).

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread::{self, JoinHandle};

use wasapi::{DeviceEnumerator, Direction, SampleType, StreamMode, WaveFormat};

const CAPTURE_SAMPLE_RATE: u32 = 16000;
// WASAPI event-driven capture normally wakes every ~10ms (the device
// period) — this is only a "something's badly wrong" safety net, not the
// steady-state cadence.
const EVENT_TIMEOUT_MS: u32 = 2000;

struct ChannelBuffer {
    pcm16: Vec<i16>,
    exported_samples: usize,
}

impl ChannelBuffer {
    const fn new() -> Self {
        Self { pcm16: Vec::new(), exported_samples: 0 }
    }
}

static SYSTEM_BUF: Mutex<ChannelBuffer> = Mutex::new(ChannelBuffer::new());
static MIC_BUF: Mutex<ChannelBuffer> = Mutex::new(ChannelBuffer::new());
static STOP_FLAG: AtomicBool = AtomicBool::new(false);
static CAPTURING: AtomicBool = AtomicBool::new(false);
static THREADS: Mutex<Option<(JoinHandle<()>, JoinHandle<()>)>> = Mutex::new(None);

pub fn start_capture() -> Result<(), String> {
    if CAPTURING.load(Ordering::SeqCst) {
        return Err("Capture is already running".to_string());
    }

    {
        let mut g = SYSTEM_BUF.lock().unwrap();
        g.pcm16.clear();
        g.exported_samples = 0;
    }
    {
        let mut g = MIC_BUF.lock().unwrap();
        g.pcm16.clear();
        g.exported_samples = 0;
    }
    STOP_FLAG.store(false, Ordering::SeqCst);

    let (sys_ready_tx, sys_ready_rx) = mpsc::channel::<Result<(), String>>();
    let sys_thread = thread::Builder::new()
        .name("sealme-audio-system".to_string())
        .spawn(move || capture_loop(Direction::Render, Direction::Capture, &SYSTEM_BUF, sys_ready_tx))
        .map_err(|e| format!("Couldn't start system-audio capture thread: {e}"))?;

    match sys_ready_rx.recv() {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            let _ = sys_thread.join();
            return Err(format!("Couldn't start system-audio capture: {e}"));
        }
        Err(_) => {
            let _ = sys_thread.join();
            return Err("System-audio capture thread exited unexpectedly".to_string());
        }
    }

    let (mic_ready_tx, mic_ready_rx) = mpsc::channel::<Result<(), String>>();
    let mic_thread = thread::Builder::new()
        .name("sealme-audio-mic".to_string())
        .spawn(move || capture_loop(Direction::Capture, Direction::Capture, &MIC_BUF, mic_ready_tx))
        .map_err(|e| format!("Couldn't start microphone capture thread: {e}"))?;

    match mic_ready_rx.recv() {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            // Mirrors the Swift side: mic failing after system audio already
            // started tears the whole attempt down rather than half-recording.
            STOP_FLAG.store(true, Ordering::SeqCst);
            let _ = sys_thread.join();
            let _ = mic_thread.join();
            STOP_FLAG.store(false, Ordering::SeqCst);
            return Err(format!(
                "Couldn't access the microphone — check Microphone privacy settings in Windows Settings ({e})"
            ));
        }
        Err(_) => {
            STOP_FLAG.store(true, Ordering::SeqCst);
            let _ = sys_thread.join();
            let _ = mic_thread.join();
            STOP_FLAG.store(false, Ordering::SeqCst);
            return Err("Microphone capture thread exited unexpectedly".to_string());
        }
    }

    *THREADS.lock().unwrap() = Some((sys_thread, mic_thread));
    CAPTURING.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn is_capturing() -> bool {
    CAPTURING.load(Ordering::SeqCst)
}

/// Stops both capture streams and returns the *entire* recording (not just
/// the unexported tail) on each channel — same contract as the Swift side's
/// `stopAndGetWav`.
pub fn stop_capture_wav() -> Result<Option<Vec<u8>>, String> {
    if !CAPTURING.swap(false, Ordering::SeqCst) {
        return Ok(None);
    }

    STOP_FLAG.store(true, Ordering::SeqCst);
    if let Some((sys_thread, mic_thread)) = THREADS.lock().unwrap().take() {
        let _ = sys_thread.join();
        let _ = mic_thread.join();
    }
    STOP_FLAG.store(false, Ordering::SeqCst);

    let system = {
        let mut g = SYSTEM_BUF.lock().unwrap();
        g.exported_samples = 0;
        std::mem::take(&mut g.pcm16)
    };
    let mic = {
        let mut g = MIC_BUF.lock().unwrap();
        g.exported_samples = 0;
        std::mem::take(&mut g.pcm16)
    };

    if system.is_empty() && mic.is_empty() {
        return Ok(None);
    }
    Ok(Some(make_stereo_wav(&system, &mic)))
}

/// Non-destructive: returns only the audio captured since the last snapshot
/// (or since start) on both channels, and advances the checkpoint. Capture
/// keeps running — used for periodic live transcription passes.
pub fn snapshot_delta_wav() -> Result<Option<Vec<u8>>, String> {
    if !CAPTURING.load(Ordering::SeqCst) {
        return Ok(None);
    }

    let system_delta = {
        let mut g = SYSTEM_BUF.lock().unwrap();
        let delta = g.pcm16[g.exported_samples..].to_vec();
        g.exported_samples = g.pcm16.len();
        delta
    };
    let mic_delta = {
        let mut g = MIC_BUF.lock().unwrap();
        let delta = g.pcm16[g.exported_samples..].to_vec();
        g.exported_samples = g.pcm16.len();
        delta
    };

    if system_delta.is_empty() && mic_delta.is_empty() {
        return Ok(None);
    }
    Ok(Some(make_stereo_wav(&system_delta, &mic_delta)))
}

/// Runs on its own thread for the lifetime of one capture session. For
/// system-audio loopback, `device_direction` is `Render` (open the default
/// *output* device) while `stream_direction` is `Capture` — that specific
/// combination is what makes `AudioClient::initialize_client` set the
/// WASAPI loopback flag internally; passing `Render` for both, or `Render`
/// as `stream_direction`, fails with AUDCLNT_E_UNSUPPORTED_FORMAT regardless
/// of the requested format. For the microphone, both are plain `Capture`.
/// Signals readiness (or the startup error) back over `ready`, then pulls
/// samples into `buf` until `STOP_FLAG` is set.
fn capture_loop(
    device_direction: Direction,
    stream_direction: Direction,
    buf: &'static Mutex<ChannelBuffer>,
    ready: mpsc::Sender<Result<(), String>>,
) {
    let outcome = (|| -> Result<(), String> {
        wasapi::initialize_mta().ok().map_err(|e| e.to_string())?;

        let enumerator = DeviceEnumerator::new().map_err(|e| e.to_string())?;
        let device = enumerator
            .get_default_device(&device_direction)
            .map_err(|e| format!("no default audio device available: {e}"))?;
        let mut audio_client = device.get_iaudioclient().map_err(|e| e.to_string())?;

        // Match the device's own channel count — WASAPI's shared-mode
        // autoconvert engine resamples and re-quantizes for us, but doesn't
        // up/down-mix the channel count, so requesting mono directly against
        // a stereo device fails with AUDCLNT_E_UNSUPPORTED_FORMAT. Downmix to
        // mono ourselves in the read loop below instead.
        let native_channels = audio_client.get_mixformat().map_err(|e| e.to_string())?.get_nchannels();
        let desired_format =
            WaveFormat::new(16, 16, &SampleType::Int, CAPTURE_SAMPLE_RATE as usize, native_channels as usize, None);
        let (_default_period, min_period) = audio_client.get_device_period().map_err(|e| e.to_string())?;
        let mode = StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: min_period };
        audio_client
            .initialize_client(&desired_format, &stream_direction, &mode)
            .map_err(|e| e.to_string())?;

        let event_handle = audio_client.set_get_eventhandle().map_err(|e| e.to_string())?;
        let capture_client = audio_client.get_audiocaptureclient().map_err(|e| e.to_string())?;

        audio_client.start_stream().map_err(|e| e.to_string())?;
        // Startup succeeded — tell start_capture() it can proceed (to the mic
        // stage, or to marking the whole session live).
        let _ = ready.send(Ok(()));

        let channels = native_channels as usize;
        let frame_bytes = channels * 2; // 16-bit samples per channel
        let mut queue: VecDeque<u8> = VecDeque::new();
        while !STOP_FLAG.load(Ordering::SeqCst) {
            if let Err(e) = capture_client.read_from_device_to_deque(&mut queue) {
                eprintln!("[audio] read_from_device_to_deque failed: {e}");
                break;
            }
            if !queue.is_empty() {
                let mut guard = buf.lock().unwrap();
                // Interleaved 16-bit samples, `channels` per frame — downmix
                // to mono by averaging, since we requested the device's
                // native channel count (see the E_UNSUPPORTED_FORMAT note
                // above) rather than mono directly.
                while queue.len() >= frame_bytes {
                    let mut sum: i32 = 0;
                    for _ in 0..channels {
                        let lo = queue.pop_front().unwrap();
                        let hi = queue.pop_front().unwrap();
                        sum += i16::from_le_bytes([lo, hi]) as i32;
                    }
                    guard.pcm16.push((sum / channels as i32) as i16);
                }
            }
            let _ = event_handle.wait_for_event(EVENT_TIMEOUT_MS);
        }

        let _ = audio_client.stop_stream();
        Ok(())
    })();

    if let Err(e) = outcome {
        let _ = ready.send(Err(e));
    }
}

/// Interleaves two mono 16-bit PCM streams into a stereo WAV — left channel
/// is system audio, right channel is the microphone. Whichever stream is
/// shorter is padded with silence so lengths always match.
fn make_stereo_wav(system: &[i16], mic: &[i16]) -> Vec<u8> {
    let total_samples = system.len().max(mic.len());
    let mut pcm = Vec::with_capacity(total_samples * 2 * std::mem::size_of::<i16>());
    for i in 0..total_samples {
        let s = system.get(i).copied().unwrap_or(0);
        let m = mic.get(i).copied().unwrap_or(0);
        pcm.extend_from_slice(&s.to_le_bytes());
        pcm.extend_from_slice(&m.to_le_bytes());
    }
    make_wav_file(&pcm, CAPTURE_SAMPLE_RATE, 2)
}

fn make_wav_file(pcm16_bytes: &[u8], sample_rate: u32, channels: u16) -> Vec<u8> {
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * channels as u32 * (bits_per_sample as u32 / 8);
    let block_align = channels * (bits_per_sample / 8);
    let data_size = pcm16_bytes.len() as u32;
    let riff_chunk_size = 36 + data_size;

    let mut file = Vec::with_capacity(44 + pcm16_bytes.len());
    file.extend_from_slice(b"RIFF");
    file.extend_from_slice(&riff_chunk_size.to_le_bytes());
    file.extend_from_slice(b"WAVE");
    file.extend_from_slice(b"fmt ");
    file.extend_from_slice(&16u32.to_le_bytes());
    file.extend_from_slice(&1u16.to_le_bytes()); // PCM
    file.extend_from_slice(&channels.to_le_bytes());
    file.extend_from_slice(&sample_rate.to_le_bytes());
    file.extend_from_slice(&byte_rate.to_le_bytes());
    file.extend_from_slice(&block_align.to_le_bytes());
    file.extend_from_slice(&bits_per_sample.to_le_bytes());
    file.extend_from_slice(b"data");
    file.extend_from_slice(&data_size.to_le_bytes());
    file.extend_from_slice(pcm16_bytes);
    file
}
