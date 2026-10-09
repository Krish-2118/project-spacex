import type { V } from './types';

/** Bottom world switcher shown on the worlds and detail views. */
export default function WorldNav({ v }: { v: V }) {
  return (
    <nav aria-label="Worlds" style={{ position: "fixed", left: "0", right: "0", bottom: v.navBottom, zIndex: "51", display: "flex", justifyContent: "center", padding: "0 8px", pointerEvents: "none", opacity: v.navO, transform: `translateY(${v.navY})`, transition: "opacity .8s cubic-bezier(.25,1,.1,1),transform .8s cubic-bezier(.25,1,.1,1)" }}>
      <div style={{ position: "relative", pointerEvents: v.navPE, padding: "5px", background: "rgba(236,232,223,.78)", border: "1px solid rgba(20,19,18,.2)", borderRadius: "999px", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", boxShadow: "0 20px 40px -20px rgba(20,19,18,.5)" }}>
        <div style={{ position: "relative", display: "flex" }}>
          <span style={{ position: "absolute", top: "0", bottom: "0", left: "0", width: v.navW, borderRadius: "999px", background: v.navGlow, transform: `translateX(${v.navX})`, transition: "transform .9s cubic-bezier(.25,1,.1,1)", pointerEvents: "none" }}></span>
          {v.nav.map((n, nI) => (
            <button key={nI} type="button" onClick={n.onClick} aria-current={n.current} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", width: "clamp(80px,13vw,180px)", padding: "10px 0", borderRadius: "999px", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: "clamp(11px,1.1vw,16px)", letterSpacing: ".02em", color: n.color, transition: "color .5s cubic-bezier(.25,1,.1,1)" }}>
              <small style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".25em", opacity: ".7" }}>{n.no}</small>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
