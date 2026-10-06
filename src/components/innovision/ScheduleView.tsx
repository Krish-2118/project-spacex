/* eslint-disable @typescript-eslint/ban-ts-comment -- view-model is untyped dynamic GSAP view */
// @ts-nocheck
"use client";

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

function Arrow({ flip }: { flip?: boolean }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true" style={{ transform: flip ? "scaleX(-1)" : undefined }}>
      <path d="M5 1 1 5l4 4M1 5h15" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
    </svg>
  );
}

const STAR = "M12 2.8l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6Z";

type Block = V['schedBlocks'][number];

/**
 * One part of the day (morning, afternoon, evening) as a sideways-scrolling row of event tickets.
 * The arrows step by a screenful of cards and switch off at either end (watched with an IntersectionObserver
 * on the first and last card, so nothing runs while the row scrolls).
 */
function Carousel({ b }: { b: Block }) {
  const track = useRef<HTMLDivElement>(null), prev = useRef<HTMLButtonElement>(null), next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = track.current, first = t?.firstElementChild, last = t?.lastElementChild;
    if (!t || !first || !last) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const on = e.intersectionRatio > .96;
      if (e.target === first && prev.current) prev.current.disabled = on;
      if (e.target === last && next.current) next.current.disabled = on;
    }), { root: t, threshold: [0, .5, .96, 1] });
    io.observe(first); io.observe(last);
    return () => io.disconnect();
  }, []);
  const step = (dir: number) => {
    const t = track.current, card = t?.firstElementChild as HTMLElement | null;
    if (!t || !card) return;
    const w = card.offsetWidth + (parseFloat(getComputedStyle(t).columnGap) || 0), n = Math.max(1, Math.floor((t.clientWidth * .8) / w));
    t.scrollBy({ left: dir * n * w, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const id = 'sc-' + b.key;
  return (
    <section data-sc-row="" className="sc-block" aria-labelledby={id}>
      <div className="sc-block-head">
        <div>
          <h3 id={id} className="sc-block-name">{b.name}</h3>
          <p className="sc-block-meta">{b.meta}</p>
        </div>
        <div className="sc-nav">
          <button ref={prev} type="button" className="sc-arrow" aria-label={"Earlier " + b.lower + " events"} onClick={() => step(-1)} disabled><Arrow /></button>
          <button ref={next} type="button" className="sc-arrow" aria-label={"Later " + b.lower + " events"} onClick={() => step(1)}><Arrow flip /></button>
        </div>
      </div>
      <div ref={track} className="sc-track" tabIndex={0} role="group" aria-label={b.name + " events, scrolls sideways"}>
        {b.cards.map((e) => (
          <article key={e.id} className="sc-card" data-on={e.on ? "" : undefined} style={{ "--wc": e.wc } as CSSProperties}>
            <div className="sc-card-in">
              <div className="sc-card-top">
                <p className="sc-time"><strong>{e.t}</strong><span>{e.ap}</span></p>
                <button type="button" aria-pressed={e.on} aria-label={e.aria} onClick={e.toggle} className="sc-star">
                  <svg data-sc-star="" viewBox="0 0 24 24" aria-hidden="true" style={{ width: "22px", height: "22px" }}>
                    <path d={STAR} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" style={{ fill: e.star, transition: "fill .3s" }}></path>
                  </svg>
                </button>
              </div>
              <h4 className="sc-card-title">{e.title}</h4>
              <div className="sc-card-foot">
                <span className="sc-card-row">
                  <span className="sc-world"><span className="sc-diamond"></span>{e.wn}</span>
                  <span className="sc-dur">{e.dur}</span>
                </span>
                <span className="sc-venue"><Pin size={14} />{e.venue}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Mission Schedule: three fest days as tabs; the chosen day splits into morning, afternoon and evening rows
 * of event tickets that scroll sideways. Starred events persist locally.
 */
export default function ScheduleView({ v }: { v: V }) {
  return (
    <main data-view="schedule" data-noscroll="" data-screen-label="Schedule" style={{ position: "absolute", inset: "0", overflowX: "hidden", overflowY: "auto", scrollbarWidth: "none", visibility: "hidden", background: "#ECE8DF", color: "#141312" }}>
      <section className="sc-hero">
        <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".7", pointerEvents: "none" }} />
        <div aria-hidden="true" className="sc-planet">
          <img decoding="async" loading="lazy" data-sc-planet="" src="/assets/planet-crescent.webp" alt="" style={{ width: "100%", height: "100%", animation: "iv-drift 12s ease-in-out infinite" }} />
        </div>
        <div className="sc-hero-copy">
          <p data-sc-reveal="" style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: GOLD }}><Sparkle style={{ width: "12px", height: "12px" }} />FLIGHT PLAN · INNOVISION 2026</p>
          <h1 data-sc-reveal="" className="sc-title">Mission Schedule</h1>
          <p data-sc-reveal="" className="sc-lede">Three days and {v.schedTotal} events across NIT Rourkela. Pick a day, swipe through it by time, and star the ones you can&apos;t miss.</p>
        </div>
        <div role="tablist" aria-label="Fest days" className="sc-tabs">
          {v.schedDays.map((d) => (
            <button key={d.no} data-sc-tab="" type="button" role="tab" aria-selected={d.sel} onClick={d.pick} className="hv-link-paper" style={{ position: "relative", display: "flex", alignItems: "center", gap: "clamp(10px,1.4vw,20px)", minWidth: "0", padding: "clamp(18px,3vh,28px) clamp(8px,1.6vw,24px) clamp(22px,3.4vh,32px)", border: "0", borderLeft: `1px solid ${d.sep}`, background: "none", color: "#ECE8DF", textAlign: "left", cursor: "pointer", opacity: d.o, transition: "opacity .4s" }}>
              <span style={{ flex: "none", display: d.imgD, width: "clamp(44px,5vw,72px)", aspectRatio: "1" }}>
                <img decoding="async" loading={lazyUnlessCritical(d.img)} src={d.img} alt="" style={{ width: "100%", height: "100%", transform: `scale(${d.ps}) rotate(${d.pr})`, transition: "transform .9s cubic-bezier(.34,1.56,.64,1)" }} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".24em", color: GOLD }}>{d.no}</span>
                <strong style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(20px,2.6vw,38px)", lineHeight: "1" }}>{d.theme}</strong>
                <span style={{ fontSize: "14px", color: "rgba(236,232,223,.72)" }}>{d.meta}</span>
              </span>
              <span style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "3px", background: GOLD, transform: `scaleX(${d.bar})`, transformOrigin: d.barO, transition: "transform .7s cubic-bezier(.25,1,.1,1)" }}></span>
            </button>
          ))}
        </div>
      </section>

      <section className="sc-body">
        <div data-sc-reveal="" className="sc-wrap">
          <div data-sc-title="" className="sc-day">
            <h2 className="sc-day-name">{v.schedHeading}</h2>
            <p className="sc-day-meta">
              <span>{v.schedMeta}</span>
              {v.schedStarred && (
                <span className="sc-day-starred">
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "15px", height: "15px" }}>
                    <path d={STAR} fill={GOLD} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"></path>
                  </svg>
                  {v.schedStarred}
                </span>
              )}
            </p>
          </div>
        </div>
        <div data-sc-list="">
          {v.schedBlocks.map((b) => <Carousel key={b.key} b={b} />)}
        </div>
        <p className="sc-wrap sc-note">Timings may shift during the fest. Check this page or the help desk for the latest updates.</p>
      </section>
    </main>
  );
}
