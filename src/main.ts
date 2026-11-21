import { buildFire } from "./fire";
import { setMood, type Mood } from "./mood";
import { initEmotes } from "./emotes";
import { summon, despawn, resummon } from "./lifecycle";
import { initDrag } from "./drag";
import { initCursorWatch } from "./cursor";

buildFire();
initEmotes();
summon();
initCursorWatch();

// Drag Merlin around, or fling him. A plain click will open chat later.
initDrag(() => {
  // TODO: open the chat bubble
});

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
    if (event.key === "9") {
      await despawn();
      setTimeout(resummon, 800);
      return;
    }
    const mood = preview[Number(event.key) - 1];
    if (mood) setMood(mood);
  });
}
