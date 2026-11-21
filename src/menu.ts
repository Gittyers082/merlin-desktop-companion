// Right-click Merlin for his menu.

import { Menu } from "@tauri-apps/api/menu";
import { despawn, quit } from "./lifecycle";
import { openSettings } from "./open-settings";

export async function initContextMenu(onTalk: () => void): Promise<void> {
  const menu = await Menu.new({
    items: [
      { id: "talk", text: "Talk to Merlin", action: onTalk },
      { id: "settings", text: "Settings…", action: () => void openSettings() },
      { item: "Separator" },
      { id: "hide", text: "Send him away", action: () => void despawn() },
      { id: "quit", text: "Quit", action: () => void quit() },
    ],
  });

  window.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    menu.popup();
  });
}
