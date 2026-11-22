import { Window } from "@tauri-apps/api/window";

/** Opens the Settings window, or brings it to the front. */
export async function openSettings(): Promise<void> {
  const settings = await Window.getByLabel("settings");
  if (!settings) return;
  await settings.show();
  await settings.unminimize();
  await settings.setFocus();
}
