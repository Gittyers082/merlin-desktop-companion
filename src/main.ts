import { getCurrentWindow } from "@tauri-apps/api/window";
import { buildFire } from "./fire";
import { setMood, type Mood } from "./mood";
import { initEmotes } from "./emotes";
import { summon, despawn, resummon } from "./lifecycle";

buildFire();
initEmotes();
summon();

// Hold left click anywhere on Merlin to move his window around.
// (Later we'll swap this for our own drag so we can throw him.)
const stage = document.querySelector<HTMLElement>("#stage")!;
stage.addEventListener("mousedown", (event) => {
  if (event.button === 0) getCurrentWindow().startDragging();
});

// Dev only: click Merlin, then press 1–7 to preview his moods,
// or 9 to despawn him and summon him back.
if (import.meta.env.DEV) {
  const preview: Mood[] = [
    "idle",
    "vibing",
    "thinking",
    "sleepy",
    "confused",
    "happy",
    "raging",
  ];
  window.addEventListener("keydown", async (event) => {
    if (event.key === "9") {
      await despawn();
      setTimeout(resummon, 800);
      return;
    }
    const mood = preview[Number(event.key) - 1];
    if (mood) setMood(mood);
  });
}
