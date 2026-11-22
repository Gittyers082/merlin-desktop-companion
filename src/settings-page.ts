// The Settings window: fills the form from the saved settings, saves on
// every change, and manages the Claude API key and autostart.

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from "./settings";
import { element } from "./utils";

const form = element<HTMLFormElement>("#settings");
const sleepLabel = element<HTMLElement>("#sleep-value");
const rageLabel = element<HTMLElement>("#rage-value");
const keyInput = element<HTMLInputElement>("#claude-key");
const keyStatus = element<HTMLElement>("#key-status");
const saveKeyButton = element<HTMLButtonElement>("#save-key");
const removeKeyButton = element<HTMLButtonElement>("#remove-key");
const autostart = element<HTMLInputElement>("#autostart");

/** Puts saved values into the form controls, matched by their `name`. */
function fill(settings: Settings): void {
  for (const control of Array.from(form.elements)) {
    const isField =
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement;
    if (!isField || !(control.name in settings)) continue;

    const value = settings[control.name as keyof Settings];
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      control.checked = Boolean(value);
    } else if (
      control instanceof HTMLInputElement &&
      control.type === "radio"
    ) {
      control.checked = control.value === value;
    } else {
      control.value = String(value);
    }
  }
}

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
    sounds: data.has("sounds"),
  };
}

/** Updates the slider labels and shows the section for the chosen brain. */
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

const initial = loadSettings();
fill(initial);
refreshLabels(initial);
void refreshKeyStatus();

// "input" also fires while a slider is being dragged.
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

// Autostart is stored by Windows itself, so ask it rather than keeping a copy.
void isEnabled().then((enabled) => {
  autostart.checked = enabled;
});
autostart.addEventListener("change", async () => {
  if (autostart.checked) await enable();
  else await disable();
});

// Closing only hides the window, so it reopens instantly.
const win = getCurrentWindow();
void win.onCloseRequested(async (event) => {
  event.preventDefault();
  await win.hide();
});
