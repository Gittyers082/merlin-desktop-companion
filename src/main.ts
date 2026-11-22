import { initChat } from "./chat";
import { initCursorWatch } from "./cursor";
import { initDrag } from "./drag";
import { initEmotes } from "./emotes";
import { buildFire } from "./fire";
import { despawn, resummon, summon } from "./lifecycle";
import { initContextMenu } from "./menu";
import { setMood, type Mood } from "./mood";
import { initSenses, pauseSenses } from "./senses";
import { initSounds } from "./sounds";
import { initTray } from "./tray";

buildFire();
initEmotes();
initSounds();
void summon();

const chat = initChat();
const openChat = () => chat.open();
const drag = initDrag(openChat);

initCursorWatch(drag.isBusy);
void initContextMenu(openChat);
void initTray();
void initSenses();

if (import.meta.env.DEV) initDevKeys();

/**
 * Dev builds only: click Merlin, then press 1–8 to preview a mood,
 * or 9 to despawn and re-summon him.
 */
function initDevKeys(): void {
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
  const PREVIEW_MS = 15000;
  const RESUMMON_DELAY_MS = 800;

  window.addEventListener("keydown", async (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "9") {
      await despawn();
      setTimeout(resummon, RESUMMON_DELAY_MS);
      return;
    }
    const mood = preview[Number(event.key) - 1];
    if (!mood) return;
    pauseSenses(PREVIEW_MS);
    setMood(mood);
  });
}
