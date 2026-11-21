// Merlin's mood state machine.
// A mood is just a class on #stage (e.g. "mood-vibing"). CSS reads that
// class and swaps his animations; other modules can listen for changes.

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

const stage = document.querySelector<HTMLElement>("#stage")!;
const listeners = new Set<Listener>();

// Start in whatever mood index.html puts on #stage (he wakes up summoning).
let current = (Array.from(stage.classList)
  .find((c) => c.startsWith("mood-"))
  ?.slice(5) ?? "idle") as Mood;

export function getMood(): Mood {
  return current;
}

export function setMood(mood: Mood): void {
  if (mood === current) return;
  const previous = current;
  stage.classList.replace(`mood-${previous}`, `mood-${mood}`);
  current = mood;
  listeners.forEach((listener) => listener(mood, previous));
}

/** Runs `listener` every time the mood changes. Returns an unsubscribe function. */
export function onMoodChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
