/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { useEffect, useRef, type CSSProperties } from 'react';
import { Sparkle } from './icons';
import { lazyUnlessCritical } from './data';
import type { V } from './types';

const GOLD = "oklch(0.8 0.12 85)";

function Pin({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", width: size + "px", height: size + "px" }}>
      <path d="M8 15s5-4.6 5-8.6A5 5 0 0 0 3 6.4C3 10.4 8 15 8 15Z" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
      <circle cx="8" cy="6.5" r="1.8" fill="currentColor"></circle>
    </svg>
  );
}

const STAR = "M12 2.8l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6Z";

/**
 * Mission Schedule: three fest days as tabs, a world filter, and a timeline whose line fills and
 * whose rocket descends as the list scrolls (Innovision#schedPaint). Starred events persist locally.
 */
export default function ScheduleView({ v }: { v: V }) {
  return (
    <main data-view="schedule" data-noscroll="" data-screen-label="Schedule" onScroll={v.schedScroll} style={{ position: "absolute", inset: "0", overflowX: "hidden", overflowY: "auto", scrollbarWidth: "none", visibility: "hidden", background: "#ECE8DF", color: "#141312" }}>
      <section style={{ position: "relative", padding: "calc(110px + 6vh) clamp(20px,4vw,64px) 0", background: "#141312", color: "#ECE8DF", overflow: "hidden" }}>
        <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".7", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", right: "max(-14vw, -220px)", top: "-12vh", width: "min(62vw, 760px)", aspectRatio: "1", opacity: ".55", pointerEvents: "none" }}>
          <img decoding="async" data-sc-planet="" src="/assets/planet-crescent.webp" alt="" style={{ width: "100%", height: "100%", animation: "iv-drift 12s ease-in-out infinite" }} />
        </div>
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "100%", width: "180vmax", height: "180vmax", margin: "-90vmax 0 0 -90vmax", borderRadius: "50%", border: "1px dashed rgba(236,232,223,.14)", pointerEvents: "none" }}></div>
        <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: "28px" }}>
          <div data-sc-reveal="">
            <p style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: GOLD }}><Sparkle style={{ width: "12px", height: "12px" }} />FLIGHT PLAN · INNOVISION 2026</p>
            <h1 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(48px,8vw,140px)", lineHeight: ".95" }}>Mission Schedule</h1>
          </div>
          <p data-sc-reveal="" style={{ maxWidth: "400px", margin: "0", fontSize: "17px", lineHeight: "1.6", color: "rgba(236,232,223,.82)", textWrap: "pretty" }}>Three days, thirty-six missions across NIT Rourkela. Star the ones you can&apos;t miss and they stay in your plan.</p>
        </div>
        <div role="tablist" aria-label="Fest days" style={{ position: "relative", maxWidth: "1240px", margin: "clamp(40px,7vh,72px) auto 0", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", borderTop: "1px solid rgba(236,232,223,.18)" }}>
          {v.schedDays.map((d) => (
            <button key={d.no} data-sc-tab="" type="button" role="tab" aria-selected={d.sel} onClick={d.pick} onMouseEnter={v.beep} className="hv-link-paper" style={{ position: "relative", display: "flex", alignItems: "center", gap: "clamp(10px,1.4vw,20px)", minWidth: "0", padding: "clamp(18px,3vh,28px) clamp(8px,1.6vw,24px) clamp(22px,3.4vh,32px)", border: "0", borderLeft: `1px solid ${d.sep}`, background: "none", color: "#ECE8DF", textAlign: "left", cursor: "pointer", opacity: d.o, transition: "opacity .4s" }}>
              <span style={{ flex: "none", display: d.imgD, width: "clamp(44px,5vw,72px)", aspectRatio: "1" }}>
                <img decoding="async" src={d.img} alt="" style={{ width: "100%", height: "100%", transform: `scale(${d.ps}) rotate(${d.pr})`, transition: "transform .9s cubic-bezier(.34,1.56,.64,1)" }} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".24em", color: GOLD }}>{d.no}</span>
                <strong style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(20px,2.6vw,38px)", lineHeight: "1" }}>{d.theme}</strong>
                <span style={{ fontSize: "14px", color: "rgba(236,232,223,.72)" }}>{d.meta}</span>
              </span>
              <span style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "3px", background: GOLD, transform: `scaleX(${d.bar})`, transformOrigin: d.barO, transition: "transform .7s cubic-bezier(.25,1,.1,1)" }}></span>
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: "clamp(40px,7vh,80px) clamp(20px,4vw,64px) calc(clamp(16px,2.6vw,44px) + 180px)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <div data-sc-reveal="" style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: "20px 32px", marginBottom: "clamp(28px,5vh,48px)" }}>
            <div data-sc-title="">
              <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "700", letterSpacing: ".24em", color: "#5c574f" }}>{v.schedKicker}</p>
              <h2 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(34px,4.6vw,64px)", lineHeight: "1" }}>{v.schedHeading}</h2>
            </div>
            <div role="group" aria-label="Filter events" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {v.schedChips.map((c) => (
                <button key={c.label} type="button" aria-pressed={c.on} onClick={c.pick} onMouseEnter={v.beep} style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px", padding: "0 16px", border: "1.5px solid #141312", borderRadius: "999px", background: c.bg, color: c.fg, cursor: "pointer", fontWeight: "700", fontSize: "13px", letterSpacing: ".06em", transition: "background-color .3s,color .3s" }}>
                  <span style={{ display: c.dotD, width: "9px", height: "9px", transform: "rotate(45deg)", background: c.dot }}></span>
                  <span>{c.label}</span>
                  <span style={{ fontWeight: "500", opacity: ".72" }}>{c.n}</span>
                </button>
              ))}
            </div>
          </div>

          <div data-sc-list="" style={{ position: "relative" }}>
            <div aria-hidden="true" style={{ position: "absolute", left: v.lineL, top: "0", bottom: "0", width: "1.5px", marginLeft: "-.75px", background: "rgba(20,19,18,.14)" }}>
              <div data-sc-fill="" style={{ position: "absolute", inset: "0", background: "#141312", transform: "scaleY(0)", transformOrigin: "top" }}></div>
            </div>
            <div data-sc-rocket="" aria-hidden="true" style={{ position: "absolute", left: v.lineL, top: "0", zIndex: "2", width: "0", height: "0", pointerEvents: "none" }}>
              <img decoding="async" src="/assets/spaceship.webp" alt="" style={{ position: "absolute", left: "-15px", top: "-44px", width: "30px", height: "auto", transform: "rotate(180deg)", filter: MONO }} />
            </div>
            {v.schedRows.map((e) => (
              <article key={e.id} data-sc-row="" className="hv-row" style={{ position: "relative", display: "grid", gridTemplateColumns: v.rowCols, alignItems: "start", padding: "22px 0", borderBottom: "1px solid rgba(20,19,18,.12)", transition: "background-color .35s" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", paddingRight: "clamp(10px,1.6vw,22px)" }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
                    <strong style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: v.timeFs, lineHeight: "1" }}>{e.t}</strong>
                    <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".08em" }}>{e.ap}</span>
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".14em", color: "#5c574f" }}>{e.dur}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", paddingTop: "8px" }}>
                  <span data-sc-node="" style={{ position: "relative", zIndex: "1", width: "15px", height: "15px", border: "1.5px solid #141312", borderRadius: "50%", background: "#ECE8DF" }}></span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "0", paddingLeft: "clamp(6px,1vw,14px)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", letterSpacing: ".16em" }}>
                    <span style={{ width: "9px", height: "9px", transform: "rotate(45deg)", background: e.wc }}></span>{e.wn}
                  </span>
                  <h3 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(21px,2vw,28px)", lineHeight: "1.12", textWrap: "balance" }}>{e.title}</h3>
                  <span style={{ display: v.venueInD, alignItems: "center", gap: "6px", fontSize: "15px", color: "#3a3733" }}><Pin size={14} />{e.venue}</span>
                </div>
                <div style={{ display: v.venueColD, alignItems: "center", gap: "8px", paddingTop: "24px", fontSize: "15px", lineHeight: "1.4", color: "#3a3733" }}><Pin size={15} /><span>{e.venue}</span></div>
                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px" }}>
                  <button type="button" aria-pressed={e.on} aria-label={e.aria} onClick={e.toggle} style={{ display: "grid", placeItems: "center", width: "44px", height: "44px", padding: "0", border: "0", background: "none", cursor: "pointer", color: "#141312" }}>
                    <svg data-sc-star="" viewBox="0 0 24 24" aria-hidden="true" style={{ width: "22px", height: "22px" }}>
                      <path d={STAR} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" style={{ fill: e.star, transition: "fill .3s" }}></path>
                    </svg>
                  </button>
                </div>
              </article>
            ))}
            {v.schedEmpty && (
              <div data-sc-row="" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "64px 20px", textAlign: "center" }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "30px", height: "30px" }}>
                  <path d={STAR} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"></path>
                </svg>
                <p style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "24px" }}>Nothing starred yet</p>
                <p style={{ margin: "0", maxWidth: "36ch", fontSize: "16px", lineHeight: "1.55", color: "#3a3733" }}>Tap the star on any event and it shows up here for {v.schedDayName}.</p>
              </div>
            )}
          </div>
          <p style={{ margin: "40px 0 0", fontSize: "14px", lineHeight: "1.6", color: "#5c574f" }}>Timings may shift during the fest. Check this page or the help desk for the latest updates.</p>
        </div>
      </section>
    </main>
  );
}
