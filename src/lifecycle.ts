// Merlin's entrances and exits.

import { getCurrentWindow } from "@tauri-apps/api/window";
import { setMood } from "./mood";
import { exit } from "@tauri-apps/plugin-process";

/** Must match the animation lengths in styles.css. */
const SUMMON_MS = 3600;
const DESPAWN_MS = 2400;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Plays the summoning ritual, then settles into idle. */
export async function summon(): Promise<void> {
  setMood("summon");
  await wait(SUMMON_MS);
  setMood("idle");
}

/** Sinks Merlin back into his magic circle, then hides the window. */
export async function despawn(): Promise<void> {
  setMood("despawn");
  await wait(DESPAWN_MS);
  await getCurrentWindow().hide();
}

/** Brings a hidden Merlin back with a fresh summon. */
export async function resummon(): Promise<void> {
  await getCurrentWindow().show();
  await summon();
}

/** A dignified exit: sink into the circle, then close the app. */
export async function quit(): Promise<void> {
  if (await getCurrentWindow().isVisible()) await despawn();
  await exit(0);
}
