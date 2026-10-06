/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { Sparkle } from './icons';
import ImageSlot from './ImageSlot';
import type { V } from './types';

/** The Odyssey Store: product grid with colour and size pickers. */
export default function MerchView({ v }: { v: V }) {
  return (
    <main data-view="merch" data-noscroll="" data-screen-label="Merch Store" style={{ position: "absolute", inset: "0", overflowX: "hidden", overflowY: "auto", scrollbarWidth: "none", visibility: "hidden", background: "#ECE8DF" }}>
      <section style={{ position: "relative", padding: "calc(110px + 6vh) clamp(20px,4vw,64px) 56px", background: "#141312", color: "#ECE8DF", overflow: "hidden" }}>
        <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".7", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: "28px" }}>
          <div data-m-reveal="">
            <p style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}><Sparkle style={{ width: "12px", height: "12px" }} />OFFICIAL MERCH · INNOVISION 2026</p>
            <h1 style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(48px,8vw,140px)", lineHeight: ".95" }}>The Odyssey Store</h1>
          </div>
          <p data-m-reveal="" style={{ maxWidth: "400px", margin: "0", fontSize: "17px", lineHeight: "1.6", color: "rgba(236,232,223,.82)", textWrap: "pretty" }}>Limited-run gear for the crew. Pre-order now, collect at the merch desk during the fest.</p>
        </div>
      </section>
      <section style={{ padding: "clamp(48px,8vh,96px) clamp(20px,4vw,64px) calc(clamp(16px,2.6vw,44px) + 200px)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: "56px 24px" }}>
          {v.products.map((p, pI) => (
            <article key={pI} data-m-reveal="" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ position: "relative", aspectRatio: "4 / 5", background: "#DCD7CB" }}>
                <ImageSlot id={p.slot} shape="rect" placeholder={p.ph} loading="lazy" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} />
                {p.hasTag && (
                  <span style={{ position: "absolute", left: "12px", top: "12px", padding: "7px 12px", fontSize: "11px", fontWeight: "700", letterSpacing: ".2em", background: "#141312", color: "#ECE8DF", pointerEvents: "none" }}>{p.tagU}</span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
                <h3 style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "24px", lineHeight: "1.1" }}>{p.name}</h3>
                <span style={{ fontWeight: "700", fontSize: "18px" }}>{p.priceL}</span>
              </div>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.55", color: "#3a3733", textWrap: "pretty" }}>{p.desc}</p>
              {p.hasColors && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ minWidth: "58px", fontSize: "12px", fontWeight: "700", letterSpacing: ".2em", color: "#5c574f" }}>COLOUR</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {p.colors.map((c, cI) => (
                      <button key={cI} type="button" onClick={c.onClick} aria-label={c.n} aria-pressed={c.on} title={c.n} style={{ width: "36px", height: "36px", padding: "0", borderRadius: "50%", border: `2px solid ${c.ring}`, background: c.c, boxShadow: "inset 0 0 0 3px #ECE8DF,inset 0 0 0 4px rgba(20,19,18,.22)", cursor: "pointer" }}></button>
                    ))}
                  </div>
                  <span style={{ fontSize: "14px", color: "#3a3733" }}>{p.colorName}</span>
                </div>
              )}
              {p.hasSizes && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ minWidth: "58px", fontSize: "12px", fontWeight: "700", letterSpacing: ".2em", color: "#5c574f" }}>SIZE</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {p.sizes.map((z, zI) => (
                      <button key={zI} type="button" onClick={z.onClick} aria-pressed={z.on} style={{ minWidth: "40px", height: "36px", padding: "0 10px", border: "1.5px solid #141312", background: z.bg, color: z.fg, fontWeight: "700", fontSize: "13px", cursor: "pointer", transition: "background-color .3s,color .3s" }}>{z.z}</button>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={p.add} style={{ marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 24px", border: "0", cursor: "pointer", fontWeight: "700", fontSize: "14px", letterSpacing: ".08em", color: "#ECE8DF", background: p.addBg, clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)", transition: "background-color .4s" }} className="hv-bronze-bg">{p.addLabel}</button>
            </article>
          ))}
        </div>
        <p style={{ maxWidth: "1240px", margin: "64px auto 0", fontSize: "14px", lineHeight: "1.6", color: "#5c574f" }}>Prices include GST. Pre-orders are collected at the merch desk on campus during the fest.</p>
      </section>
    </main>
  );
}
