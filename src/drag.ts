// Dragging and throwing Merlin. We move the window ourselves (instead of
// letting Windows do it) so we know how fast he's moving: that's what makes
// his fire lean and lets him fly when you let go mid-swing.

import { LogicalPosition } from "@tauri-apps/api/dpi";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { getMood, setMood, type Mood } from "./mood";
import { clamp, element } from "./utils";

interface Point {
  x: number;
  y: number;
}

const win = getCurrentWindow();

/** How far the window may hang off-screen (the empty space around Merlin). */
const MARGIN = { left: 110, right: 110, top: 70, bottom: 60 };
/** Pixels you must move before a press counts as a drag, not a click. */
const CLICK_SLOP = 4;
/** Release speed (px per frame) that turns a drop into a throw. */
const THROW_SPEED = 6;
/** Below this speed a thrown Merlin counts as stopped. */
const STOP_SPEED = 0.4;
const FRICTION = 0.965;
const BOUNCE = 0.8;
const SPIN_PER_SPEED = 1.6;
const LEAN_PER_SPEED = 3;
const MAX_LEAN = 40;
/** If the cursor pauses this long mid-drag, the fire whips back upright. */
const LEAN_RESET_MS = 90;
const DIZZY_MS = 2600;
const FRAME_MS = 16;
/** Moods that are about the drag itself; we never return to these afterwards. */
const DRAG_MOODS: Mood[] = ["startled", "flying", "dizzy"];

/** Lets other modules tell when Merlin is mid-drag or mid-flight. */
export interface DragControl {
  isBusy(): boolean;
}

export function initDrag(onClick: () => void): DragControl {
  const stage = element<HTMLElement>("#stage");
  const body = element<SVGSVGElement>("#merlin");
  const lean = element<SVGGElement>(".lean");

  let pressed = false;
  let flying = false;
  let moved = false;
  let moodBefore: Mood = "idle";
  let lastTime = 0;
  let flight = 0;
  let leanReset = 0;
  let dizzyTimer = 0;

  const pressAt: Point = { x: 0, y: 0 }; // cursor on screen when pressed
  const windowAtPress: Point = { x: 0, y: 0 };
  const windowPos: Point = { x: 0, y: 0 };
  const lastCursor: Point = { x: 0, y: 0 };
  const velocity: Point = { x: 0, y: 0 }; // px per 60fps frame

  let bounds = {
    minX: -Infinity,
    maxX: Infinity,
    minY: -Infinity,
    maxY: Infinity,
  };

  const setLean = (deg: number) => {
    lean.style.transform = `rotate(${clamp(deg, -MAX_LEAN, MAX_LEAN)}deg)`;
  };

  const leanAgainstMotion = () => setLean(-velocity.x * LEAN_PER_SPEED);

  const moveTo = (x: number, y: number) => {
    windowPos.x = clamp(x, bounds.minX, bounds.maxX);
    windowPos.y = clamp(y, bounds.minY, bounds.maxY);
    void win.setPosition(new LogicalPosition(windowPos.x, windowPos.y));
  };

  /** The screen edges Merlin bounces off, in logical pixels. */
  const updateBounds = async () => {
    const monitor = await currentMonitor();
    if (!monitor) return;
    // The work area excludes the taskbar, so he bounces off that too.
    const scale = monitor.scaleFactor;
    const { position, size } = monitor.workArea;
    const left = position.x / scale;
    const top = position.y / scale;
    bounds = {
      minX: left - MARGIN.left,
      maxX: left + size.width / scale - window.innerWidth + MARGIN.right,
      minY: top - MARGIN.top,
      maxY: top + size.height / scale - window.innerHeight + MARGIN.bottom,
    };
  };

  const settle = () => {
    flying = false;
    body.style.transform = "";
    setLean(0);
  };

  /** Let go mid-swing: tumble across the screen, bounce, slow down, get dizzy. */
  const fly = () => {
    flying = true;
    setMood("flying");
    let spinSpeed = velocity.x * SPIN_PER_SPEED;
    let spin = 0;

    const step = () => {
      windowPos.x += velocity.x;
      windowPos.y += velocity.y;
      const hitSide = windowPos.x < bounds.minX || windowPos.x > bounds.maxX;
      const hitTopOrBottom =
        windowPos.y < bounds.minY || windowPos.y > bounds.maxY;
      if (hitSide) {
        velocity.x *= -BOUNCE;
        spinSpeed *= -BOUNCE;
      }
      if (hitTopOrBottom) velocity.y *= -BOUNCE;
      moveTo(windowPos.x, windowPos.y);

      velocity.x *= FRICTION;
      velocity.y *= FRICTION;
      spinSpeed *= FRICTION;
      spin += spinSpeed;

      // Nearly stopped: ease the spin back upright, then get dizzy.
      if (Math.hypot(velocity.x, velocity.y) < STOP_SPEED) {
        const upright = Math.round(spin / 360) * 360;
        spin += (upright - spin) * 0.2;
        if (Math.abs(upright - spin) < 1) {
          settle();
          setMood("dizzy");
          dizzyTimer = window.setTimeout(() => {
            if (getMood() === "dizzy") setMood(moodBefore);
          }, DIZZY_MS);
          return;
        }
      }

      body.style.transform = `rotate(${spin}deg)`;
      leanAgainstMotion();
      flight = requestAnimationFrame(step);
    };
    flight = requestAnimationFrame(step);
  };

  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    // Clicks in the chat box aren't drags.
    if ((event.target as Element).closest("[data-interactive]")) return;
    stage.setPointerCapture(event.pointerId);
    cancelAnimationFrame(flight);
    clearTimeout(dizzyTimer);
    settle();
    pressed = true;
    moved = false;
    pressAt.x = lastCursor.x = event.screenX;
    pressAt.y = lastCursor.y = event.screenY;
    lastTime = event.timeStamp;
    velocity.x = velocity.y = 0;
    // The window is frameless, so its top-left is where the page starts on screen.
    windowAtPress.x = windowPos.x = event.screenX - event.clientX;
    windowAtPress.y = windowPos.y = event.screenY - event.clientY;
    void updateBounds();
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pressed) return;
    const dx = event.screenX - pressAt.x;
    const dy = event.screenY - pressAt.y;
    if (!moved) {
      if (Math.hypot(dx, dy) < CLICK_SLOP) return;
      moved = true;
      const mood = getMood();
      moodBefore = DRAG_MOODS.includes(mood) ? "idle" : mood;
      setMood("startled");
    }

    // Average the new speed with the previous one to smooth out jitter.
    const frames = Math.max(1, event.timeStamp - lastTime) / FRAME_MS;
    velocity.x = (velocity.x + (event.screenX - lastCursor.x) / frames) / 2;
    velocity.y = (velocity.y + (event.screenY - lastCursor.y) / frames) / 2;
    lastCursor.x = event.screenX;
    lastCursor.y = event.screenY;
    lastTime = event.timeStamp;

    moveTo(windowAtPress.x + dx, windowAtPress.y + dy);

    leanAgainstMotion();
    clearTimeout(leanReset);
    leanReset = window.setTimeout(() => {
      velocity.x = velocity.y = 0;
      setLean(0);
    }, LEAN_RESET_MS);
  });

  const release = () => {
    if (!pressed) return;
    pressed = false;
    clearTimeout(leanReset);
    if (!moved) return onClick();
    if (Math.hypot(velocity.x, velocity.y) > THROW_SPEED) return fly();
    setLean(0);
    setMood(moodBefore);
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  void updateBounds();

  return { isBusy: () => pressed || flying };
}
