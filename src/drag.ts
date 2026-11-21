// Dragging and throwing Merlin.
// We move the window ourselves (instead of letting Windows do it) so we
// know how fast you're moving him — that lets his fire lean, and lets
// him fly when you let go mid-swing.

import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { getMood, setMood, type Mood } from "./mood";

const win = getCurrentWindow();

const WIN_W = 420;
const WIN_H = 480;
/** How far the window may hang off-screen (the empty space around Merlin). */
const MARGIN = { left: 110, right: 110, top: 70, bottom: 60 };
/** Pixels you must move before a press counts as a drag, not a click. */
const CLICK_SLOP = 4;
/** Release speed (px per frame) that turns a drop into a throw. */
const THROW_SPEED = 6;
const FRICTION = 0.965;
const BOUNCE = 0.8;
const DIZZY_MS = 2600;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export function initDrag(onClick: () => void): void {
  const stage = document.querySelector<HTMLElement>("#stage")!;
  const body = document.querySelector<SVGSVGElement>("#merlin")!;
  const lean = document.querySelector<SVGGElement>(".lean")!;

  let pressed = false;
  let moved = false;
  let startX = 0,
    startY = 0;
  let winX = 0,
    winY = 0;
  let x = 0,
    y = 0;
  let lastX = 0,
    lastY = 0,
    lastT = 0;
  let vx = 0,
    vy = 0;
  let flight = 0;
  let leanReset = 0;
  let dizzyTimer = 0;
  let moodBefore: Mood = "idle";
  let bounds = {
    minX: -Infinity,
    maxX: Infinity,
    minY: -Infinity,
    maxY: Infinity,
  };

  const setLean = (deg: number) => {
    lean.style.transform = `rotate(${clamp(deg, -40, 40)}deg)`;
  };

  const moveTo = (nx: number, ny: number) => {
    x = clamp(nx, bounds.minX, bounds.maxX);
    y = clamp(ny, bounds.minY, bounds.maxY);
    win.setPosition(new LogicalPosition(x, y));
  };

  /** The screen edges Merlin bounces off, in logical pixels. */
  const updateBounds = async () => {
    const monitor = await currentMonitor();
    if (!monitor) return;
    // workArea = the screen minus the taskbar, so he bounces off the taskbar too.
    const s = monitor.scaleFactor;
    const { position, size } = monitor.workArea;
    const left = position.x / s;
    const top = position.y / s;
    const width = size.width / s;
    const height = size.height / s;
    bounds = {
      minX: left - MARGIN.left,
      maxX: left + width - WIN_W + MARGIN.right,
      minY: top - MARGIN.top,
      maxY: top + height - WIN_H + MARGIN.bottom,
    };
  };
  updateBounds();

  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    stage.setPointerCapture(event.pointerId);
    cancelAnimationFrame(flight);
    clearTimeout(dizzyTimer);
    body.style.transform = "";
    pressed = true;
    moved = false;
    startX = lastX = event.screenX;
    startY = lastY = event.screenY;
    lastT = event.timeStamp;
    vx = vy = 0;
    // The window is frameless, so its top-left is where the page starts on screen.
    winX = x = event.screenX - event.clientX;
    winY = y = event.screenY - event.clientY;
    updateBounds();
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pressed) return;
    const dx = event.screenX - startX;
    const dy = event.screenY - startY;
    if (!moved) {
      if (Math.hypot(dx, dy) < CLICK_SLOP) return;
      moved = true;
      const mood = getMood();
      moodBefore =
        mood === "startled" || mood === "flying" || mood === "dizzy"
          ? "idle"
          : mood;
      setMood("startled");
    }

    // Velocity in "pixels per 60fps frame", smoothed a little.
    const dt = Math.max(1, event.timeStamp - lastT);
    vx = vx * 0.5 + ((event.screenX - lastX) / dt) * 16 * 0.5;
    vy = vy * 0.5 + ((event.screenY - lastY) / dt) * 16 * 0.5;
    lastX = event.screenX;
    lastY = event.screenY;
    lastT = event.timeStamp;

    moveTo(winX + dx, winY + dy);

    // Fire leans against the motion, and whips back when you stop.
    setLean(-vx * 3);
    clearTimeout(leanReset);
    leanReset = window.setTimeout(() => {
      vx = vy = 0;
      setLean(0);
    }, 90);
  });

  const release = () => {
    if (!pressed) return;
    pressed = false;
    clearTimeout(leanReset);
    if (!moved) {
      onClick();
      return;
    }
    if (Math.hypot(vx, vy) > THROW_SPEED) {
      fly();
    } else {
      setLean(0);
      setMood(moodBefore);
    }
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  /** Let go mid-swing: tumble across the screen, bounce, slow down, get dizzy. */
  const fly = () => {
    setMood("flying");
    let spinSpeed = vx * 1.6;
    let spin = 0;

    const step = () => {
      x += vx;
      y += vy;
      if (x < bounds.minX || x > bounds.maxX) {
        vx = -vx * BOUNCE;
        spinSpeed = -spinSpeed * BOUNCE;
      }
      if (y < bounds.minY || y > bounds.maxY) vy = -vy * BOUNCE;
      moveTo(x, y);

      vx *= FRICTION;
      vy *= FRICTION;
      spinSpeed *= FRICTION;
      spin += spinSpeed;

      // Nearly stopped: ease the spin back upright, then get dizzy.
      if (Math.hypot(vx, vy) < 0.4) {
        const upright = Math.round(spin / 360) * 360;
        spin += (upright - spin) * 0.2;
        if (Math.abs(upright - spin) < 1) {
          body.style.transform = "";
          setLean(0);
          setMood("dizzy");
          dizzyTimer = window.setTimeout(() => {
            if (getMood() === "dizzy") setMood(moodBefore);
          }, DIZZY_MS);
          return;
        }
      }

      body.style.transform = `rotate(${spin}deg)`;
      setLean(-vx * 3);
      flight = requestAnimationFrame(step);
    };
    flight = requestAnimationFrame(step);
  };
}
