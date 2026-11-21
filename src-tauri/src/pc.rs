//! Merlin's sense of your PC: how long you've been away from the
//! keyboard and mouse, and how hard the CPU is working.

use serde::Serialize;
use std::time::Duration;
use sysinfo::System;
use tauri::{AppHandle, Emitter};

/// Sent to the front end as the "pc-status" event.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PcStatus {
    /// Seconds since the last mouse or keyboard input.
    pub idle_seconds: u64,
    /// Overall CPU usage, 0–100.
    pub cpu: f32,
}

const POLL: Duration = Duration::from_secs(2);

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new();
        loop {
            // CPU usage is measured between two refreshes, so the first reading is 0.
            sys.refresh_cpu_usage();
            let status = PcStatus {
                idle_seconds: idle_seconds(),
                cpu: sys.global_cpu_usage(),
            };
            let _ = app.emit("pc-status", &status);
            std::thread::sleep(POLL);
        }
    });
}

/// Asks Windows when the last keyboard or mouse input happened.
#[cfg(windows)]
fn idle_seconds() -> u64 {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    unsafe {
        if !GetLastInputInfo(&mut info).as_bool() {
            return 0;
        }
        // Both are "milliseconds since boot"; wrapping_sub survives the 49-day rollover.
        u64::from(GetTickCount().wrapping_sub(info.dwTime) / 1000)
    }
}

#[cfg(not(windows))]
fn idle_seconds() -> u64 {
    0
}