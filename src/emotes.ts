// The bubble above Merlin's head. Notes, z's and thinking dots are
// plain HTML that CSS shows per mood.

import { onMoodChange, type Mood } from "./mood";
import { element } from "./utils";

const EMOTES: Partial<Record<Mood, string>> = {
  vibing: "♪",
  confused: "?",
  happy: "!",
  startled: "!!",
  raging: "#!$%",
};

export function initEmotes(): void {
  const bubble = element<HTMLElement>("#emote");

  onMoodChange((mood) => {
    const text = EMOTES[mood] ?? "";
    bubble.textContent = text;
    bubble.classList.remove("show");
    if (!text) return;
    void bubble.offsetWidth; // force a reflow so the pop-in animation restarts
    bubble.classList.add("show");
  });
}
