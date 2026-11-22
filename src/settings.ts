// Settings shared by Merlin's window and the Settings window. They're saved
// in localStorage (shared by both windows) and broadcast as a Tauri event so
// the other window picks them up immediately.

import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface Settings {
  music: boolean;
  /** "music-apps" ignores browsers (so YouTube videos don't count). */
  musicSource: "music-apps" | "anything";
  sleep: boolean;
  sleepAfterMin: number;
  rage: boolean;
  rageCpu: number;
  provider: "ollama" | "claude";
  ollamaModel: string;
  claudeModel: string;
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

/** Saved settings, with defaults filling any gaps (e.g. newly added settings). */
export function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...(saved ? JSON.parse(saved) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  await emit(CHANGED_EVENT, settings);
}

/** Fires whenever any window saves new settings. */
export function onSettingsChange(
  listener: (settings: Settings) => void,
): Promise<UnlistenFn> {
  return listen<Settings>(CHANGED_EVENT, ({ payload }) => listener(payload));
}
