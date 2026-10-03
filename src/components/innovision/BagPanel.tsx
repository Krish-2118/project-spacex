/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { Sparkle } from './icons';
import type { V } from './types';

/** Shopping bag drawer (opened from the store's cart pill). */
export default function BagPanel({ v }: { v: V }) {
  return (
    <aside aria-hidden={v.bagHidden} aria-label="Your bag" style={{ position: "fixed", inset: "0", zIndex: "62", visibility: v.bagVis, transition: `visibility 0s linear ${v.bagDelay}` }}>
      <div onClick={v.closeBag} style={{ position: "absolute", inset: "0", background: "rgba(10,9,8,.5)", backdropFilter: "blur(4px)", opacity: v.bagO, transition: "opacity .8s cubic-bezier(.25,1,.1,1)" }}></div>
      <div style={{ position: "absolute", top: "0", right: "0", bottom: "0", width: "min(460px, 100%)", display: "flex", flexDirection: "column", background: "#ECE8DF", color: "#141312", borderLeft: "1.5px solid #141312", transform: `translateX(${v.bagX})`, transition: "transform .8s cubic-bezier(.25,1,.1,1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", padding: "clamp(24px,3vw,36px) clamp(22px,3vw,36px) 22px", borderBottom: "1px solid rgba(20,19,18,.16)" }}>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: "700", letterSpacing: ".3em", color: "#8a6a2a" }}>YOUR BAG · {v.bagCountStr}</p>
            <h2 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "32px", lineHeight: "1" }}>The Cargo Hold</h2>
          </div>
          <button type="button" onClick={v.closeBag} onMouseEnter={v.hover} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: "13px", letterSpacing: ".18em", color: "#141312" }}>
            <span data-scr="">CLOSE</span>
          </button>
        </div>
        <div data-noscroll="" style={{ flex: "1", overflowY: "auto", scrollbarWidth: "none", padding: "8px clamp(22px,3vw,36px)" }}>
          {v.bagEmpty && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "64px 0", textAlign: "center", color: "#4a4641" }}>
              <Sparkle style={{ width: "22px", height: "22px", color: "#8a6a2a" }} />
              <p style={{ margin: "0", maxWidth: "260px", fontSize: "15px", lineHeight: "1.6" }}>Your bag is floating in zero gravity. Add something from the collection.</p>
            </div>
          )}
          {v.bagLines.map((l, lI) => (
            <div key={lI} style={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr) auto", gap: "14px", alignItems: "center", padding: "18px 0", borderBottom: "1px solid rgba(20,19,18,.12)" }}>
              <div style={{ position: "relative", width: "56px", height: "56px", borderRadius: "50%", overflow: "hidden", background: "#141312" }}>
                <img src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ minWidth: "0" }}>
                <div style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "16px", lineHeight: "1.2" }}>{l.name}</div>
                <div style={{ marginTop: "4px", fontSize: "13px", color: "#4a4641" }}>{l.meta}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
                  <button type="button" aria-label="Decrease" onClick={l.dec} style={{ width: "30px", height: "30px", border: "1px solid rgba(20,19,18,.4)", background: "none", cursor: "pointer", fontSize: "16px", lineHeight: "1" }}>−</button>
                  <span style={{ minWidth: "18px", textAlign: "center", fontWeight: "700" }}>{l.qty}</span>
                  <button type="button" aria-label="Increase" onClick={l.inc} style={{ width: "30px", height: "30px", border: "1px solid rgba(20,19,18,.4)", background: "none", cursor: "pointer", fontSize: "16px", lineHeight: "1" }}>+</button>
                  <button type="button" onClick={l.remove} style={{ marginLeft: "6px", padding: "0", border: "0", background: "none", cursor: "pointer", fontSize: "12px", letterSpacing: ".12em", textDecoration: "underline", color: "#4a4641" }}>REMOVE</button>
                </div>
              </div>
              <span style={{ alignSelf: "start", fontWeight: "700" }}>{l.lineStr}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "22px clamp(22px,3vw,36px) clamp(24px,3vw,36px)", borderTop: "1px solid rgba(20,19,18,.16)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: ".2em" }}>SUBTOTAL</span>
            <span style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "26px" }}>{v.subtotalStr}</span>
          </div>
          <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#4a4641" }}>Pay and collect at the Innovision merch desk.</p>
          <button type="button" onClick={v.checkout} onMouseEnter={v.hover} style={{ width: "100%", padding: "17px 20px", border: "0", background: "#141312", color: "#ECE8DF", fontWeight: "700", fontSize: "14px", letterSpacing: ".1em", cursor: "pointer", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .3s" }} className="hv-bronze-bg">
            <span data-scr="">CHECKOUT</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
