/** Finds an element that must exist, failing loudly if the HTML and code drift apart. */
export function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
