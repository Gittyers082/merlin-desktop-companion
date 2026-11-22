// Merlin's entrances and exits.

import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import { setMood } from "./mood";
import { wait } from "./utils";

const win = getCurrentWindow();

/** Must match the animation lengths in styles.css. */
const SUMMON_MS = 3600;
const DESPAWN_MS = 2400;

/** Plays the summoning ritual, then settles into idle. */
export async function summon(): Promise<void> {
  await win.setSkipTaskbar(true);
  setMood("summon");
  await wait(SUMMON_MS);
  setMood("idle");
}

/** Sinks Merlin back into his magic circle, then hides the window. */
export async function despawn(): Promise<void> {
  setMood("despawn");
  await wait(DESPAWN_MS);
  await win.hide();
}

export async function resummon(): Promise<void> {
  await win.show();
  await summon();
}

/** A dignified exit: sink into the circle, then close the app. */
export async function quit(): Promise<void> {
  if (await win.isVisible()) await despawn();
  await exit(0);
}
