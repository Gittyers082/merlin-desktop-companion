// Merlin's system tray icon: left-click summons him or sends him away,
// right-click opens the menu.

import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { despawn, quit, resummon } from "./lifecycle";
import { openSettings } from "./open-settings";

/** Held for the app's lifetime so the icon is never released. */
let tray: TrayIcon | null = null;
let toggling = false;

async function toggle(): Promise<void> {
  if (toggling) return;
  toggling = true;
  try {
    if (await getCurrentWindow().isVisible()) await despawn();
    else await resummon();
  } finally {
    toggling = false;
  }
}

export async function initTray(): Promise<void> {
  if (tray) return;

  const menu = await Menu.new({
    items: [
      { id: "settings", text: "Settings…", action: () => void openSettings() },
      { id: "toggle", text: "Summon / send away", action: () => void toggle() },
      { item: "Separator" },
      { id: "quit", text: "Quit Merlin", action: () => void quit() },
    ],
  });

  tray = await TrayIcon.new({
    id: "merlin",
    icon: (await defaultWindowIcon()) ?? undefined,
    tooltip: "Merlin",
    menu,
    showMenuOnLeftClick: false,
    action: (event) => {
      const leftClickReleased =
        event.type === "Click" &&
        event.button === "Left" &&
        event.buttonState === "Up";
      if (leftClickReleased) void toggle();
    },
  });
}
