use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        build_audio_bridge();
    }

    tauri_build::build()
}

/// Compiles the native/audio_capture.swift ScreenCaptureKit bridge into a
/// static library and links it into the Rust binary. macOS-only — the
/// Windows equivalent (WASAPI loopback) isn't implemented yet, so this is
/// skipped entirely off macOS rather than half-wired.
fn build_audio_bridge() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let native_dir = manifest_dir.join("native");
    let swift_source = native_dir.join("audio_capture.swift");
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let lib_path = out_dir.join("libsealme_audio.a");

    println!("cargo:rerun-if-changed={}", swift_source.display());

    let status = Command::new("swiftc")
        .arg("-emit-library")
        .arg("-static")
        .arg("-O")
        .arg("-module-name")
        .arg("sealme_audio")
        .arg("-o")
        .arg(&lib_path)
        .arg(&swift_source)
        .status()
        .expect("failed to invoke swiftc — is the Swift toolchain installed?");

    if !status.success() {
        panic!("swiftc failed to build the audio capture bridge");
    }

    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static=sealme_audio");

    println!("cargo:rustc-link-search=native=/usr/lib/swift");
    for swift_lib in ["swiftCore", "swiftFoundation", "swiftDispatch", "swiftDarwin", "swiftObjectiveC"] {
        println!("cargo:rustc-link-lib=dylib={swift_lib}");
    }

    for framework in ["ScreenCaptureKit", "AVFoundation", "CoreMedia", "Foundation", "CoreAudio"] {
        println!("cargo:rustc-link-lib=framework={framework}");
    }
}
