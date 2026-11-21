// Opens (or brings forward) the Settings window.

import { Window } from "@tauri-apps/api/window";

export async function openSettings(): Promise<void> {
  const settings = await Window.getByLabel("settings");
  if (!settings) return;
  await settings.show();
  await settings.unminimize();
  await settings.setFocus();
}
