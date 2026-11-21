// Merlin's entrances (and later, exits).

import { setMood } from "./mood";

/** Must match the summon animation length in styles.css. */
const SUMMON_MS = 3600;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Plays the summoning ritual, then settles into idle. */
export async function summon(): Promise<void> {
  setMood("summon");
  await wait(SUMMON_MS);
  setMood("idle");
}
