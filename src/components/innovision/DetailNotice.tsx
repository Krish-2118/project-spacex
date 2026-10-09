import { Logo } from './icons';
import type { V } from './types';

/**
 * Phone-style notice on entering a world: points the visitor down to its missions. Fixed just above the world
 * switcher, like WorldHint, so a mobile browser's toolbar can't push it onto the switcher. It shows for a few
 * seconds and leaves early once the page scrolls (Innovision#showNotice).
 */
export default function DetailNotice({ v }: { v: V }) {
  const on = v.noticeOn;
  return (
    <div role="status" aria-live="polite" aria-hidden={!on} style={{ position: "fixed", left: "0", right: "0", bottom: `calc(${v.navBottom} + 80px)`, zIndex: "52", display: "flex", justifyContent: "center", padding: "0 16px", pointerEvents: "none", visibility: on ? "visible" : "hidden", opacity: on ? 1 : 0, transform: on ? "translateY(0) scale(1)" : "translateY(12px) scale(.96)", transition: on ? "opacity .5s, transform .7s cubic-bezier(.25,1,.1,1)" : "opacity .3s, transform .3s, visibility 0s .3s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", maxWidth: "100%", padding: "8px 14px 8px 8px", border: "1px solid rgba(236,232,223,.12)", borderRadius: "18px", background: "rgba(28,27,25,.82)", backdropFilter: "blur(20px) saturate(1.6)", WebkitBackdropFilter: "blur(20px) saturate(1.6)", boxShadow: "0 16px 34px -16px rgba(0,0,0,.6)", color: "#ECE8DF" }}>
        <span aria-hidden="true" style={{ display: "grid", placeItems: "center", flex: "none", width: "32px", height: "32px", borderRadius: "9px", background: v.noticeAccent }}>
          <Logo style={{ width: "18px", height: "18px" }} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
          <strong style={{ fontSize: "13px", fontWeight: "700", lineHeight: "1.3" }}>Missions are boarding</strong>
          <span style={{ fontSize: "12px", lineHeight: "1.35", color: "rgba(236,232,223,.75)" }}>Scroll down to see all {v.noticeWorld}</span>
        </span>
        <svg data-nudge="" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", width: "16px", height: "16px", color: "rgba(236,232,223,.7)" }}>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>
      </div>
    </div>
  );
}
