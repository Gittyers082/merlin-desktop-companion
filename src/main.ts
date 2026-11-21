import { buildFire } from "./fire";
import { setMood, type Mood } from "./mood";
import { initEmotes } from "./emotes";
import { summon, despawn, resummon } from "./lifecycle";
import { initDrag } from "./drag";
import { initCursorWatch } from "./cursor";
import { initContextMenu } from "./menu";
import { initTray } from "./tray";
import { initChat } from "./chat";

buildFire();
initEmotes();
summon();

// Click Merlin (or pick "Talk to Merlin") to chat.
const chat = initChat();
const openChat = () => chat.open();

// Drag Merlin around, or fling him. A plain click opens chat.
const drag = initDrag(openChat);

// Eyes follow your cursor; clicks pass through the space around him.
initCursorWatch(drag.isBusy);

// Right-click menu and system tray icon.
initContextMenu(openChat);
initTray();

// Dev only: click Merlin, then press 1–7 to preview his moods,
// 8 to make him dizzy, or 9 to despawn and summon him again.
if (import.meta.env.DEV) {
  const preview: Mood[] = [
    "idle",
    "vibing",
    "thinking",
    "sleepy",
    "confused",
    "happy",
    "raging",
    "dizzy",
  ];
  window.addEventListener("keydown", async (event) => {
    if (event.target instanceof HTMLInputElement) return; // typing to Merlin, not testing
    if (event.key === "9") {
      await despawn();
      setTimeout(resummon, 800);
      return;
    }
    const mood = preview[Number(event.key) - 1];
    if (mood) setMood(mood);
  });
}
