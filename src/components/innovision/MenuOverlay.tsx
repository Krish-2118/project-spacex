/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import type { V } from './types';

/** Full-screen circular-reveal menu for narrow screens. */
export default function MenuOverlay({ v }: { v: V }) {
  return (
    <div aria-hidden={v.menuHidden} style={{ position: "fixed", inset: "0", zIndex: "66", visibility: v.menuVis, transition: `visibility 0s linear ${v.menuDelay}` }}>
      <div style={{ position: "absolute", inset: "0", overflow: "hidden", background: "#141312", color: "#ECE8DF", clipPath: v.menuClip, transition: "clip-path .9s cubic-bezier(.25,1,.1,1)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "96px clamp(24px,6vw,64px) 64px" }}>
        <img src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".6", pointerEvents: "none" }} />
        <button type="button" onClick={v.closeMenu} onMouseEnter={v.hover} style={{ position: "absolute", top: "clamp(16px,2.6vw,44px)", right: "clamp(16px,2.6vw,44px)", padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: "13px", letterSpacing: ".18em", color: "#ECE8DF" }}>
          <span data-scr="">CLOSE</span>
        </button>
        <p style={{ position: "relative", margin: "0 0 18px", fontSize: "12px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.84 0.09 85)" }}>NAVIGATE THE ODYSSEY</p>
        <nav aria-label="Menu" style={{ position: "relative", display: "flex", flexDirection: "column", gap: "4px" }}>
          {v.topNav.map((t, tI) => (
            <a key={tI} href={t.href} onClick={t.onClick} onMouseEnter={v.beep} style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(40px,11vw,84px)", lineHeight: "1.08", textDecoration: "none", color: t.menuColor }} className="hv-sand">{t.labelCap}</a>
          ))}
        </nav>
        <div style={{ position: "relative", display: "flex", gap: "28px", marginTop: "36px", fontWeight: "500", fontSize: "14px", letterSpacing: ".14em" }}>
          {!v.showLogin && <a href="#login" onClick={v.menuLogin} style={{ color: "#ECE8DF", textDecoration: "none" }}>{v.noUser ? "LOG IN" : "LOG OUT"}</a>}
          <a href="#about" onClick={v.openAbout} style={{ color: "#ECE8DF", textDecoration: "none" }}>ABOUT</a>
          <a href="https://www.instagram.com/" target="_blank" rel="noopener" style={{ color: "#ECE8DF", textDecoration: "none" }}>INSTAGRAM</a>
        </div>
      </div>
    </div>
  );
}
