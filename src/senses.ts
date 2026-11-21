// Merlin's senses: reacting to what's happening on your PC.
// The Rust side does the detecting and sends events; here we decide
// which "background" mood fits: idle, vibing, sleepy or raging.

import { listen } from "@tauri-apps/api/event";
import { getMood, onMoodChange, setMood, type Mood } from "./mood";

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

/** Fall asleep after this long without mouse or keyboard input. */
const SLEEP_AFTER_S = 60;
/** CPU % that makes him start raging, and the % he calms down below. */
const RAGE_CPU = 90;
const CALM_CPU = 70;
/** How many hot readings in a row (2s apart) before he actually rages. */
const RAGE_AFTER_TICKS = 3;

/** Moods the senses are allowed to switch between. Everything else
 *  (summon, talking, being thrown…) is never interrupted. */
const AMBIENT: Mood[] = ["idle", "vibing", "sleepy", "raging"];

const state = {
  music: false,
  idleSeconds: 0,
  hot: false,
  hotTicks: 0,
};
let pausedUntil = 0;

/** Which background mood fits right now, most important first. */
function ambientMood(): Mood {
  if (state.hot) return "raging";
  if (state.idleSeconds >= SLEEP_AFTER_S) return "sleepy";
  if (state.music) return "vibing";
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
    state.music = payload.playing;
    update();
  });

  await listen<PcStatus>("pc-status", ({ payload }) => {
    state.idleSeconds = payload.idleSeconds;

    // Hysteresis: get hot only after several hot readings, cool down only
    // well below the limit, so he doesn't flicker in and out of rage.
    state.hotTicks = payload.cpu >= RAGE_CPU ? state.hotTicks + 1 : 0;
    if (state.hotTicks >= RAGE_AFTER_TICKS) state.hot = true;
    if (payload.cpu < CALM_CPU) state.hot = false;

    update();
  });

  // When he finishes something else (talking, being dizzy…) and goes idle,
  // switch straight to whatever background mood fits.
  onMoodChange((mood) => {
    if (mood === "idle") update();
  });
}
