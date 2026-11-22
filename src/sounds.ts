// Merlin's sound effects, synthesized live with the Web Audio API: just
// oscillators and filtered noise, so there are no audio files to license.

import { onMoodChange, type Mood } from "./mood";
import { loadSettings, onSettingsChange } from "./settings";

const MASTER_VOLUME = 0.6;
const BABBLE_GAP_MS = 75;

let enabled = loadSettings().sounds;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lastBabble = 0;

/** Created lazily on first use. */
function audio(): { ctx: AudioContext; out: GainNode } {
  if (!ctx || !master) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: master };
}

interface ToneOptions {
  freq: number;
  /** Slide to this pitch by the end. */
  to?: number;
  start?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
}

/** A single note with a quick fade in and out. */
function tone({
  freq,
  to,
  start = 0,
  dur,
  type = "sine",
  vol = 0.15,
}: ToneOptions): void {
  const { ctx, out } = audio();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

interface WhooshOptions {
  /** Filter sweep, in Hz. Rising sounds magical; falling sounds like snuffing out. */
  from: number;
  to: number;
  start?: number;
  dur: number;
  vol?: number;
}

/** Filtered white noise sweeping through pitch: whooshes and fire. */
function whoosh({ from, to, start = 0, dur, vol = 0.12 }: WhooshOptions): void {
  const { ctx, out } = audio();
  const t = ctx.currentTime + start;

  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  noise.connect(filter).connect(gain).connect(out);
  noise.start(t);
  noise.stop(t + dur + 0.05);
}

/** A quick run of notes. */
function chime(notes: number[], start = 0, gap = 0.08): void {
  notes.forEach((freq, i) =>
    tone({
      freq,
      start: start + i * gap,
      dur: 0.5,
      type: "triangle",
      vol: 0.07,
    }),
  );
}

/** C5, E5, G5, C6 in Hz: a bright major arpeggio. */
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5];

/** One sound per mood change, timed to line up with the CSS animations. */
const MOOD_SOUNDS: Partial<Record<Mood, () => void>> = {
  summon: () => {
    whoosh({ from: 400, to: 3000, dur: 1.2 });
    chime(ARPEGGIO, 1.1);
    tone({ freq: 110, to: 45, start: 1.75, dur: 0.45, vol: 0.25 }); // fire ignites
    whoosh({ from: 2200, to: 300, start: 1.75, dur: 0.5, vol: 0.1 });
  },
  despawn: () => {
    chime([...ARPEGGIO].reverse(), 0.1);
    whoosh({ from: 2500, to: 200, start: 0.75, dur: 0.5 }); // fire snuffs out
    tone({ freq: 90, to: 40, start: 1.2, dur: 0.4, vol: 0.2 });
  },
  startled: () =>
    tone({ freq: 300, to: 900, dur: 0.15, type: "square", vol: 0.05 }),
  happy: () => chime([783.99, 987.77, 1174.66, 1567.98], 0, 0.06),
  dizzy: () => {
    tone({ freq: 800, to: 500, dur: 0.25, vol: 0.08 });
    tone({ freq: 700, to: 400, start: 0.22, dur: 0.25, vol: 0.08 });
    tone({ freq: 600, to: 300, start: 0.44, dur: 0.35, vol: 0.08 });
  },
  raging: () => {
    tone({ freq: 70, to: 50, dur: 0.7, type: "sawtooth", vol: 0.06 });
    whoosh({ from: 300, to: 150, dur: 0.7, vol: 0.15 });
  },
};

/** A tiny bone-clack blip per chunk of speech, rate-limited. */
export function babble(): void {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastBabble < BABBLE_GAP_MS) return;
  lastBabble = now;
  tone({
    freq: 220 + Math.random() * 160,
    dur: 0.05,
    type: "triangle",
    vol: 0.04,
  });
}

export function initSounds(): void {
  onMoodChange((mood) => {
    if (enabled) MOOD_SOUNDS[mood]?.();
  });
  onSettingsChange((settings) => {
    enabled = settings.sounds;
  });
  // He starts mid-summon, before any mood change, so play that sound now.
  if (enabled) MOOD_SOUNDS.summon?.();
}
