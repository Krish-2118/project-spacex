/* eslint-disable @typescript-eslint/ban-ts-comment -- view-model is untyped dynamic GSAP view */
// @ts-nocheck
"use client";

/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { lazyUnlessCritical } from './data';
import type { V } from './types';

const GOLD = "oklch(0.8 0.12 85)";
const STAR = "M12 2.8l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6Z";

/** How far (in degrees) a ticket tilts toward the cursor at its edges. */
const TILT = 8;

/**
 * Ticket hover: writes the cursor position (0-1 across the card) as CSS variables on the card shell. Every part of the
 * effect in globals.css (.sc-card, .sc-card-icon, .sc-diamond) reads them, so nothing re-renders.
 * Mouse only, so a tap on a touch screen doesn't leave the card stuck in its hover pose.
 */
function tiltMove(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget, r = el.getBoundingClientRect(), s = el.style;
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  s.setProperty('--h', '1');
  s.setProperty('--rx', (0.5 - y) * TILT + 'deg');
  s.setProperty('--ry', (x - 0.5) * TILT + 'deg');
  s.setProperty('--px', String((x - 0.5) * 2));
  s.setProperty('--py', String((y - 0.5) * 2));
}

function tiltLeave(e: PointerEvent<HTMLElement>) {
  const s = e.currentTarget.style;
  s.setProperty('--h', '0');
  s.setProperty('--rx', '0deg');
  s.setProperty('--ry', '0deg');
  s.setProperty('--px', '0');
  s.setProperty('--py', '0');
}

function Pin({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", width: size + "px", height: size + "px" }}>
      <path d="M8 15s5-4.6 5-8.6A5 5 0 0 0 3 6.4C3 10.4 8 15 8 15Z" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
      <circle cx="8" cy="6.5" r="1.8" fill="currentColor"></circle>
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
      <path d="M5.5 1.5L1 6M1 6L5.5 10.5M1 6H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
      <path d="M10.5 1.5L15 6M15 6L10.5 10.5M15 6H1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon({ on }: { on?: boolean }) {
  return (
    <svg data-sc-star="" viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px" }}>
      <path
        d="M12 2.2l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 16.77l-5.7 3 1.09-6.36-4.62-4.5 6.38-.93L12 2.2z"
        stroke={on ? "#E5A93C" : "#141312"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={on ? "#E5A93C" : "none"}
        style={{ transition: "all .3s ease" }}
      />
    </svg>
  );
}

function EventIcon({ title }: { title: string }) {
  const t = title.toLowerCase();
  
  if (t.includes('opening') || t.includes('rocket')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="m12 15-3-3a22 22 0 0 1 3.82-13 1.3 1.3 0 0 1 1.49-.38c.62.26 1.48.87 2.19 1.58.71.7 1.32 1.57 1.58 2.19.26.83-.06 1.37-.38 1.49A22 22 0 0 1 12 15Z"/>
        <path d="m9 12 3 3"/>
        <path d="m14 17 3 3"/>
        <path d="m17 14 3 3"/>
      </svg>
    )
  }
  if (t.includes('robotic') || t.includes('bot')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="12" rx="2"/>
        <path d="M12 8v-4"/><path d="M10 4h4"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M9 18h6"/>
      </svg>
    )
  }
  if (t.includes('hackathon') || t.includes('code') || t.includes('web') || t.includes('debug')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    )
  }
  if (t.includes('circuit') || t.includes('hardware') || t.includes('pcb') || t.includes('arm')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="6" width="12" height="12" rx="1"/>
        <path d="M6 9H4"/><path d="M6 15H4"/><path d="M20 9h-2"/><path d="M20 15h-2"/><path d="M9 6V4"/><path d="M15 6V4"/><path d="M9 20v-2"/><path d="M15 20v-2"/>
      </svg>
    )
  }
  if (t.includes('ai') || t.includes('ml') || t.includes('data')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
        <path d="m10.5 6.5-4 4"/><path d="m13.5 6.5 4 4"/><path d="m10.5 17.5-4-4"/><path d="m13.5 17.5 4-4"/><path d="M12 7v10"/>
      </svg>
    )
  }
  if (t.includes('quiz') || t.includes('debate')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        <path d="M9 12h.01"/><path d="M12 12h.01"/><path d="M15 12h.01"/>
      </svg>
    )
  }
  if (t.includes('startup') || t.includes('idea')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.2 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>
      </svg>
    )
  }
  if (t.includes('chess') || t.includes('strategy')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a2 2 0 1 0 0 4 2 2 0 1 0 0-4Z"/><path d="M8 21h8l-1.5-9h-5L8 21Z"/><path d="M12 7v4"/><path d="M9 11h6"/>
      </svg>
    )
  }
  if (t.includes('gaming') || t.includes('esports')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4"/><path d="M8 10v4"/><path d="M15 11h.01"/><path d="M18 13h.01"/>
      </svg>
    )
  }
  if (t.includes('drone') || t.includes('race')) {
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/>
        <path d="m8 8 3.5 3.5"/><path d="m16 16-3.5-3.5"/><path d="m8 16 3.5-3.5"/><path d="m16 8-3.5 3.5"/><rect x="10" y="10" width="4" height="4" rx="1"/>
      </svg>
    )
  }
  
  // Default icon
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/>
    </svg>
  )
}

type Block = V['schedBlocks'][number];

/**
 * One part of the day (morning, afternoon, evening) as a sideways-scrolling row of event tickets.
 * The arrows step by a screenful of cards and switch off at either end (watched with an IntersectionObserver
 * on the first and last card, so nothing runs while the row scrolls).
 * The arrows' disabled state lives only in the DOM, never in a `disabled` prop: React swallows clicks on a button
 * whose props say disabled, so a prop would keep the arrow dead after the observer switched it back on.
 */
function Carousel({ b }: { b: Block }) {
  const track = useRef<HTMLDivElement>(null), prev = useRef<HTMLButtonElement>(null), next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = track.current, first = t?.firstElementChild, last = t?.lastElementChild;
    if (!t || !first || !last) return;
    if (prev.current) prev.current.disabled = t.scrollLeft < 1;
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
        <div className="sc-block-left">
          <div className="sc-block-titles">
            <h3 id={id} className="sc-block-name">{b.name}</h3>
            <span className="sc-block-pill">{b.meta}</span>
          </div>
        </div>
        <div className="sc-block-divider" aria-hidden="true" />
        <div className="sc-nav">
          <button ref={prev} type="button" className="sc-arrow" aria-label={"Earlier " + b.lower + " events"} onClick={() => step(-1)}>
            <ArrowLeft />
          </button>
          <button ref={next} type="button" className="sc-arrow" aria-label={"Later " + b.lower + " events"} onClick={() => step(1)}>
            <ArrowRight />
          </button>
        </div>
      </div>
      <div ref={track} className="sc-track" tabIndex={0} role="group" aria-label={b.name + " events, scrolls sideways"}>
        {b.cards.map((e) => (
          <div
            key={e.id}
            className="sc-card-shell"
            data-world={e.wIdx}
            style={{ "--wc": e.wc } as CSSProperties}
            onPointerMove={tiltMove}
            onPointerLeave={tiltLeave}
          >
            <article className="sc-card" data-on={e.on ? "" : undefined}>
              <span className="sc-card-frame" aria-hidden="true" />
              <span className="sc-card-sheen" aria-hidden="true" />
              <div className="sc-card-top-bg">
                <div className="sc-card-icon-ring">
                  <span className="sc-card-icon">
                    <EventIcon title={e.title} />
                  </span>
                </div>
                
                <button type="button" aria-pressed={e.on} aria-label={e.aria} onClick={e.toggle} className="sc-star-btn">
                  <StarIcon on={e.on} />
                </button>
              </div>

              <div className="sc-card-divider" />

              <div className="sc-card-bottom">
                <p className="sc-time">
                  <strong>{e.t}</strong>
                  <span>{e.ap}</span>
                </p>
                <h4 className="sc-card-title">{e.title}</h4>
                <div className="sc-card-foot">
                  <div className="sc-card-row">
                    <span className="sc-world">
                      <span className="sc-diamond" />
                      {e.wn}
                    </span>
                    <span className="sc-dur">{e.dur}</span>
                  </div>
                  <span className="sc-venue">
                    <Pin size={14} />
                    {e.venue}
                  </span>
                </div>
              </div>
            </article>
          </div>
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
        <img decoding="async" src="/assets/starfield.svg" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".7", pointerEvents: "none" }} />
        <div aria-hidden="true" className="sc-planet">
          <img decoding="async" loading="lazy" data-sc-planet="" src="/assets/planet-crescent.webp" alt="" style={{ width: "100%", height: "100%", animation: "iv-drift 12s ease-in-out infinite" }} />
        </div>
        <div className="sc-hero-copy">
          <p data-sc-reveal="" style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: GOLD }}>FLIGHT PLAN · INNOVISION 2026</p>
          <h1 data-sc-reveal="" className="sc-title">Mission Schedule</h1>
          <p data-sc-reveal="" className="sc-lede">Three days and {v.schedTotal} events across NIT Rourkela. Pick a day, swipe through it by time, and star the ones you can&apos;t miss.</p>
        </div>
        <div role="tablist" aria-label="Fest days" className="sc-tabs">
          {v.schedDays.map((d) => (
            <button
              key={d.no}
              data-sc-tab=""
              type="button"
              role="tab"
              aria-selected={d.sel}
              onClick={d.pick}
              className={`sc-tab-btn ${d.sel ? 'sc-tab-active' : ''}`}
            >
              <div className="sc-tab-planet-wrap">
                <div className="sc-tab-halo" aria-hidden="true" />
                <div className="sc-tab-orbit" aria-hidden="true" />
                <img
                  decoding="async"
                  loading={lazyUnlessCritical(d.img)}
                  src={d.img}
                  alt=""
                  className="sc-tab-planet-img"
                />
              </div>
              <div className="sc-tab-info">
                <span className="sc-tab-no">{d.no}</span>
                <strong className="sc-tab-theme">{d.theme}</strong>
                <span className="sc-tab-meta">{d.meta}</span>
              </div>
              {d.sel && (
                <span className="sc-tab-bar" aria-hidden="true">
                  <span className="sc-tab-flare" />
                </span>
              )}
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
