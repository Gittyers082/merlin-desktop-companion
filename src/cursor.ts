// Watches the mouse cursor, even outside Merlin's window,
// so his eyes can follow it around your screen.

import { getCurrentWindow, cursorPosition } from "@tauri-apps/api/window";

const win = getCurrentWindow();

/** How often we check where the cursor is. */
const POLL_MS = 50;
/** How far the pupils can move inside their sockets. */
const EYE_RANGE = { x: 5, y: 4 };
/** Cursor distance (in px) at which the eyes reach full tilt. */
const LOOK_DISTANCE = 500;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export function initCursorWatch(): void {
  const eyes = document.querySelector<SVGGElement>(".eyes")!;
  const track = document.querySelector<SVGGElement>(".eye-track")!;

  const tick = async () => {
    try {
      const [cursor, origin, scale] = await Promise.all([
        cursorPosition(),
        win.outerPosition(),
        win.scaleFactor(),
      ]);
      // Cursor position inside our window, in the page's CSS pixels.
      const x = (cursor.x - origin.x) / scale;
      const y = (cursor.y - origin.y) / scale;

      const box = eyes.getBoundingClientRect();
      const dx = clamp((x - (box.left + box.width / 2)) / LOOK_DISTANCE, -1, 1);
      const dy = clamp((y - (box.top + box.height / 2)) / LOOK_DISTANCE, -1, 1);
      track.style.transform = `translate(${dx * EYE_RANGE.x}px, ${dy * EYE_RANGE.y}px)`;
    } catch {
      // The window can be briefly unavailable (e.g. while hidden). Try again next tick.
    }
    setTimeout(tick, POLL_MS);
  };
  tick();
}
