//! Merlin's ears: notices when something is playing anywhere on Windows —
//! Spotify, YouTube in a browser, anything that shows up in the
//! Windows media overlay — and tells the front end.

use serde::Serialize;
use tauri::AppHandle;

/// What's playing right now. Sent to the front end as the "now-playing" event.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
    pub playing: bool,
    pub title: String,
    pub artist: String,
    /// The app that's playing, e.g. "Spotify.exe".
    pub app: String,
}

#[cfg(windows)]
pub fn start(app: AppHandle) {
    use std::time::Duration;
    use tauri::async_runtime::block_on;
    use tauri::Emitter;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager as SessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
    };

    /// How often we check. Music doesn't need split-second reactions.
    const POLL: Duration = Duration::from_secs(2);

    /// Looks through every media session for one that's actually playing.
    fn read(manager: &SessionManager) -> windows::core::Result<NowPlaying> {
        let sessions = manager.GetSessions()?;
        for i in 0..sessions.Size()? {
            let session = sessions.GetAt(i)?;
            if session.GetPlaybackInfo()?.PlaybackStatus()? != PlaybackStatus::Playing {
                continue;
            }
            let props = block_on(async { session.TryGetMediaPropertiesAsync()?.await })?;
            return Ok(NowPlaying {
                playing: true,
                title: props.Title()?.to_string(),
                artist: props.Artist()?.to_string(),
                app: session.SourceAppUserModelId()?.to_string(),
            });
        }
        Ok(NowPlaying::default())
    }

    // Windows media APIs are blocking-ish, so they get their own thread.
    std::thread::spawn(move || {
        let manager = match block_on(async { SessionManager::RequestAsync()?.await }) {
            Ok(manager) => manager,
            Err(error) => {
                eprintln!("Merlin can't hear music on this PC: {error}");
                return;
            }
        };

        loop {
            let now = read(&manager).unwrap_or_default();
            // Sent every tick (it's tiny) so a freshly reloaded page always catches up.
            let _ = app.emit("now-playing", &now);
            std::thread::sleep(POLL);
        }
    });
}

/// Other platforms: no ears yet.
#[cfg(not(windows))]
pub fn start(_app: AppHandle) {}