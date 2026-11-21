// Merlin's icon in the system tray (bottom-right of the taskbar).
// Left-click to summon him or send him away; right-click for the menu.

import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { despawn, resummon, quit } from "./lifecycle";

// Keep a reference so the tray icon isn't garbage-collected.
let tray: TrayIcon | undefined;
let busy = false;

/** Summons Merlin if he's hidden, sends him away if he's out. */
async function toggle(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    if (await getCurrentWindow().isVisible()) await despawn();
    else await resummon();
  } finally {
    busy = false;
  }
}

export async function initTray(): Promise<void> {
  const menu = await Menu.new({
    items: [
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
      if (
        event.type === "Click" &&
        event.button === "Left" &&
        event.buttonState === "Up"
      ) {
        void toggle();
      }
    },
  });
}

export function getTray(): TrayIcon | undefined {
  return tray;
}
