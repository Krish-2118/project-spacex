import { Sparkle } from './icons';
import type { V } from './types';

/** A tiny seeded random generator (mulberry32), so every render draws the same clouds on server and client. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const circle = (cx: number, cy: number, r: number) => `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 1 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 1 ${r1(-2 * r)} 0`;

/**
 * A cumulus bank in a 2000x1125 box, drawn in code. `back` is the skyline: puffs of mixed sizes along a wandering
 * baseline, with the odd tower stacked on top, over a base block. `front` is a lower ridge of big puffs whose rims read
 * as inked folds inside the cloud. Every subpath winds clockwise, so with the default nonzero fill the circles merge
 * into one silhouette.
 */
function cloudBank(seed: number) {
  const rnd = seeded(seed), p1 = rnd() * 6.3, p2 = rnd() * 6.3;
  const base = (x: number) => 640 + 75 * Math.sin(x / 290 + p1) + 35 * Math.sin(x / 110 + p2);
  let back = 'M-100 780H2100V1125H-100Z', front = '';
  for (let x = -60; x < 2080; x += 45 + rnd() * 75) {
    const cy = base(x) + rnd() * 40, r = Math.max(55 + rnd() * 105, 800 - cy);
    back += circle(x, cy, r);
    if (rnd() < .1) {
      let ty = cy - r * .7, tr = r * .7;
      for (let k = 0; k < 2 + rnd() * 2; k++) { back += circle(x + (rnd() - .5) * tr * .6, ty, tr); ty -= tr * .6; tr *= .72; }
    }
  }
  for (let x = -40; x < 2080; x += 140 + rnd() * 180) {
    const r = 120 + rnd() * 110, cy = 1020 + rnd() * 110;
    front += circle(x, cy, r) + circle(x + r * .8, cy + 30 + rnd() * 40, r * (.6 + rnd() * .3));
  }
  return { back, front };
}

/** Back to front, in the site's own ink-to-paper tones; the front (paper) bank carries the "Now entering" label. */
const LAYERS = [
  { color: '#141312', ink: '#000000', ...cloudBank(11) },
  { color: '#3a3530', ink: '#1d1a17', ...cloudBank(23) },
  { color: '#6e665c', ink: '#3d3832', ...cloudBank(37) },
  { color: '#c9bfae', ink: '#857b6c', ...cloudBank(41) },
  { color: '#ECE8DF', ink: '#a39b8d', ...cloudBank(59) },
];

/**
 * One cloud bank, cropped like a cover image anchored to the bottom; flip mirrors it for the trailing edge.
 * Each shape is drawn twice, stroked and then filled on top, so only the outer silhouette keeps its ink line.
 */
function Clouds({ l, flip }: { l: (typeof LAYERS)[number]; flip?: boolean }) {
  return (
    <svg viewBox="0 0 2000 1125" preserveAspectRatio="xMidYMax slice" style={{ display: "block", width: "100%", height: "100vh", transform: flip ? "scaleY(-1)" : undefined }}>
      <path d={l.back} fill={l.color} stroke={l.ink} strokeWidth="5" vectorEffect="non-scaling-stroke" />
      <path d={l.back} fill={l.color} />
      <path d={l.front} fill={l.color} stroke={l.ink} strokeWidth="4" vectorEffect="non-scaling-stroke" />
      <path d={l.front} fill={l.color} />
    </svg>
  );
}

/** Layered cloud curtain used for view transitions. */
export default function Curtain({ v }: { v: V }) {
  return (
    <div data-curtain="" aria-hidden="true" style={{ position: "fixed", inset: "0", zIndex: "40", overflow: "hidden", pointerEvents: "none" }}>
      {LAYERS.map((l, k) => (
        <div key={k} data-c-layer="" style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "300vh", transform: "translateY(100%)" }}>
          <Clouds l={l} />
          {k === LAYERS.length - 1 ? (
            <div style={{ position: "relative", height: "calc(100vh + 4px)", margin: "-2px 0", background: l.color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", textAlign: "center", color: "#141312", padding: "0 20px" }}>
              <Sparkle data-c-spark="" style={{ width: "22px", height: "22px" }} />
              <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".34em" }}>{v.curtainKicker}</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(34px,6vw,96px)", lineHeight: "1", letterSpacing: ".02em" }}>{v.curtainLabel}</span>
            </div>
          ) : (
            <div style={{ height: "calc(100vh + 4px)", margin: "-2px 0", background: l.color }}></div>
          )}
          <Clouds l={l} flip />
        </div>
      ))}
    </div>
  );
}
