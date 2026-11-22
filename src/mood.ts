// Merlin's mood is a class on #stage (e.g. "mood-vibing"). CSS swaps his
// animations based on it, and other modules subscribe to changes.

import { element } from "./utils";

export type Mood =
  | "summon"
  | "despawn"
  | "idle"
  | "vibing"
  | "talking"
  | "thinking"
  | "sleepy"
  | "confused"
  | "happy"
  | "startled"
  | "flying"
  | "dizzy"
  | "raging";

type Listener = (mood: Mood, previous: Mood) => void;

const PREFIX = "mood-";
const stage = element<HTMLElement>("#stage");
const listeners = new Set<Listener>();

// Start in whatever mood index.html declares (he wakes up summoning).
let current = (Array.from(stage.classList)
  .find((name) => name.startsWith(PREFIX))
  ?.slice(PREFIX.length) ?? "idle") as Mood;

export function getMood(): Mood {
  return current;
}

export function setMood(mood: Mood): void {
  if (mood === current) return;
  const previous = current;
  stage.classList.replace(PREFIX + previous, PREFIX + mood);
  current = mood;
  listeners.forEach((listener) => listener(mood, previous));
}

/** Returns an unsubscribe function. */
export function onMoodChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
