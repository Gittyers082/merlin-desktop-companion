// Merlin's senses: reacting to what's happening on your PC.
// The Rust side does the detecting and sends events; here we decide
// which "background" mood fits: idle, vibing, sleepy or raging.

import { listen } from "@tauri-apps/api/event";
import { getMood, onMoodChange, setMood, type Mood } from "./mood";
import { loadSettings, onSettingsChange } from "./settings";

/** Matches the NowPlaying struct in src-tauri/src/music.rs. */
interface NowPlaying {
  playing: boolean;
  title: string;
  artist: string;
  app: string;
}

/** Matches the PcStatus struct in src-tauri/src/pc.rs. */
interface PcStatus {
  idleSeconds: number;
  cpu: number;
}

/** He calms down this many % below the rage threshold. */
const CALM_MARGIN = 20;
/** How many hot readings in a row (2s apart) before he actually rages. */
const RAGE_AFTER_TICKS = 3;
/** Media from these apps counts as "video", not music (matched case-insensitively).
 *  308046B0AF4A39CB is how Windows identifies Firefox. */
const BROWSERS = [
  "chrome",
  "msedge",
  "firefox",
  "308046b0af4a39cb",
  "opera",
  "brave",
  "vivaldi",
];

/** Moods the senses are allowed to switch between. Everything else
 *  (summon, talking, being thrown…) is never interrupted. */
const AMBIENT: Mood[] = ["idle", "vibing", "sleepy", "raging"];

let settings = loadSettings();
let lastMedia: NowPlaying | null = null;
const state = {
  idleSeconds: 0,
  hot: false,
  hotTicks: 0,
};
let pausedUntil = 0;

const isBrowser = (app: string) =>
  BROWSERS.some((name) => app.toLowerCase().includes(name));

/** Is something playing that he should vibe to, given the settings? */
function hearsMusic(): boolean {
  if (!settings.music || !lastMedia?.playing) return false;
  return settings.musicSource === "anything" || !isBrowser(lastMedia.app);
}

/** Which background mood fits right now, most important first. */
function ambientMood(): Mood {
  if (settings.rage && state.hot) return "raging";
  if (settings.sleep && state.idleSeconds >= settings.sleepAfterMin * 60)
    return "sleepy";
  if (hearsMusic()) return "vibing";
  return "idle";
}

function update(): void {
  if (Date.now() < pausedUntil) return;
  const mood = getMood();
  if (!AMBIENT.includes(mood)) return;
  const wanted = ambientMood();
  if (wanted !== mood) setMood(wanted);
}

/** Stops the senses from changing his mood for a while (used by the dev keys). */
export function pauseSenses(ms: number): void {
  pausedUntil = Date.now() + ms;
}

export async function initSenses(): Promise<void> {
  await listen<NowPlaying>("now-playing", ({ payload }) => {
    lastMedia = payload;
    update();
  });

  await listen<PcStatus>("pc-status", ({ payload }) => {
    state.idleSeconds = payload.idleSeconds;

    // Hysteresis: get hot only after several hot readings, cool down only
    // well below the limit, so he doesn't flicker in and out of rage.
    state.hotTicks = payload.cpu >= settings.rageCpu ? state.hotTicks + 1 : 0;
    if (state.hotTicks >= RAGE_AFTER_TICKS) state.hot = true;
    if (payload.cpu < settings.rageCpu - CALM_MARGIN) state.hot = false;

    update();
  });

  // New settings from the Settings window apply immediately.
  await onSettingsChange((next) => {
    settings = next;
    update();
  });

  // When he finishes something else (talking, being dizzy…) and goes idle,
  // switch straight to whatever background mood fits.
  onMoodChange((mood) => {
    if (mood === "idle") update();
  });
}
