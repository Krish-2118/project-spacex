import { A } from './data';

/**
 * The site's only sound: a short tick when a button, link or tab is clicked.
 *
 * The 8 kB sample (beep.mp3, a 50 ms tick) is fetched right after boot and decoded through Web Audio, so a click
 * never waits on the network. Browsers block audio until the first gesture, so the AudioContext is created on the
 * first pointer or key press (unlockClick). Until the sample is decoded, or if it fails to load, a synthesized tick
 * plays instead, so every click is heard.
 */

/** What counts as a button: anything a click on should answer with the tick. */
export const CLICKABLE = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], summary, label, input[type="checkbox"], input[type="radio"], input[type="submit"]';

const SRC = A + 'beep.mp3';
const VOLUME = .45;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let buf: AudioBuffer | null = null;
let bytes: Promise<ArrayBuffer | null> | null = null;
/** Time of the last tick: a click on a <label> also clicks its input, which should not tick twice. */
let last = -1e9;

/**
 * Fetches and decodes the sample ahead of the first click. Decoding runs in an OfflineAudioContext, which needs no
 * gesture; the buffer it yields plays in the real context later. Safe to call more than once.
 */
export function preloadClick() {
  if (bytes) return;
  bytes = fetch(SRC).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  const OAC = window.OfflineAudioContext || (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (OAC) void bytes.then((ab) => (ab ? decode(new OAC(1, 1, 44100), ab.slice(0)) : null)).then((b) => { if (b) buf ??= b; }).catch(() => {});
}

/** decodeAudioData, promise style (older Safari only takes callbacks). */
function decode(c: BaseAudioContext, ab: ArrayBuffer) {
  return new Promise<AudioBuffer>((res, rej) => { const r = c.decodeAudioData(ab, res, rej); if (r && typeof r.then === 'function') r.then(res, rej); });
}

/** Creates the AudioContext inside a user gesture and decodes the sample into it. */
export function unlockClick() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  const c = new AC();
  ctx = c;
  out = c.createGain();
  out.gain.value = VOLUME;
  out.connect(c.destination);
  // Some browsers (iOS Safari) need a sound started inside the gesture to wake the context.
  const s = c.createBufferSource();
  s.buffer = c.createBuffer(1, 1, 22050);
  s.connect(c.destination);
  s.start(0);
  if (c.state === 'suspended') void c.resume().catch(() => {});
  preloadClick();
  // Fallback for browsers without OfflineAudioContext: decode in the live context instead.
  if (!buf) void bytes!.then((ab) => (ab && !buf ? decode(c, ab.slice(0)) : null)).then((b) => { if (b) buf ??= b; }).catch(() => {});
}

/** Plays the tick now: the decoded sample, or a synthesized one while it is not ready. */
export function playClick() {
  const now = performance.now();
  if (now - last < 60) return;
  last = now;
  if (!ctx) unlockClick();
  const c = ctx, o = out;
  if (!c || !o) return;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  if (buf) {
    const s = c.createBufferSource();
    s.buffer = buf;
    s.connect(o);
    s.start(0);
    return;
  }
  const t = c.currentTime, osc = c.createOscillator(), g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(2400, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + .04);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(.5, t + .004);
  g.gain.exponentialRampToValueAtTime(.0001, t + .05);
  osc.connect(g).connect(o);
  osc.start(t);
  osc.stop(t + .06);
}
