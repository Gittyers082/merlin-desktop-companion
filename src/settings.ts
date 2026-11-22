// Merlin's settings, shared by his window and the Settings window.
// Saved in localStorage (both windows share it), and broadcast as a
// Tauri event so the other window updates straight away.

import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface Settings {
  /** Vibe when music plays. */
  music: boolean;
  /** "music-apps" ignores browsers (YouTube videos), "anything" vibes to all media. */
  musicSource: "music-apps" | "anything";
  /** Fall asleep when you're away. */
  sleep: boolean;
  sleepAfterMin: number;
  /** Rage when the CPU is maxed. */
  rage: boolean;
  rageCpu: number;
  /** Which brain answers when you talk to him. */
  provider: "ollama" | "claude";
  ollamaModel: string;
  claudeModel: string;

  /** Play sound effects. */
  sounds: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  music: true,
  musicSource: "music-apps",
  sleep: true,
  sleepAfterMin: 5,
  rage: true,
  rageCpu: 90,
  provider: "ollama",
  ollamaModel: "llama3.2",
  claudeModel: "claude-haiku-5-5",
  sounds: true,
};

const STORAGE_KEY = "merlin.settings";
const CHANGED_EVENT = "settings-changed";

/** Reads the saved settings, filling any gaps with the defaults. */
export function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...(saved ? JSON.parse(saved) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Saves the settings and tells every window about them. */
export async function saveSettings(settings: Settings): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  await emit(CHANGED_EVENT, settings);
}

/** Runs `listener` whenever any window saves new settings. */
export function onSettingsChange(
  listener: (settings: Settings) => void,
): Promise<UnlistenFn> {
  return listen<Settings>(CHANGED_EVENT, ({ payload }) => listener(payload));
}
