/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { CornerFrame, OrbitBackdrop, Radar } from './decor';
import { Sparkle } from './icons';
import type { V } from './types';

/** Horizontal world slider (Events). */
export default function WorldsView({ v }: { v: V }) {
  return (
    <section data-view="worlds" data-screen-label="Events – Worlds" aria-label="Choose a world" onWheel={v.onWheel} onTouchStart={v.onTouchStart} onTouchEnd={v.onTouchEnd} style={{ position: "absolute", inset: "0", overflow: "hidden", visibility: "hidden" }}>
      {v.worlds.map((w, wI) => (
        <article key={wI} data-slide={wI} aria-label={w.name} style={{ position: "absolute", inset: "0", overflow: "hidden", visibility: "hidden" }}>
          <div style={{ position: "absolute", inset: "0", background: `linear-gradient(180deg,${w.tint} 0%,${w.tint2} 100%)` }}></div>
          <div style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
            <OrbitBackdrop top="54%" />
          </div>
          <Radar depth=".22" top="54%" size={180} mask="radial-gradient(circle,transparent 20%,#000 27%,transparent 58%)" />
          <div data-depth=".55" aria-hidden="true" style={{ position: "absolute", left: w.decoL, top: w.decoT, height: w.decoH, pointerEvents: "none" }}>
            <div style={{ height: "100%", transform: `rotate(${w.decoR})` }}>
              <img src={w.deco} alt="" style={{ height: "100%", width: "auto", filter: "grayscale(1) contrast(1.2) brightness(1.45) drop-shadow(0 18px 24px rgba(0,0,0,.18))", animation: "iv-drift 7s ease-in-out infinite" }} />
            </div>
          </div>
          <div aria-hidden="true" style={{ position: "absolute", left: "calc(clamp(16px,2.6vw,44px) + 36px)", top: "calc(72px + 3vh)", display: "flex", flexDirection: "column", gap: "7px", fontSize: "11px", fontWeight: "700", letterSpacing: ".28em", color: w.ink, pointerEvents: "none" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: w.accent, animation: "iv-blink 1.6s steps(2) infinite" }}></span>
              {w.statLU} · SECTOR {w.secNo}/03
            </span>
            <span style={{ paddingLeft: "17px", fontWeight: "500", opacity: ".8" }}>{w.coord}</span>
          </div>
          <div data-s-outline="" aria-hidden="true" style={{ position: "absolute", left: "0", right: "0", top: "47%", marginTop: "-.5em", overflow: "hidden", whiteSpace: "nowrap", pointerEvents: "none", fontWeight: "700", fontSize: "clamp(120px,21vw,360px)", lineHeight: "1", textTransform: "uppercase", color: "transparent", WebkitTextStroke: `1.5px ${w.stroke}` }}>
            <div data-marquee="36" style={{ display: "inline-flex" }}>
              <span style={{ flex: "none" }}>{w.name}&nbsp;</span>
              <span style={{ flex: "none" }}>{w.name}&nbsp;</span>
            </div>
          </div>
          <a data-s-label="" href={w.href} onMouseEnter={v.beep} style={{ position: "absolute", top: "47%", right: v.labelRight, marginTop: "-.7em", display: "flex", flexDirection: "column", alignItems: "flex-start", textDecoration: "none", fontWeight: "700", fontSize: "clamp(14px,1.15vw,19px)", letterSpacing: ".02em", textTransform: "uppercase", color: w.ink, zIndex: "3" }}>
            <span aria-hidden="true" style={{ position: "absolute", left: "-6px", bottom: "calc(100% + 18px)", width: "112px", height: "112px", pointerEvents: "none" }}>
              <span style={{ position: "absolute", inset: "0", animation: "iv-spin 26s linear infinite" }}>
                <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                  <defs><path id={"seal-" + w.key} d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1 -160 0"></path></defs>
                  <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 6"></circle>
                  <text style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "3.5px", fill: "currentColor" }}><textPath href={"#seal-" + w.key}>{w.sealText}</textPath></text>
                </svg>
              </span>
              <Sparkle style={{ position: "absolute", left: "50%", top: "50%", width: "26px", height: "26px", margin: "-13px 0 0 -13px", color: w.accent }} />
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>Explore <span style={{ width: "28px", height: "2px", background: w.accent }}></span></span>
            <small style={{ marginTop: "8px", fontWeight: "500", fontSize: "11px", letterSpacing: ".25em", opacity: ".8" }}>{w.category}</small>
          </a>
          <div data-s-hero="" style={{ position: "absolute", left: "50%", top: "54%", width: "min(112vw, 150vh)", aspectRatio: "1", marginLeft: "calc(min(112vw, 150vh) / -2)" }}>
            <div data-s-rot="" onClick={w.onExplore} style={{ position: "absolute", inset: "0", cursor: "pointer" }}>
              <img data-spin="140" src={w.planet} alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
            </div>
            <div data-s-astro="" style={{ position: "absolute", left: "0", right: "0", bottom: w.astroBottom, height: w.astroH, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              <img src={w.astro} alt="" style={{ height: "100%", width: "auto", filter: "grayscale(1) contrast(1.3) brightness(1.05) drop-shadow(0 18px 30px rgba(0,0,0,.35))" }} />
            </div>
          </div>
        </article>
      ))}
      <CornerFrame color="rgba(20,19,18,.5)" rulers={['24%', '28%']} style={{ zIndex: 4 }} />
      <button type="button" aria-label="Previous world" onClick={v.prevSlide} onMouseEnter={v.beep} style={{ position: "absolute", top: "64%", left: "clamp(16px,2.6vw,44px)", zIndex: "5", display: v.arrowsDisplay, placeItems: "center", width: "64px", height: "64px", borderRadius: "50%", border: "1.5px solid rgba(20,19,18,.8)", background: "rgba(236,232,223,.4)", color: "#141312", cursor: "pointer", opacity: ".6", transition: "opacity .4s,background-color .4s,color .4s" }} className="hv-arrow">
        <svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px" }}>
          <path d="M14 6l-6 6 6 6M8 12h12" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
        </svg>
      </button>
      <button type="button" aria-label="Next world" onClick={v.nextSlide} onMouseEnter={v.beep} style={{ position: "absolute", top: "64%", right: "clamp(16px,2.6vw,44px)", zIndex: "5", display: v.arrowsDisplay, placeItems: "center", width: "64px", height: "64px", borderRadius: "50%", border: "1.5px solid rgba(20,19,18,.8)", background: "rgba(236,232,223,.4)", color: "#141312", cursor: "pointer", opacity: ".6", transition: "opacity .4s,background-color .4s,color .4s" }} className="hv-arrow">
        <svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px" }}>
          <path d="M10 6l6 6-6 6M16 12H4" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
        </svg>
      </button>
    </section>
  );
}
