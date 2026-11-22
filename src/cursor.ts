// Watches the cursor, even outside Merlin's window, so his eyes can follow
// it and clicks can pass through the empty space around him.

import { cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";
import { clamp, element } from "./utils";

const win = getCurrentWindow();

const POLL_MS = 50;
/** How far the pupils can move inside their sockets. */
const EYE_RANGE = { x: 5, y: 4 };
/** Cursor distance (px) at which the eyes reach full tilt. */
const LOOK_DISTANCE = 500;

/**
 * @param isBusy True while Merlin is being dragged or thrown, so clicks are
 *   never switched off mid-drag.
 */
export function initCursorWatch(isBusy: () => boolean): void {
  const svg = element<SVGSVGElement>("#merlin");
  const eyes = element<SVGGElement>(".eyes");
  const track = element<SVGGElement>(".eye-track");
  let ignoringClicks = false;

  /** Is the point (in CSS px) on a visible part of Merlin or his chat box? */
  const isOverMerlin = (x: number, y: number) => {
    const inWindow =
      x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
    if (!inWindow) return false;
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit === svg) return false;
    return svg.contains(hit) || hit.closest("[data-interactive]") !== null;
  };

  const lookAt = (x: number, y: number) => {
    const box = eyes.getBoundingClientRect();
    const dx = clamp((x - (box.left + box.width / 2)) / LOOK_DISTANCE, -1, 1);
    const dy = clamp((y - (box.top + box.height / 2)) / LOOK_DISTANCE, -1, 1);
    track.style.transform = `translate(${dx * EYE_RANGE.x}px, ${dy * EYE_RANGE.y}px)`;
  };

  const tick = async () => {
    try {
      const [cursor, origin, scale] = await Promise.all([
        cursorPosition(),
        win.outerPosition(),
        win.scaleFactor(),
      ]);
      // Screen pixels → this page's CSS pixels.
      const x = (cursor.x - origin.x) / scale;
      const y = (cursor.y - origin.y) / scale;

      lookAt(x, y);

      const shouldIgnore = !isBusy() && !isOverMerlin(x, y);
      if (shouldIgnore !== ignoringClicks) {
        ignoringClicks = shouldIgnore;
        await win.setIgnoreCursorEvents(shouldIgnore);
      }
    } catch {
      // The window can be briefly unavailable (e.g. while hidden).
    }
    setTimeout(tick, POLL_MS);
  };
  void tick();
}
