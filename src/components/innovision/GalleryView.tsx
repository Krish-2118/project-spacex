/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { Sparkle } from './icons';
import ImageSlot from './ImageSlot';
import type { V } from './types';

/** Z-axis "travel inward" gallery. */
export default function GalleryView({ v }: { v: V }) {
  return (
    <section data-view="gallery" data-screen-label="Gallery" aria-label="Gallery" onWheel={v.gWheel} onTouchStart={v.gTouchStart} onTouchMove={v.gTouchMove} style={{ position: "absolute", inset: "0", overflow: "hidden", visibility: "hidden", background: "#0e0d0c", color: "#ECE8DF", touchAction: "none" }}>
      <img data-g-stars="" src="/assets/stars.webp" alt="" style={{ position: "absolute", left: "-5%", top: "-5%", width: "110%", height: "110%", objectFit: "cover", opacity: ".85", pointerEvents: "none" }} />
      <div data-g-glow="" style={{ position: "absolute", left: "calc(50% - 5vmin)", top: "calc(50% - 5vmin)", width: "10vmin", height: "10vmin", borderRadius: "50%", background: "#ECE8DF", boxShadow: "0 0 60px 20px rgba(236,232,223,.2),0 0 160px 60px rgba(201,162,74,.14)", pointerEvents: "none" }}></div>
      <div style={{ position: "absolute", inset: "0", perspective: "1000px", perspectiveOrigin: "50% 50%", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "0", transformStyle: "preserve-3d" }}>
          {v.gDust.map((d, dI) => (
            <span key={dI} data-g-dust="" style={{ position: "absolute", left: "50%", top: "50%", width: d.s, height: d.s, borderRadius: "50%", background: "#ECE8DF", pointerEvents: "none" }}></span>
          ))}
          {v.gallery.map((g, gI) => (
            <figure key={gI} data-g-item={gI} onClick={g.onFocus} style={{ position: "absolute", left: "50%", top: "50%", width: g.w, height: g.h, margin: "0", cursor: "pointer", opacity: "0" }}>
              <div style={{ position: "absolute", inset: "0", padding: "10px", background: "#1b1a18", border: "1px solid rgba(236,232,223,.4)", boxShadow: "0 30px 60px rgba(0,0,0,.5)" }}>
                <ImageSlot id={g.id} shape="rect" placeholder="Drop a fest photo" />
              </div>
              <figcaption style={{ position: "absolute", left: "0", top: "calc(100% + 12px)", display: "flex", gap: "12px", fontSize: "12px", fontWeight: "500", letterSpacing: ".2em", whiteSpace: "nowrap" }}>
                <span style={{ color: "oklch(0.84 0.09 85)" }}>{g.no}</span>
                <span>{g.titleU}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div data-g-ui="" style={{ position: "absolute", left: "clamp(16px,2.6vw,44px)", bottom: "calc(clamp(16px,2.6vw,44px) + 56px)", pointerEvents: "none", mixBlendMode: "difference", color: "#fff" }}>
        <p style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 10px", fontSize: "12px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.84 0.09 85)" }}><Sparkle style={{ width: "12px", height: "12px" }} />THE ARCHIVE</p>
        <h1 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(48px,7vw,112px)", lineHeight: ".9" }}>Gallery</h1>
        <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginTop: "18px", fontSize: "13px", letterSpacing: ".18em" }}>
          <span style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "28px", letterSpacing: "0" }}>{v.gCur.no}</span>
          <span style={{ opacity: ".6" }}>/ {v.gTotal}</span>
          <span>{v.gCur.titleU}</span>
        </div>
      </div>
      <div data-g-ui="" style={{ position: "absolute", right: "clamp(16px,2.6vw,44px)", top: "50%", marginTop: "-90px", width: "1.5px", height: "180px", background: "rgba(236,232,223,.2)", pointerEvents: "none" }}>
        <span data-g-bar="" style={{ position: "absolute", inset: "0", background: "#ECE8DF", transformOrigin: "top", transform: "scaleY(0)" }}></span>
      </div>
      <div data-g-ui="" style={{ position: "absolute", left: "0", right: "0", bottom: "calc(clamp(16px,2.6vw,44px) + 6px)", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div data-g-hint="" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", fontSize: "12px", letterSpacing: ".3em", transition: "opacity .6s" }}>
          <span>SCROLL TO TRAVEL INWARD</span>
          <i data-hint-line="" style={{ display: "block", width: "1.5px", height: "30px", background: "linear-gradient(#ECE8DF,transparent)" }}></i>
        </div>
      </div>
      <div data-g-end="" style={{ position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px", padding: "0 20px", textAlign: "center", color: "#141312", opacity: "0", pointerEvents: "none", transition: "opacity .6s" }}>
        <p style={{ margin: "0", fontSize: "12px", fontWeight: "700", letterSpacing: ".3em" }}>END OF THE ARCHIVE</p>
        <h2 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(34px,5vw,72px)", lineHeight: "1.02" }}>More memories land<br />after the fest.</h2>
        <button type="button" onClick={v.gRestart} onMouseEnter={v.hover} style={{ marginTop: "10px", padding: "16px 28px", border: "0", background: "#141312", color: "#ECE8DF", fontWeight: "700", fontSize: "14px", letterSpacing: ".06em", cursor: "pointer", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }}>
          <span data-scr="">BACK TO THE START</span>
        </button>
      </div>
    </section>
  );
}
