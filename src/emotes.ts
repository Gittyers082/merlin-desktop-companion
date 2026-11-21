// The little bubble above Merlin's head ("?", "!", "♪"…).
// Notes, z's and thinking dots are plain HTML that CSS shows per mood.

import { onMoodChange, type Mood } from "./mood";

const EMOTES: Partial<Record<Mood, string>> = {
  vibing: "♪",
  confused: "?",
  happy: "!",
  startled: "!!",
  raging: "#!$%",
};

export function initEmotes(): void {
  const bubble = document.querySelector<HTMLElement>("#emote");
  if (!bubble) return;

  onMoodChange((mood) => {
    const text = EMOTES[mood];
    bubble.textContent = text ?? "";
    bubble.classList.remove("show");
    if (text) {
      // Force a reflow so the pop-in animation restarts every time.
      void bubble.offsetWidth;
      bubble.classList.add("show");
    }
  });
}
