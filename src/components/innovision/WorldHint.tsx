import type { V } from './types';

/**
 * First-visit guide on the worlds slider: tells a new visitor the planet is the way in and how to
 * move between worlds. It sits just above the world switcher, over the planet it points at, and goes
 * away for good once they enter a world, switch worlds or dismiss it (Innovision#dismissHint).
 */
export default function WorldHint({ v }: { v: V }) {
  const on = v.hintOn;
  return (
    <div className="world-hint" role="status" aria-live="polite" aria-hidden={!on} style={{ position: "fixed", left: "0", right: "0", bottom: `calc(${v.navBottom} + 84px)`, zIndex: "52", display: "flex", justifyContent: "center", padding: "0 16px", pointerEvents: "none", visibility: on ? "visible" : "hidden", opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: on ? "opacity .5s, transform .7s cubic-bezier(.25,1,.1,1)" : "opacity .3s, transform .3s, visibility 0s .3s" }}>
      <div className="wh-card" style={{ display: "flex", alignItems: "center", gap: "16px", maxWidth: "560px", padding: "14px 16px 14px 14px", background: "rgba(20,19,18,.92)", color: "#ECE8DF", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", pointerEvents: on ? "auto" : "none" }}>
        {/* A planet with a ring pulsing off it, like a tap landing on it. */}
        <span className="wh-glyph" aria-hidden="true" style={{ position: "relative", flex: "none", width: "40px", height: "40px" }}>
          <span data-hint-pulse="" style={{ position: "absolute", inset: "0", borderRadius: "50%", border: "1.5px solid oklch(0.8 0.12 85)", animation: "iv-pulse 1.6s ease-out infinite" }}></span>
          <span style={{ position: "absolute", inset: "9px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #ECE8DF, #8f8a80 70%)" }}></span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "0" }}>
          <strong className="wh-main" style={{ fontSize: "15px", fontWeight: "700", lineHeight: "1.3" }}>{v.hintMain}</strong>
          <span className="wh-sub" style={{ fontSize: "13px", lineHeight: "1.4", color: "rgba(236,232,223,.72)" }}>{v.hintSub}</span>
        </span>
        <button type="button" onClick={v.dismissHint} style={{ flex: "none", alignSelf: "center", padding: "6px 0 4px", border: "0", borderBottom: "1.5px solid oklch(0.8 0.12 85)", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "13px", letterSpacing: ".1em", color: "#ECE8DF", whiteSpace: "nowrap" }}>GOT IT</button>
      </div>
    </div>
  );
}
