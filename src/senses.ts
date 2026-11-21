// Merlin's senses: reacting to what's happening on your PC.
// The Rust side does the detecting and sends events; we just pick moods.

import { listen } from "@tauri-apps/api/event";
import { getMood, onMoodChange, setMood } from "./mood";

/** Matches the NowPlaying struct in src-tauri/src/music.rs. */
interface NowPlaying {
  playing: boolean;
  title: string;
  artist: string;
  app: string;
}

let musicPlaying = false;

/** Vibe when music is on; calm down when it stops. Never interrupts other moods. */
function updateMusicMood(): void {
  const mood = getMood();
  if (musicPlaying && mood === "idle") setMood("vibing");
  else if (!musicPlaying && mood === "vibing") setMood("idle");
}

export async function initSenses(): Promise<void> {
  await listen<NowPlaying>("now-playing", ({ payload }) => {
    musicPlaying = payload.playing;
    updateMusicMood();
  });

  // When he finishes something else (talking, being dizzy…) and goes idle,
  // jump straight back into vibing if the music is still on.
  onMoodChange((mood) => {
    if (mood === "idle") updateMusicMood();
  });
}
