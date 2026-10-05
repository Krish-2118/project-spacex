/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { CornerFrame, OrbitBackdrop, Radar } from './decor';
import Rover from './Rover';
import SignalLink from './SignalLink';
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
          {w.deco && (
            <div data-depth=".55" aria-hidden="true" style={{ position: "absolute", left: w.decoL, top: w.decoT, height: w.decoH, pointerEvents: "none" }}>
              <div style={{ height: "100%", transform: `rotate(${w.decoR})` }}>
                <img decoding="async" src={w.deco} alt="" style={{ height: "100%", width: "auto", mixBlendMode: "multiply", filter: "grayscale(1) contrast(1.2) brightness(1.45) drop-shadow(0 18px 24px rgba(0,0,0,.18))", animation: "iv-drift 7s ease-in-out infinite" }} />
              </div>
            </div>
          )}
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
          {/*
            The way into this world: a round Enter button on the planet's face. Pointer devices show a quiet
            "hover the planet" prompt in its place until the planet (or the prompt) is hovered or the button has
            keyboard focus. Touch devices, which can't hover, always show the button, with a hand demonstrating a
            tap the first time it appears.
            GSAP fades [data-s-label] in and out with the slide, so the hover swap lives on its children (globals.css).
          */}
          <div className="cta-slot" style={{ position: "absolute", left: "0", right: "0", zIndex: "3", display: "flex", justifyContent: "center", padding: "0 16px", pointerEvents: "none" }}>
            <div data-s-label="" className="cta-wrap" style={{ position: "relative", display: "grid", placeItems: "center", maxWidth: "100%", filter: "drop-shadow(0 14px 22px rgba(20,19,18,.28))" }}>
              <span className="cta-prompt" aria-hidden="true" style={{ gridArea: "1 / 1", display: "inline-flex", alignItems: "center", gap: "10px", padding: "9px 16px 9px 12px", borderRadius: "999px", border: "1px solid rgba(20,19,18,.14)", background: "rgba(236,232,223,.86)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: "#141312", fontSize: "13px", fontWeight: "700", letterSpacing: ".04em", whiteSpace: "nowrap", pointerEvents: "auto", cursor: "default" }}>
                <span style={{ position: "relative", display: "grid", placeItems: "center", width: "22px", height: "22px" }}>
                  <span data-prompt-ring="" style={{ position: "absolute", left: "3px", top: "2px", width: "10px", height: "10px", borderRadius: "50%", border: `1.5px solid ${w.accent}` }}></span>
                  <svg data-prompt-cursor="" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 3l14 7.2-6.1 1.6L10 18z" fill="#141312" stroke="#ECE8DF" strokeWidth="1.2" strokeLinejoin="round"></path></svg>
                </span>
                Hover over the planet to enter
              </span>
              <a href={w.href} aria-label={"Enter " + w.name} className="world-cta-round" style={{ ["--cta-accent" as string]: w.accentL, gridArea: "1 / 1", position: "relative", placeItems: "center", width: "clamp(72px, 19vw, 88px)", aspectRatio: "1", borderRadius: "50%", textDecoration: "none", color: "#ECE8DF", background: "#141312", boxShadow: "0 0 0 1.5px rgba(236,232,223,.55)", WebkitTapHighlightColor: "transparent" }}>
                <span data-cta-ping="" aria-hidden="true" style={{ position: "absolute", inset: "0", borderRadius: "50%", border: `1.5px solid ${w.accentL}` }}></span>
                <span aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", letterSpacing: ".18em" }}>
                  <span style={{ paddingLeft: ".18em" }}>ENTER</span>
                  <svg width="18" height="10" viewBox="0 0 16 10"><path d="M11 1l4 4-4 4M15 5H0" fill="none" stroke={w.accentL} strokeWidth="1.6"></path></svg>
                </span>
              </a>
              {/* Touch coach: a hand taps the round button three times, then fades out. Its fingertip (19,7 of the 44px icon) lands on the button's centre. */}
              <svg className="cta-hand" viewBox="0 0 24 24" aria-hidden="true" style={{ position: "absolute", left: "calc(50% - 19px)", top: "calc(50% - 7px)", zIndex: "1", width: "44px", height: "44px", overflow: "visible", pointerEvents: "none" }}>
                <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.8-2.4L4.4 15.6a1.5 1.5 0 0 1 2.3-1.9L9 16" fill="#ECE8DF" stroke="#141312" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
          </div>
          <div data-s-hero="" style={{ position: "absolute", left: "50%", top: "54%", width: "min(112vw, 150vh)", aspectRatio: "1", marginLeft: "calc(min(112vw, 150vh) / -2)" }}>
            <div data-s-rot="" onClick={w.onExplore} style={{ position: "absolute", inset: "0", cursor: "pointer" }}>
              <img decoding="async" data-spin="140" src={w.planet} alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
              {w.rover && <Rover />}
              {w.uplink && <SignalLink accent={w.accent} />}
            </div>
            <div data-s-astro="" style={{ position: "absolute", left: "0", right: "0", bottom: w.astroBottom, height: w.astroH, display: "flex", justifyContent: "center", alignItems: "flex-end", pointerEvents: "none" }}>
              {w.astro && (wI === 0 ? (
                <div data-orbit-fast="" data-arc-orbit="85" data-dur="35" style={{ height: "100%", width: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end", transformOrigin: `50% calc(100% + min(56vw, 75vh) - ${w.astroSit ? '7vh' : '3.5vh'})` }}>
                  <img decoding="async" src={w.astro} alt="" style={{ height: "45%", width: "auto", filter: "grayscale(1) contrast(1.3) brightness(1.05) drop-shadow(0 18px 30px rgba(0,0,0,.35))" }} />
                </div>
              ) : (
                <img decoding="async" src={w.astro} alt="" style={{ height: "100%", width: "auto", filter: "grayscale(1) contrast(1.3) brightness(1.05) drop-shadow(0 18px 30px rgba(0,0,0,.35))", ...w.astroStyle }} />
              ))}
            </div>
          </div>
        </article>
      ))}
      <CornerFrame color="rgba(20,19,18,.5)" rulers={['24%', '28%']} style={{ zIndex: 4 }} />
      <button type="button" aria-label="Previous world" onClick={v.prevSlide} style={{ position: "absolute", top: "64%", left: "clamp(16px,2.6vw,44px)", zIndex: "5", display: v.arrowsDisplay, placeItems: "center", width: "64px", height: "64px", borderRadius: "50%", border: "1.5px solid rgba(20,19,18,.8)", background: "rgba(236,232,223,.4)", color: "#141312", cursor: "pointer", opacity: ".6", transition: "opacity .4s,background-color .4s,color .4s" }} className="hv-arrow">
        <svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px" }}>
          <path d="M14 6l-6 6 6 6M8 12h12" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
        </svg>
      </button>
      <button type="button" aria-label="Next world" onClick={v.nextSlide} style={{ position: "absolute", top: "64%", right: "clamp(16px,2.6vw,44px)", zIndex: "5", display: v.arrowsDisplay, placeItems: "center", width: "64px", height: "64px", borderRadius: "50%", border: "1.5px solid rgba(20,19,18,.8)", background: "rgba(236,232,223,.4)", color: "#141312", cursor: "pointer", opacity: ".6", transition: "opacity .4s,background-color .4s,color .4s" }} className="hv-arrow">
        <svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px" }}>
          <path d="M10 6l6 6-6 6M16 12H4" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
        </svg>
      </button>
    </section>
  );
}
