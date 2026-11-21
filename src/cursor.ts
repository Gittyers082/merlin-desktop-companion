// Watches the mouse cursor, even outside Merlin's window, to:
// 1. make his eyes follow it around your screen, and
// 2. let clicks pass through the empty space around him.

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

/**
 * @param isBusy Return true while Merlin is being dragged or thrown,
 *   so we never switch off clicks in the middle of a drag.
 */
export function initCursorWatch(isBusy: () => boolean): void {
  const svg = document.querySelector<SVGSVGElement>("#merlin")!;
  const eyes = document.querySelector<SVGGElement>(".eyes")!;
  const track = document.querySelector<SVGGElement>(".eye-track")!;
  let ignoring = false;

  /** True if the point (in CSS px) is on a visible part of Merlin. */
  const isOverMerlin = (x: number, y: number) => {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight)
      return false;
    const hit = document.elementFromPoint(x, y);
    return hit !== null && hit !== svg && svg.contains(hit);
  };

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

      // 1. Eyes follow the cursor.
      const box = eyes.getBoundingClientRect();
      const dx = clamp((x - (box.left + box.width / 2)) / LOOK_DISTANCE, -1, 1);
      const dy = clamp((y - (box.top + box.height / 2)) / LOOK_DISTANCE, -1, 1);
      track.style.transform = `translate(${dx * EYE_RANGE.x}px, ${dy * EYE_RANGE.y}px)`;

      // 2. Clicks go through the window unless the cursor is on Merlin himself.
      const shouldIgnore = !isBusy() && !isOverMerlin(x, y);
      if (shouldIgnore !== ignoring) {
        ignoring = shouldIgnore;
        await win.setIgnoreCursorEvents(shouldIgnore);
      }
    } catch {
      // The window can be briefly unavailable (e.g. while hidden). Try again next tick.
    }
    setTimeout(tick, POLL_MS);
  };
  tick();
}
