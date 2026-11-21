// The Settings window: fills the form from the saved settings, saves on
// every change, and manages the Claude API key through Rust.

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from "./settings";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

const form = document.querySelector<HTMLFormElement>("#settings")!;
const sleepLabel = document.querySelector<HTMLElement>("#sleep-value")!;
const rageLabel = document.querySelector<HTMLElement>("#rage-value")!;
const keyInput = document.querySelector<HTMLInputElement>("#claude-key")!;
const keyStatus = document.querySelector<HTMLElement>("#key-status")!;
const saveKeyButton = document.querySelector<HTMLButtonElement>("#save-key")!;
const removeKeyButton =
  document.querySelector<HTMLButtonElement>("#remove-key")!;

/** Puts saved values into the form controls (matched by their `name`). */
function fill(settings: Settings): void {
  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement
      )
    )
      continue;
    if (!(element.name in settings)) continue;
    const value = settings[element.name as keyof Settings];
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.checked = Boolean(value);
    } else if (
      element instanceof HTMLInputElement &&
      element.type === "radio"
    ) {
      element.checked = element.value === value;
    } else {
      element.value = String(value);
    }
  }
}

/** Reads the form back into a Settings object. */
function read(): Settings {
  const data = new FormData(form);
  return {
    music: data.has("music"),
    musicSource: data.get("musicSource") as Settings["musicSource"],
    sleep: data.has("sleep"),
    sleepAfterMin: Number(data.get("sleepAfterMin")),
    rage: data.has("rage"),
    rageCpu: Number(data.get("rageCpu")),
    provider: data.get("provider") as Settings["provider"],
    ollamaModel:
      String(data.get("ollamaModel")).trim() || DEFAULT_SETTINGS.ollamaModel,
    claudeModel: String(data.get("claudeModel")),
  };
}

/** Updates the little value labels and shows the right brain section. */
function refreshLabels(settings: Settings): void {
  sleepLabel.textContent = `${settings.sleepAfterMin} min`;
  rageLabel.textContent = `${settings.rageCpu}%`;
  form.dataset.provider = settings.provider;
}

async function refreshKeyStatus(): Promise<void> {
  const hasKey = await invoke<boolean>("has_claude_key");
  keyStatus.textContent = hasKey
    ? "Key saved in Windows Credential Manager."
    : "No key saved yet.";
  removeKeyButton.hidden = !hasKey;
}

// Start with what's saved.
const initial = loadSettings();
fill(initial);
refreshLabels(initial);
refreshKeyStatus();

// Save on every change. "input" fires while dragging sliders, too.
form.addEventListener("input", () => {
  const settings = read();
  refreshLabels(settings);
  void saveSettings(settings);
});
form.addEventListener("submit", (event) => event.preventDefault());

saveKeyButton.addEventListener("click", async () => {
  try {
    await invoke("save_claude_key", { key: keyInput.value });
    keyInput.value = "";
    await refreshKeyStatus();
  } catch (error) {
    keyStatus.textContent = String(error);
  }
});

removeKeyButton.addEventListener("click", async () => {
  await invoke("delete_claude_key");
  await refreshKeyStatus();
});

// Closing the window just hides it, so it opens instantly next time.
const win = getCurrentWindow();
win.onCloseRequested(async (event) => {
  event.preventDefault();
  await win.hide();
});

// "Start with Windows" lives in Windows itself, not in our settings.
const autostart = document.querySelector<HTMLInputElement>("#autostart")!;
isEnabled().then((enabled) => (autostart.checked = enabled));
autostart.addEventListener("change", async () => {
  if (autostart.checked) await enable();
  else await disable();
});
