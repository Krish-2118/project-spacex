'use client';

import type { CSSProperties } from 'react';

const GOLD = 'oklch(0.8 0.12 85)';
const PAPER = '#ECE8DF';
/** The site's cut-corner button shape. */
const CUT = 'polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)';
const button: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '168px', minHeight: '48px', padding: '0 28px',
  border: '0', cursor: 'pointer', font: 'inherit', fontWeight: 700, fontSize: '14px', letterSpacing: '.08em', clipPath: CUT,
};
// A starfield drawn with gradients: the fallback must not depend on any asset that might be what failed.
const STARS = [
  'radial-gradient(1.5px 1.5px at 12% 22%,rgba(236,232,223,.9),transparent)', 'radial-gradient(1px 1px at 28% 68%,rgba(236,232,223,.7),transparent)',
  'radial-gradient(1.5px 1.5px at 47% 14%,rgba(236,232,223,.8),transparent)', 'radial-gradient(1px 1px at 63% 82%,rgba(236,232,223,.6),transparent)',
  'radial-gradient(2px 2px at 78% 30%,rgba(236,232,223,.9),transparent)', 'radial-gradient(1px 1px at 89% 61%,rgba(236,232,223,.7),transparent)',
  'radial-gradient(1px 1px at 6% 84%,rgba(236,232,223,.6),transparent)', 'radial-gradient(1.5px 1.5px at 38% 44%,rgba(236,232,223,.5),transparent)',
].join(',');

/**
 * Branded crash screen shared by app/error.tsx and app/global-error.tsx: dark space theme, Cinzel heading,
 * Space Grotesk copy, and a way back in (retry re-renders the failed part; reload starts the page afresh).
 */
export default function ErrorFallback({ retry, digest }: { retry: () => void; digest?: string }) {
  return (
    <main role="alert" style={{ position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto', display: 'grid', placeItems: 'center', padding: '48px 16px', background: `${STARS},radial-gradient(ellipse at 50% 120%,#2a2620 0%,#0c0b0a 60%)`, color: PAPER, fontFamily: "var(--font-grotesk),'Space Grotesk','Segoe UI',system-ui,sans-serif", textAlign: 'center' }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: 'min(-60vw,-420px)', width: 'max(120vw,840px)', aspectRatio: '1', marginLeft: 'min(-60vw,-420px)', borderRadius: '50%', border: '1px dashed rgba(236,232,223,.14)', pointerEvents: 'none' }}></div>
      <div style={{ position: 'relative', maxWidth: '560px' }}>
        <p style={{ margin: '0 0 18px', fontSize: '12px', fontWeight: 700, letterSpacing: '.34em', color: GOLD }}>SIGNAL LOST</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-cinzel),'Cinzel',Georgia,serif", fontWeight: 900, fontSize: 'clamp(34px,7vw,64px)', lineHeight: 1.02, letterSpacing: '.01em' }}>We drifted off course.</h1>
        <p style={{ margin: '20px auto 0', maxWidth: '42ch', fontSize: '17px', lineHeight: 1.6, color: 'rgba(236,232,223,.8)' }}>
          Something went wrong while drawing this part of Innovision 2026. Try again, or reload the page if it keeps happening.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', marginTop: '32px' }}>
          <button type="button" onClick={() => retry()} style={{ ...button, background: PAPER, color: '#141312' }}>TRY AGAIN</button>
          {/* Outlined twin, drawn like the site's ghost buttons: a ring of the outline colour around an inner fill, so the cut corners keep their edge. */}
          <button type="button" onClick={() => location.reload()} style={{ ...button, position: 'relative', isolation: 'isolate', background: 'rgba(236,232,223,.5)', color: PAPER }}>
            <span aria-hidden="true" style={{ position: 'absolute', inset: '1.5px', zIndex: -1, background: '#100f0d', clipPath: 'polygon(11.4px 0,100% 0,100% calc(100% - 11.4px),calc(100% - 11.4px) 100%,0 100%,0 11.4px)' }}></span>
            RELOAD PAGE
          </button>
        </div>
        {digest ? <p style={{ margin: '28px 0 0', fontSize: '12px', letterSpacing: '.12em', color: 'rgba(236,232,223,.5)' }}>REFERENCE {digest}</p> : null}
      </div>
    </main>
  );
}
