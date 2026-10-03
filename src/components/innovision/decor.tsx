/* Shared decorative layers for the Innovision views. */
import type { CSSProperties, ReactNode } from 'react';

const C = 'clamp(16px,2.6vw,44px)';
const corner = (h: 'left' | 'right', v: 'top' | 'bottom'): CSSProperties => {
  const b = '1.5px solid currentColor';
  return { position: 'absolute', [h]: 0, [v]: 0, width: '22px', height: '22px', [h === 'left' ? 'borderLeft' : 'borderRight']: b, [v === 'top' ? 'borderTop' : 'borderBottom']: b };
};
const ruler = (side: 'left' | 'right', top: string, height: string): CSSProperties => {
  const x = side === 'left' ? '0' : '100%';
  return { position: 'absolute', [side]: 0, top, width: '12px', height, background: `repeating-linear-gradient(180deg,currentColor 0 1px,transparent 1px 45px) ${x} 0/12px 100% no-repeat,repeating-linear-gradient(180deg,currentColor 0 1px,transparent 1px 9px) ${x} 0/6px 100% no-repeat` };
};

/**
 * Viewfinder overlay: four corner brackets inset from the screen edge (clear of the HUD and
 * world nav), with optional tick rulers down both sides.
 */
export function CornerFrame({ color, rulers, style, children, ...rest }: {
  color: string;
  /** Rulers' [top, height], e.g. ['24%', '28%']. */
  rulers?: [string, string];
  style?: CSSProperties;
  children?: ReactNode;
  [data: `data-${string}`]: string;
}) {
  return (
    <div aria-hidden="true" {...rest} style={{ position: 'absolute', top: 'calc(72px + 1vh)', left: C, right: C, bottom: `calc(${C} + 46px)`, pointerEvents: 'none', color, ...style }}>
      <span style={corner('left', 'top')}></span>
      <span style={corner('right', 'top')}></span>
      <span style={corner('left', 'bottom')}></span>
      <span style={corner('right', 'bottom')}></span>
      {rulers && <span style={ruler('left', rulers[0], rulers[1])}></span>}
      {rulers && <span style={ruler('right', rulers[0], rulers[1])}></span>}
      {children}
    </div>
  );
}

/** Concentric orbit rings plus a dot grid, shared by the worlds slides and the detail scenes. */
export function OrbitBackdrop({ top }: { top: string }) {
  const ring = (d: number, depth: string, border: string) => (
    <div data-depth={depth} style={{ position: "absolute", left: "50%", top, width: d + "vmax", height: d + "vmax", margin: `-${d / 2}vmax 0 0 -${d / 2}vmax`, borderRadius: "50%", border }}></div>
  );
  return (
    <>
      <div data-depth=".15" style={{ position: "absolute", inset: "-5%", backgroundImage: "radial-gradient(rgba(20,19,18,.22) 1px,transparent 1.4px)", backgroundSize: "22px 22px", WebkitMaskImage: "radial-gradient(ellipse at 50% 50%,#000 10%,transparent 70%)", maskImage: "radial-gradient(ellipse at 50% 50%,#000 10%,transparent 70%)" }}></div>
      {ring(150, ".3", "1px solid rgba(20,19,18,.16)")}
      {ring(110, ".4", "1px dashed rgba(20,19,18,.2)")}
      {ring(72, ".5", "1px solid rgba(20,19,18,.14)")}
    </>
  );
}

/** Radial tick "radar" disc centred at (50%, top). */
export function Radar({ top, size, mask, depth, alpha = .09 }: { top: string; size: number; mask: string; depth?: string; alpha?: number }) {
  return (
    <div data-depth={depth} aria-hidden="true" style={{ position: "absolute", left: "50%", top, width: size + "vmax", height: size + "vmax", margin: `-${size / 2}vmax 0 0 -${size / 2}vmax`, borderRadius: "50%", background: `repeating-conic-gradient(from 0deg,rgba(20,19,18,${alpha}) 0deg .5deg,transparent .5deg 5deg)`, WebkitMaskImage: mask, maskImage: mask, pointerEvents: "none" }}></div>
  );
}
