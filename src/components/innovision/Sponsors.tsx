/* eslint-disable @next/next/no-img-element -- logos keep their own proportions inside fixed cards */
import { Sparkle } from './icons';
import ImageSlot from './ImageSlot';
import { A } from './data';
import type { V } from './types';

const CUT = (n: number) => `polygon(${n}px 0,100% 0,100% calc(100% - ${n}px),calc(100% - ${n}px) 100%,0 100%,0 ${n}px)`;
const SLOT_FILL = { width: "100%", height: "100%", aspectRatio: "auto" };

/**
 * The sponsors line-up: the title sponsor in a featured card, then one endlessly scrolling logo ticker
 * per tier, alternating direction; a ticker pauses while hovered, pressed or holding keyboard focus
 * (globals.css, .sp-row). Tiers and logos come from SPONSOR_TIERS in data.ts.
 */
export default function Sponsors({ v }: { v: V }) {
  const t = v.titleSponsor;
  return (
    <>
      <div data-reveal="" className="sp-title" style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: "clamp(20px,4vw,56px)", padding: "clamp(28px,4.5vw,60px)", background: "#141312", color: "#ECE8DF", clipPath: CUT(20) }}>
        <img src={A + "stars.webp"} alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".55", pointerEvents: "none" }} />
        <span aria-hidden="true" style={{ position: "absolute", right: "-12%", top: "50%", width: "min(70vw, 640px)", aspectRatio: "1", transform: "translateY(-50%)", borderRadius: "50%", border: "1px dashed rgba(236,232,223,.16)", pointerEvents: "none" }}></span>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "18px", minWidth: "0" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}><Sparkle style={{ width: "12px", height: "12px" }} />TITLE SPONSOR</span>
          <p style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(26px,3.2vw,46px)", lineHeight: "1.05" }}>Innovision 2026, presented by</p>
          <a href={t.url || undefined} target={t.url ? "_blank" : undefined} rel={t.url ? "noopener noreferrer" : undefined} aria-label={t.name || "Title sponsor"} style={{ display: "block", width: "min(100%, 480px)", aspectRatio: "3 / 1", padding: t.logo ? "clamp(14px,2vw,24px)" : "0", background: "#ECE8DF", color: "#141312", clipPath: CUT(12), cursor: t.url ? "pointer" : "default" }}>
            {t.logo ? <img src={t.logo} alt={t.name || ""} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <ImageSlot id="sponsor-title-logo" shape="rect" fit="contain" placeholder="Title sponsor logo" style={SLOT_FILL} />}
          </a>
        </div>
        <div className="sp-title-art" aria-hidden="true" style={{ position: "relative", width: "clamp(130px,15vw,210px)", alignSelf: "end", pointerEvents: "none" }}>
          <div data-float="">
            <img src={A + "sponsor-title.webp"} alt="" style={{ width: "100%", height: "auto", filter: "grayscale(1) contrast(1.2) drop-shadow(0 24px 30px rgba(0,0,0,.45))" }} />
          </div>
        </div>
      </div>

      {v.sponsorTiers.map((tier, ti) => (
        <div key={tier.key} data-reveal="" style={{ marginTop: "clamp(44px,7vh,72px)" }}>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "6px 14px", marginBottom: "18px" }}>
            <h3 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(24px,2.4vw,34px)", lineHeight: "1.1" }}>{tier.title}</h3>
            <span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: ".12em", color: "#5c574f" }}>{tier.countL}</span>
          </div>
          {/* Endless ticker: the strip holds the logos twice and slides by one copy, so it loops without a seam. */}
          <div role="region" aria-label={tier.title} className="sp-row">
            <div className={ti % 2 ? "sp-strip sp-strip-rev" : "sp-strip"} style={{ ["--sp-dur" as string]: tier.dur }}>
              {[0, 1].map((copy) => tier.loop.map((c, k) => {
                const style = { flex: "none", display: "grid", placeItems: "center", width: tier.lg ? "clamp(210px, 22vw, 290px)" : "clamp(160px, 16vw, 220px)", aspectRatio: "16 / 10", marginRight: "14px", padding: c.logo ? "13%" : "0", border: "1px solid rgba(20,19,18,.14)", background: "rgba(20,19,18,.03)", color: "#141312", textDecoration: "none" } as const;
                // The second copy and any repeats are there only to keep the loop full: hidden from screen readers and Tab.
                const extra = copy === 1 || k >= tier.cards.length;
                const inner = c.logo ? <img src={c.logo} alt={extra ? "" : c.name || ""} draggable={false} className="sp-logo" /> : <ImageSlot id={c.slot} shape="rect" fit="contain" placeholder={c.ph} style={SLOT_FILL} />;
                return c.url
                  ? <a key={copy + "-" + k} href={c.url} target="_blank" rel="noopener noreferrer" aria-label={extra ? undefined : c.name} aria-hidden={extra || undefined} tabIndex={extra ? -1 : undefined} title={c.name} className="sp-card" style={style}>{inner}</a>
                  : <div key={copy + "-" + k} aria-hidden={extra || undefined} title={c.name} className="sp-card" style={style}>{inner}</div>;
              }))}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
