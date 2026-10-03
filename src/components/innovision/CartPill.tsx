import type { V } from './types';

/** Floating cart summary shown on the store. */
export default function CartPill({ v }: { v: V }) {
  return (
    <div style={{ position: "fixed", left: "0", right: "0", bottom: "calc(clamp(16px,2.6vw,44px) + 52px)", zIndex: "55", display: "flex", justifyContent: "center", padding: "0 12px", pointerEvents: "none", opacity: v.cartO, transform: `translateY(${v.cartY})`, transition: "opacity .6s cubic-bezier(.25,1,.1,1),transform .6s cubic-bezier(.25,1,.1,1)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px", padding: "8px 8px 8px 22px", background: "#141312", color: "#ECE8DF", pointerEvents: v.cartPE, clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }}>
        <span style={{ fontSize: "14px", fontWeight: "500" }}>{v.cartCountL}</span>
        <strong style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "20px" }}>{v.cartTotal}</strong>
        <button type="button" onClick={v.openBag} onMouseEnter={v.beep} style={{ padding: "12px 6px", border: "0", background: "none", cursor: "pointer", fontSize: "13px", letterSpacing: ".08em", color: "rgba(236,232,223,.78)" }} className="hv-paper">VIEW BAG</button>
        <button type="button" onClick={v.clearCart} style={{ padding: "12px 6px", border: "0", background: "none", cursor: "pointer", fontSize: "13px", letterSpacing: ".08em", color: "rgba(236,232,223,.78)" }} className="hv-paper">CLEAR</button>
        <button type="button" onClick={v.checkout} onMouseEnter={v.beep} style={{ padding: "14px 22px", border: "0", background: "#ECE8DF", color: "#141312", fontWeight: "700", fontSize: "14px", letterSpacing: ".06em", cursor: "pointer", transition: "background-color .3s" }} className="hv-gold-bg">CHECKOUT</button>
      </div>
    </div>
  );
}
