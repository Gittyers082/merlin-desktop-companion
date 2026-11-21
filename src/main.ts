import { getCurrentWindow } from "@tauri-apps/api/window";
import { buildFire } from "./fire";

buildFire();

// Hold left click anywhere on Merlin to move his window around.
// (Later we'll swap this for our own drag so we can throw him.)
const stage = document.querySelector<HTMLElement>("#stage")!;
stage.addEventListener("mousedown", (event) => {
  if (event.button === 0) getCurrentWindow().startDragging();
});
