// Merlin's fire.
// Each flame layer is one spiky "crown" path. We compute a few keyframe
// shapes where every peak leans and stretches a bit differently, then let
// SVG <animate> morph between them forever. Different speeds per layer
// keep the fire from ever moving in sync — that's what makes it feel alive.

const SVG_NS = "http://www.w3.org/2000/svg";

type Point = [number, number];

interface FlameLayer {
  className: string;
  attrs: Record<string, string>;
  baseLeft: Point;
  baseRight: Point;
  peaks: Point[];
  valleys: Point[];
  /** For each peak: its sideways offset in every keyframe. */
  sway: number[][];
  /** For each peak: its height offset in every keyframe. */
  lift: number[][];
  /** Seconds for one full morph cycle. */
  duration: number;
  /** How much the curves bulge between points. */
  bend: number;
}

const HALO: FlameLayer = {
  className: "flame-halo",
  attrs: { fill: "#1597BE", opacity: "0.38" },
  baseLeft: [66, 118],
  baseRight: [134, 118],
  peaks: [
    [34, 40],
    [62, 6],
    [100, -18],
    [138, 0],
    [168, 36],
  ],
  valleys: [
    [48, 72],
    [80, 42],
    [120, 36],
    [152, 64],
  ],
  sway: [
    [-12, -3, -14, -5],
    [-6, 4, -8, 2],
    [5, -7, 8, -4],
    [6, -2, 9, 3],
    [12, 4, 14, 5],
  ],
  lift: [
    [0, -8, 4, -4],
    [-6, 4, -10, 2],
    [4, -10, 0, -6],
    [-8, 2, -4, 4],
    [2, -6, -2, -8],
  ],
  duration: 2.3,
  bend: 16,
};

const MAIN: FlameLayer = {
  className: "flame-main",
  attrs: {
    fill: "url(#fire-grad)",
    stroke: "#14213D",
    "stroke-width": "3.5",
    "stroke-linejoin": "round",
  },
  baseLeft: [64, 116],
  baseRight: [136, 116],
  peaks: [
    [44, 44],
    [72, 14],
    [100, -6],
    [130, 8],
    [158, 32],
  ],
  valleys: [
    [60, 72],
    [86, 48],
    [116, 42],
    [144, 60],
  ],
  sway: [
    [-10, -2, -12, -4],
    [-5, 6, -8, 3],
    [6, -8, 5, -5],
    [5, -3, 9, 2],
    [10, 3, 12, 5],
  ],
  lift: [
    [0, -7, 3, -4],
    [-5, 3, -9, 2],
    [3, -8, 0, -5],
    [-7, 2, -4, 4],
    [2, -5, -1, -7],
  ],
  duration: 1.7,
  bend: 13,
};

const INNER: FlameLayer = {
  className: "flame-inner",
  attrs: { fill: "url(#inner-grad)" },
  baseLeft: [72, 104],
  baseRight: [128, 104],
  peaks: [
    [68, 56],
    [88, 32],
    [110, 22],
    [132, 46],
  ],
  valleys: [
    [78, 72],
    [98, 54],
    [122, 60],
  ],
  sway: [
    [-6, 2, -8, 0],
    [4, -5, 3, -4],
    [-5, 6, -4, 5],
    [6, -2, 8, 1],
  ],
  lift: [
    [-3, 3, -6, 0],
    [2, -6, 3, -3],
    [-4, 0, -6, 3],
    [0, -4, 2, -5],
  ],
  duration: 1.25,
  bend: 9,
};

const fmt = (n: number) => n.toFixed(1);

/** Builds the path for one keyframe of a flame layer. */
function crownPath(layer: FlameLayer, frame: number): string {
  const { baseLeft, baseRight, valleys, bend } = layer;
  const peaks = layer.peaks.map(
    ([x, y], i): Point => [x + layer.sway[i][frame], y + layer.lift[i][frame]],
  );

  // Walk left to right: base → peak → valley → peak → … → base.
  const steps: { kind: "peak" | "valley" | "base"; pt: Point }[] = [];
  peaks.forEach((pt, i) => {
    steps.push({ kind: "peak", pt });
    if (i < valleys.length) steps.push({ kind: "valley", pt: valleys[i] });
  });
  steps.push({ kind: "base", pt: baseRight });

  let d = `M${fmt(baseLeft[0])} ${fmt(baseLeft[1])}`;
  let prev = baseLeft;
  for (const { kind, pt } of steps) {
    const [ax, ay] = prev;
    const [bx, by] = pt;
    let c1: Point;
    let c2: Point;
    if (kind === "peak") {
      // Rising edge: bulge out low, then whip into a sharp tip.
      const dy = ay - by;
      c1 = [prev === baseLeft ? ax - bend * 0.6 : ax + 2, ay - dy * 0.55];
      c2 = [bx - bend * 0.4, by + dy * 0.3];
    } else {
      // Falling edge: drop from the tip into the next valley (or the base).
      const dy = by - ay;
      c1 = [ax + bend * 0.4, ay + dy * 0.35];
      c2 = [
        kind === "valley" ? bx - bend * 0.2 : bx + bend * 0.8,
        by - dy * 0.45,
      ];
    }
    d += ` C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(bx)} ${fmt(by)}`;
    prev = pt;
  }
  return `${d} Z`;
}

/** Creates one flame layer as a <path> that morphs through its keyframes. */
function buildLayer(layer: FlameLayer): SVGPathElement {
  const frames = layer.sway[0].length;
  const shapes = Array.from({ length: frames }, (_, k) => crownPath(layer, k));

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("class", layer.className);
  path.setAttribute("d", shapes[0]);
  for (const [name, value] of Object.entries(layer.attrs))
    path.setAttribute(name, value);

  const morph = document.createElementNS(SVG_NS, "animate");
  const anim: Record<string, string> = {
    attributeName: "d",
    dur: `${layer.duration}s`,
    repeatCount: "indefinite",
    calcMode: "spline",
    keyTimes: Array.from({ length: frames + 1 }, (_, i) =>
      (i / frames).toFixed(3),
    ).join(";"),
    keySplines: Array(frames).fill("0.45 0 0.55 1").join(";"),
    values: [...shapes, shapes[0]].join(";"),
  };
  for (const [name, value] of Object.entries(anim))
    morph.setAttribute(name, value);
  path.appendChild(morph);
  return path;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** Scatters tiny glowing sparks that rise off the fire and burn out. */
function buildSparks(group: SVGGElement, count = 15): void {
  const colors = ["#F4FEFF", "#8BE9F3", "#2EC4D6", "#8BE9F3"];
  for (let i = 0; i < count; i++) {
    const x = 48 + (i / (count - 1)) * 104;
    const y = x > 60 && x < 140 ? rand(-6, 40) : rand(30, 52);
    const r = pick([1.4, 1.8, 2.2, 2.6, 3]);

    const holder = document.createElementNS(SVG_NS, "g");
    holder.setAttribute("transform", `translate(${fmt(x)} ${fmt(y)})`);

    let spark: SVGElement;
    if (i % 3 === 0) {
      spark = document.createElementNS(SVG_NS, "path");
      spark.setAttribute(
        "d",
        `M0 ${fmt(-r * 1.6)} L${fmt(r * 0.8)} 0 L0 ${fmt(r * 1.6)} L${fmt(-r * 0.8)} 0 Z`,
      );
    } else {
      spark = document.createElementNS(SVG_NS, "circle");
      spark.setAttribute("r", fmt(r));
    }
    spark.setAttribute("class", "spark");
    spark.setAttribute("fill", colors[i % colors.length]);
    spark.style.animationDuration = `${rand(1.1, 2.2).toFixed(2)}s`;
    spark.style.animationDelay = `${rand(0, 2).toFixed(2)}s`;
    spark.style.setProperty("--dx", `${Math.round(rand(-14, 14))}px`);

    holder.appendChild(spark);
    group.appendChild(holder);
  }
}

/** Lights Merlin's fire: fills the empty fire groups in index.html. */
export function buildFire(): void {
  const outer = document.querySelector<SVGGElement>("#fire-outer");
  const inner = document.querySelector<SVGGElement>("#fire-inner");
  const sparks = document.querySelector<SVGGElement>("#sparks");
  if (!outer || !inner || !sparks) return;

  outer.append(buildLayer(HALO), buildLayer(MAIN));
  inner.append(buildLayer(INNER));
  buildSparks(sparks);
}
