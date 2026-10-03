/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import type { V } from './types';

/** Slide-in About drawer with site navigation. */
export default function AboutPanel({ v }: { v: V }) {
  return (
    <aside aria-hidden={v.aboutHidden} aria-label="About Innovision" style={{ position: "fixed", inset: "0", zIndex: "60", visibility: v.aboutVis, transition: `visibility 0s linear ${v.aboutDelay}` }}>
      <div onClick={v.closeAbout} style={{ position: "absolute", inset: "0", background: "rgba(10,9,8,.5)", backdropFilter: "blur(4px)", opacity: v.aboutO, transition: "opacity .8s cubic-bezier(.25,1,.1,1)" }}></div>
      <div data-noscroll="" style={{ position: "absolute", top: "0", right: "0", bottom: "0", width: "min(540px, 100%)", padding: "calc(clamp(16px,2.6vw,44px) + 70px) clamp(24px,4vw,56px) 48px", overflowY: "auto", scrollbarWidth: "none", background: "#141312", color: "#ECE8DF", borderLeft: "1.5px solid oklch(0.8 0.12 85)", transform: `translateX(${v.aboutX})`, transition: "transform .8s cubic-bezier(.25,1,.1,1)", fontSize: "17px", lineHeight: "1.6" }}>
        <img src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".35", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <button type="button" onClick={v.closeAbout} onMouseEnter={v.hover} style={{ position: "absolute", top: "-70px", right: "0", padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: "15px", letterSpacing: ".02em", color: "#ECE8DF" }}>
            <span data-scr="">CLOSE</span>
          </button>
          <nav aria-label="Menu" style={{ display: "flex", flexDirection: "column", margin: "0 0 44px", borderTop: "1px solid rgba(236,232,223,.15)" }}>
            {v.navLinks.map((l, lI) => (
              <a key={lI} href={l.href} onClick={l.onClick} onMouseEnter={v.hover} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid rgba(236,232,223,.15)", textDecoration: "none", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "24px", color: l.dc }} className="hv-gold">
                <span data-scr="">{l.label}</span>
                <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
                  <path d="M11 1l4 4-4 4M15 5H0" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
                </svg>
              </a>
            ))}
          </nav>
          <p style={{ margin: "0", fontSize: "13px", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}>MISSION BRIEFING</p>
          <h2 style={{ margin: "10px 0 24px", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(40px,5vw,64px)", lineHeight: "1" }}>INNOVISION</h2>
          <p style={{ margin: "0 0 16px" }}>Innovision is the techno-management fest of NIT Rourkela: a few days where the campus turns into a launch pad for builders, thinkers and makers from across the country.</p>
          <p style={{ margin: "0" }}>Pick your world. <b>Flagship Events</b> for the technical arena, <b>Main Events</b> for workshops and talks, or <b>DTS and Fun Events</b> for the games, quizzes and showcases where the fest peaks.</p>
          <div style={{ margin: "28px 0 36px", borderTop: "1px solid rgba(236,232,223,.15)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "16px", padding: "14px 0", borderBottom: "1px solid rgba(236,232,223,.15)" }}>
              <span style={{ color: "oklch(0.8 0.12 85)" }}>Host</span>
              <span>NIT Rourkela, Odisha</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "16px", padding: "14px 0", borderBottom: "1px solid rgba(236,232,223,.15)" }}>
              <span style={{ color: "oklch(0.8 0.12 85)" }}>Worlds</span>
              <span>Flagship Events · Main Events · DTS and Fun Events</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "16px", padding: "14px 0", borderBottom: "1px solid rgba(236,232,223,.15)" }}>
              <span style={{ color: "oklch(0.8 0.12 85)" }}>Crew</span>
              <span>Students, makers &amp; dreamers</span>
            </div>
          </div>
          <a href="#/worlds/takeoff" onClick={v.closeAbout} onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", color: "#141312", background: "#ECE8DF", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s" }} className="hv-gold-fill">
            <span data-scr="">EXPLORE THE WORLDS</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
