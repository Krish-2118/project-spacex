/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import type { CSSProperties } from 'react';
import { Sparkle } from './icons';
import { CornerFrame } from './decor';
import Sponsors from './Sponsors';
import ImageSlot from './ImageSlot';
import { LiveFooter } from './SiteFooter';
import { imgSize } from './data';
import type { V } from './types';

/** Landing page: sticky hero, marquee bands, briefing, odyssey map, gallery tunnel, sponsors, merch teaser and closing call to action. */
export default function HomeView({ v }: { v: V }) {
  return (
    <main data-view="home" data-noscroll="" data-screen-label="Home" style={{ position: "absolute", inset: "0", overflowX: "hidden", overflowY: "auto", scrollbarWidth: "none", visibility: "hidden" }}>
      <div data-hero-wrap="" style={{ position: "relative", height: "calc(max(100vh, 620px) + 45vh)" }}>
        <section data-hero="" className="hero" style={{ position: "sticky", top: "0", height: "100vh", minHeight: "620px", overflow: "hidden" }}>
          {/* will-change keeps the scroll-scrubbed scale from re-rastering every layer inside the hero each frame. */}
          <div data-h-par="" style={{ position: "absolute", inset: "0", background: "#ECE8DF", willChange: "transform" }}>
            {/* Disc size and centre come from .hero in globals.css, so rings, disc, copy and astronaut stay locked together on every screen shape. */}
            <div data-depth=".12" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
              <div data-h-ring="" className="hero-ring" style={{ "--r": ".58", border: "1px solid rgba(20,19,18,.26)" } as CSSProperties}>
                <div data-orbit="" data-dur="70" data-start="40" style={{ position: "absolute", inset: "0" }}>
                  <span style={{ position: "absolute", left: "50%", top: "0", width: "12px", height: "12px", margin: "-6px 0 0 -6px", borderRadius: "50%", background: "#141312" }}></span>
                </div>
              </div>
              <div data-h-ring="" className="hero-ring" style={{ "--r": ".71", border: "1px dashed rgba(20,19,18,.4)" } as CSSProperties}>
                <div data-orbit="" data-dur="120" data-start="232" style={{ position: "absolute", inset: "0" }}>
                  <img decoding="async" src="/assets/asteroid.webp" alt="" className="hero-asteroid" style={{ position: "absolute", left: "50%", top: "0", height: "auto", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
                </div>
              </div>
              <div data-h-ring="" className="hero-ring" style={{ "--r": ".89", border: "1px dotted rgba(20,19,18,.5)" } as CSSProperties}>
                <div data-orbit="" data-dur="200" data-start="318" data-rev="1" style={{ position: "absolute", inset: "0" }}>
                  <img decoding="async" src="/assets/planet-ringed.webp" alt="" className="hero-ringed" style={{ position: "absolute", left: "50%", top: "0", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
                </div>
              </div>
            </div>
            {/* Own layer: the cursor pull nudges it every frame, which otherwise re-rasters the starfield. */}
            <div data-hero-disc="" data-attract=".03" className="hero-disc" style={{ borderRadius: "50%", background: "#141312", overflow: "hidden", willChange: "transform" }}>
              <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".95" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "conic-gradient(from 0deg,transparent 0 292deg,rgba(236,232,223,.16) 360deg)", animation: "iv-spin 14s linear infinite" }}></span>
              <span aria-hidden="true" style={{ position: "absolute", inset: "18%", borderRadius: "50%", border: "1px dashed rgba(236,232,223,.12)" }}></span>
              <span style={{ position: "absolute", inset: "4%", borderRadius: "50%", border: "1px solid rgba(236,232,223,.14)" }}></span>
            </div>
            <div data-depth=".8" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
              <div data-float="" data-attract=".05" style={{ position: "absolute", left: "-4%", top: "-10%", width: "108%", height: "106%", clipPath: "inset(0 0 58% 0)" }}>
                <img decoding="async" src="/assets/home-rocks.webp" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.4)" }} />
              </div>
              <div data-float="" data-attract=".05" style={{ position: "absolute", left: "-9%", top: "31%", width: "108%", height: "106%", clipPath: "inset(40% 0 0 0)" }}>
                <img decoding="async" src="/assets/home-rocks.webp" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.4)" }} />
              </div>
            </div>
            {v.heroSparks.map((s, sI) => (
              <div key={sI} data-h-spark="" data-attract=".45" style={{ position: "absolute", left: s.x, top: s.y, width: s.s, height: s.s, color: s.c, pointerEvents: "none" }}>
                <Sparkle data-twinkle="" style={{ display: "block", width: "100%", height: "100%" }} />
              </div>
            ))}
            <div data-depth=".6" className="hero-planet" style={{ pointerEvents: "none" }}>
              <div data-h-planet="" data-attract=".1" style={{ width: "100%", height: "100%" }}>
                {/* The storm texture is lit from one side, so it holds still instead of spinning. */}
                <img decoding="async" src="/assets/planet-storm.webp" alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
              </div>
            </div>
            <div data-depth=".4" className="hero-astro" style={{ display: "flex", justifyContent: "flex-end", pointerEvents: "none" }}>
              <div data-h-astro="" data-attract=".14" style={{ width: "100%", height: "100%" }}>
                {/* Same box and tilt as the image, so the bob moves it exactly as before while the filter stays static. */}
                <div data-bob="" style={{ width: "fit-content", height: "100%", marginLeft: "auto", transform: "rotate(-8deg)" }}>
                  <img decoding="async" src="/assets/indian-astronaut.webp" alt="Astronaut drifting beside the celestial disc" style={{ height: "100%", width: "auto", filter: "grayscale(1) contrast(1.12) drop-shadow(0 24px 30px rgba(0,0,0,.35))" }} />
                </div>
              </div>
            </div>
            <div className="hero-copy" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", pointerEvents: "none" }}>
              {/* Wide screens: display contents, so copy and buttons share one centred column. Stacked screens: a box the size of the disc. */}
              <div className="hero-copy-disc">
                <div data-h-kicker="" data-attract=".1" className="hero-kicker" style={{ display: "flex", alignItems: "center", color: "#ECE8DF", fontFamily: "var(--font-cinzel),serif", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <Sparkle className="hero-kicker-star" style={{ color: "oklch(0.8 0.12 85)" }} />
                  <span className="hero-track">NIT ROURKELA PRESENTS</span>
                  <Sparkle className="hero-kicker-star" style={{ color: "oklch(0.8 0.12 85)" }} />
                </div>
                <h1 aria-label="Innovision" className="hero-title" style={{ display: "flex", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", lineHeight: ".95", letterSpacing: ".01em", color: "#fff", mixBlendMode: "difference", whiteSpace: "nowrap" }}>
                  {v.heroChars.map((c, cI) => (
                    <span key={cI} data-h-ch="" data-attract=".22" style={{ display: "inline-block" }}>{c.ch}</span>
                  ))}
                </h1>
                <div data-h-sub="" data-attract=".1" className="hero-sub" style={{ display: "flex", alignItems: "center", color: "oklch(0.8 0.12 85)", fontFamily: "var(--font-cinzel),serif", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <span className="hero-sub-rule" style={{ height: "1px", background: "currentColor" }}></span>
                  <span className="hero-track">2026 · THE CELESTIAL ODYSSEY</span>
                  <span className="hero-sub-rule" style={{ height: "1px", background: "currentColor" }}></span>
                </div>
              </div>
              <div className="hero-ctas" style={{ display: "flex", justifyContent: "center", pointerEvents: "auto" }}>
                <div data-h-cta="" className="hero-cta-slot">
                  <a data-magnet="" href="#/worlds/flagship-events" onMouseEnter={v.hover} className="hero-cta hero-cta-primary hv-gold-fill" style={{ clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s cubic-bezier(.25,1,.1,1), color .4s cubic-bezier(.25,1,.1,1)" }}>
                    <span data-scr="">BEGIN THE ODYSSEY</span>
                  </a>
                </div>
                <div data-h-cta="" className="hero-cta-slot">
                  <a data-magnet="" href="#register" onClick={v.register} onMouseEnter={v.hover} onPointerEnter={v.prefetchAuth} onPointerDown={v.prefetchAuth} onFocus={v.prefetchAuth} className="hero-cta hero-cta-secondary hv-gold" style={{ position: "relative", isolation: "isolate", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }}>
                    <span className="hero-cta-fill" style={{ position: "absolute", inset: "1.5px", zIndex: "-1", clipPath: "polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)" }}></span>
                    <span data-scr="">REGISTER</span>
                  </a>
                </div>
              </div>
            </div>
            {/* Scroll cue: sits on the HUD's bottom line in the same frosted chip, so it reads over the paper and the dark disc alike. Clicking it scrolls on.
                Stacked screens drop it: there it would collide with INSTAGRAM and SOUND. */}
            <div className="hero-scroll" style={{ position: "absolute", left: "0", right: "0", bottom: "clamp(16px,2.6vw,44px)", zIndex: "3", justifyContent: "center", marginBottom: "-8px", pointerEvents: "none" }}>
            <button data-h-scroll="" type="button" onClick={v.scrollNext} className="hv-scroll-cue" style={{ display: "inline-flex", alignItems: "center", gap: "12px", padding: "9px 18px 9px 14px", pointerEvents: "auto", border: "1px solid rgba(20,19,18,.14)", borderRadius: "999px", background: "rgba(236,232,223,.88)", backdropFilter: "blur(14px) saturate(1.2)", WebkitBackdropFilter: "blur(14px) saturate(1.2)", boxShadow: "0 12px 30px -16px rgba(20,19,18,.45)", color: "#141312", cursor: "pointer", fontWeight: "700", fontSize: "13px", letterSpacing: ".12em", whiteSpace: "nowrap" }}>
              <svg viewBox="0 0 16 24" aria-hidden="true" style={{ width: "15px", height: "23px", overflow: "visible" }}>
                <rect x="1" y="1" width="14" height="22" rx="7" fill="none" stroke="currentColor" strokeWidth="1.6"></rect>
                <circle data-scroll-wheel="" cx="8" cy="7" r="1.9" fill="currentColor"></circle>
              </svg>
              <span>SCROLL TO EXPLORE</span>
            </button>
            </div>
            <CornerFrame color="rgba(20,19,18,.5)">
              <span className="hero-coords" style={{ position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%) rotate(180deg)", writingMode: "vertical-rl", fontSize: "11px", fontWeight: "700", letterSpacing: ".3em", color: "#141312" }}>22.2533° N · 84.9011° E · NIT ROURKELA</span>
            </CornerFrame>
            {/* Scroll dimming: black at opacity a matches filter: brightness(1 - a) on the whole hero, but
                fades on the compositor instead of re-filtering the full-screen scene every frame. */}
            <div data-h-dim="" aria-hidden="true" style={{ position: "absolute", inset: "0", background: "#000", opacity: "0", willChange: "opacity", pointerEvents: "none" }}></div>
          </div>
        </section>
      </div>
      <div data-bands="" aria-hidden="true" style={{ position: "relative", zIndex: "4", height: "0", marginTop: "-45vh", pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "-10vw", right: "-10vw", top: "48px", transform: "rotate(-2.4deg)", background: "oklch(0.8 0.12 85)", color: "#141312", overflow: "hidden", padding: "clamp(6px,.55vw,9px) 0", boxShadow: "0 14px 30px rgba(20,19,18,.22)" }}>
          <div data-marquee="46" data-rev="1" style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
            {v.bandA.map((b, bI) => (
              <span key={bI} style={{ display: "inline-flex", alignItems: "center", gap: "clamp(14px,1.4vw,22px)", paddingRight: "clamp(14px,1.4vw,22px)", fontWeight: "700", fontSize: "clamp(11px,1vw,15px)", letterSpacing: ".04em", lineHeight: "1" }}><Sparkle style={{ width: ".8em", height: ".8em", flex: "none" }} />{b.t}</span>
            ))}
            {v.bandA.map((b, bI) => (
              <span key={bI} style={{ display: "inline-flex", alignItems: "center", gap: "clamp(14px,1.4vw,22px)", paddingRight: "clamp(14px,1.4vw,22px)", fontWeight: "700", fontSize: "clamp(11px,1vw,15px)", letterSpacing: ".04em", lineHeight: "1" }}><Sparkle style={{ width: ".8em", height: ".8em", flex: "none" }} />{b.t}</span>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", left: "-10vw", right: "-10vw", top: "48px", transform: "rotate(2.4deg)", background: "#141312", color: "#ECE8DF", overflow: "hidden", padding: "clamp(6px,.55vw,9px) 0", boxShadow: "0 14px 30px rgba(20,19,18,.22)" }}>
          <div data-marquee="34" style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
            {v.bandB.map((b, bI) => (
              <span key={bI} style={{ display: "inline-flex", alignItems: "center", gap: "clamp(14px,1.4vw,22px)", paddingRight: "clamp(14px,1.4vw,22px)", fontWeight: "700", fontSize: "clamp(11px,1vw,15px)", letterSpacing: ".04em", lineHeight: "1" }}><Sparkle style={{ width: ".8em", height: ".8em", flex: "none" }} />{b.t}</span>
            ))}
            {v.bandB.map((b, bI) => (
              <span key={bI} style={{ display: "inline-flex", alignItems: "center", gap: "clamp(14px,1.4vw,22px)", paddingRight: "clamp(14px,1.4vw,22px)", fontWeight: "700", fontSize: "clamp(11px,1vw,15px)", letterSpacing: ".04em", lineHeight: "1" }}><Sparkle style={{ width: ".8em", height: ".8em", flex: "none" }} />{b.t}</span>
            ))}
          </div>
        </div>
      </div>
      <section style={{ position: "relative", zIndex: "2", padding: "clamp(110px,18vh,200px) clamp(20px,4vw,64px) clamp(96px,14vh,160px)", background: "#ECE8DF", boxShadow: "0 -40px 80px rgba(20,19,18,.28)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <h2 aria-label="For a few days, NIT Rourkela turns into a launch pad for builders, thinkers and makers from across the country." style={{ display: "flex", flexWrap: "wrap", alignItems: "center", rowGap: ".14em", margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(34px,5.2vw,84px)", lineHeight: "1.08", letterSpacing: "-.01em" }}>
            {v.briefWords.map((bw, bwI) => (
              <span key={bwI} data-fill="" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", marginRight: ".26em" }}>
                {bw.isImg ? (
                  <span style={{ position: "relative", display: "block", width: "1.9em", height: ".92em", borderRadius: "999px", overflow: "hidden", background: "#141312 url(/assets/stars.webp) center/cover", boxShadow: "inset 0 0 0 1.5px rgba(20,19,18,.8)" }}>
                    <img decoding="async" src={bw.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: bw.pos, filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
                  </span>
                ) : bw.t}
              </span>
            ))}
          </h2>
          <div data-reveal="" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "clamp(32px,5vw,80px)", marginTop: "clamp(48px,8vh,96px)", paddingTop: "28px", borderTop: "1px solid rgba(20,19,18,.18)" }}>
            <p style={{ margin: "0", maxWidth: "60ch", fontSize: "18px", lineHeight: "1.65", color: "#2b2926", textWrap: "pretty" }}>Innovision is the techno-management fest of NIT Rourkela. This year it charts a Celestial Odyssey across three worlds: <b>Flagship Events</b> for the technical arena, <b>Main Events</b> for workshops and talks, and <b>DTS and Fun Events</b> for the games, quizzes and showcases where the fest peaks.</p>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", margin: "0", alignSelf: "start" }}>
              {[['HOST', 'NIT Rourkela, Odisha'], ['WORLDS', 'Three, each with its own line-up'], ['CREW', 'Students, makers & dreamers']].map(([dt, dd]) => (
                <div key={dt} style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 18px", borderLeft: "1px dashed rgba(20,19,18,.3)" }}>
                  <dt style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".28em", color: "#8a6a2a" }}>{dt}</dt>
                  <dd style={{ margin: "0", fontSize: "16px", fontWeight: "500", lineHeight: "1.4" }}>{dd}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
      <section style={{ position: "relative", padding: "clamp(96px,14vh,160px) clamp(20px,4vw,64px)", background: "#141312", color: "#ECE8DF", overflow: "hidden" }}>
        <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".7", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto" }}>
          <header data-reveal="" style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "48px" }}>
            <h2 data-attract=".05" style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(36px,5vw,80px)", lineHeight: "1" }}>The Odyssey Map</h2>
            <p style={{ maxWidth: "52ch", margin: "0", fontSize: "16px", lineHeight: "1.6", color: "rgba(236,232,223,.8)", textWrap: "pretty" }}>Three worlds, three kinds of mission. Each one opens into its own line-up of events.</p>
          </header>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
            {v.worlds.map((w, wI) => (
              <a key={wI} data-reveal="" data-map-panel="" href={w.href} onMouseEnter={w.onEnter} onFocus={w.onEnter} style={{ position: "relative", isolation: "isolate", flex: "1 1 280px", minWidth: "0", height: "clamp(480px,68vh,640px)", overflow: "hidden", textDecoration: "none", color: "#ECE8DF", clipPath: "polygon(0 0,100% 0,100% calc(100% - 36px),calc(100% - 36px) 100%,0 100%)" }}>
                <span style={{ position: "absolute", inset: "0", zIndex: "-3", background: w.accentL, opacity: ".6" }}></span>
                <span style={{ position: "absolute", inset: "1.5px", zIndex: "-2", background: "radial-gradient(rgba(236,232,223,.07) 1px,transparent 1.3px) 0 0/16px 16px,linear-gradient(170deg,#23211e,#141312 75%)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 35px),calc(100% - 35px) 100%,0 100%)" }}></span>
                <div data-card-planet="" style={{ position: "absolute", zIndex: "-1", right: "-22%", top: "14%", width: "clamp(280px,86%,540px)", aspectRatio: "1" }}>
                  <img decoding="async" data-spin="160" src={w.planet} alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
                  <span style={{ position: "absolute", inset: "-8%", borderRadius: "50%", border: "1px dashed rgba(236,232,223,.28)" }}></span>
                </div>
                <span style={{ position: "absolute", inset: "36% 0 0", zIndex: "-1", background: "linear-gradient(180deg,rgba(20,19,18,0),rgba(20,19,18,.94) 68%)" }}></span>
                <div style={{ position: "absolute", left: "28px", right: "28px", top: "26px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px" }}>
                  <span style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(48px,5vw,72px)", lineHeight: ".9", color: "transparent", WebkitTextStroke: `1.5px ${w.accentL}` }}>{w.secNo}</span>
                  <span style={{ paddingTop: "8px", fontSize: "12px", fontWeight: "700", letterSpacing: ".28em", textAlign: "right", color: w.accentL }}>{w.statLU}</span>
                </div>
                <div style={{ position: "absolute", left: "28px", right: "28px", bottom: "44px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".28em", color: w.accentL }}>{w.categoryU}</span>
                  <h3 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(28px,2.8vw,42px)", lineHeight: "1.05", textWrap: "balance" }}>{w.name}</h3>
                  <div data-map-more="" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "20px", maxWidth: "380px" }}>
                    <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "rgba(236,232,223,.85)", textWrap: "pretty" }}>{w.tagline}</p>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "12px", padding: "13px 22px", fontWeight: "700", fontSize: "13px", letterSpacing: ".12em", color: "#141312", background: "#ECE8DF", clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)" }}>
                      EXPLORE WORLD
                      <svg width="16" height="10" viewBox="0 0 16 10">
                        <path d="M11 1l4 4-4 4M15 5H0" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
                      </svg>
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section data-sec="gallery" data-tunnel="" aria-label="Gallery" style={{ position: "relative", height: "600vh", background: "#141312", color: "#ECE8DF" }}>
        <div style={{ position: "sticky", top: "0", height: "100vh", overflow: "hidden" }}>
          <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".75", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: "0", perspective: "900px", perspectiveOrigin: "50% 50%" }}>
            <div style={{ position: "absolute", inset: "0", transformStyle: "preserve-3d" }}>
              {v.tunnel.map((g, gI) => (
                <figure key={gI} data-t-frame="" style={{ position: "absolute", left: `calc(50% + ${g.x})`, top: `calc(50% + ${g.y})`, width: "clamp(220px,30vw,460px)", margin: "0", transform: "translate(-50%,-50%) translate3d(0,0,-6000px)", willChange: "transform,opacity" }}>
                  <div style={{ position: "relative", aspectRatio: g.ar, background: "#1b1a18", border: "1px solid rgba(236,232,223,.18)" }}>
                    <ImageSlot id={g.id} shape="rect" placeholder={g.ph} style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} />
                  </div>
                  <figcaption style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginTop: "12px", fontSize: "13px", fontWeight: "700", letterSpacing: ".2em" }}>
                    <span style={{ color: g.c }}>{g.no}</span>
                    <span>{g.capU}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          <header style={{ position: "absolute", left: "clamp(20px,4vw,64px)", top: "calc(72px + 4vh)", maxWidth: "440px", pointerEvents: "none" }}>
            <p style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}><Sparkle style={{ width: "12px", height: "12px" }} />GALLERY</p>
            <h2 data-attract=".05" style={{ margin: "0 0 14px", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(34px,4.4vw,68px)", lineHeight: "1" }}>Into the archive</h2>
            <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", color: "rgba(236,232,223,.82)", textWrap: "pretty" }}>Keep scrolling to fly through moments from Innovision past.</p>
          </header>
          <div style={{ position: "absolute", left: "clamp(20px,4vw,64px)", bottom: "calc(clamp(16px,2.6vw,44px) + 64px)", display: "flex", alignItems: "baseline", gap: "10px", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", pointerEvents: "none" }}>
            <span data-t-count="" style={{ fontSize: "clamp(36px,4vw,60px)", lineHeight: "1" }}>01</span>
            <span style={{ fontSize: "18px", color: "rgba(236,232,223,.7)" }}>/ {v.tunnelTotal}</span>
          </div>
        </div>
      </section>
      <section data-sec="sponsors" aria-label="Sponsors" style={{ position: "relative", padding: "clamp(96px,16vh,180px) clamp(20px,4vw,64px)", background: "#ECE8DF" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <header data-reveal="" style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: "24px", marginBottom: "56px" }}>
            <div>
              <p style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: "#8a6a2a" }}><Sparkle style={{ width: "12px", height: "12px" }} />OUR CO-PILOTS</p>
              <h2 data-attract=".05" style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(36px,5vw,80px)", lineHeight: "1" }}>Sponsors &amp; partners</h2>
            </div>
            <p style={{ maxWidth: "380px", margin: "0", fontSize: "16px", lineHeight: "1.6", color: "#3a3733", textWrap: "pretty" }}>The brands fuelling Innovision 2026. Full line-up announced closer to launch.</p>
          </header>
          <Sponsors v={v} />
          <div data-reveal="" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px", marginTop: "clamp(48px,7vh,72px)", paddingTop: "28px", borderTop: "1px solid rgba(20,19,18,.14)" }}>
            <p style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(22px,2.2vw,32px)" }}>Want your brand in orbit?</p>
            <a data-magnet="" href="#sponsor" onClick={v.sponsorCta} onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s cubic-bezier(.25,1,.1,1)", color: "#ECE8DF", background: "#141312" }} className="hv-bronze-fill">
              <span data-scr="">BECOME A SPONSOR</span>
            </a>
          </div>
        </div>
      </section>
      <section data-sec="merch" aria-label="Merch" style={{ position: "relative", padding: "clamp(96px,14vh,160px) clamp(20px,4vw,64px)", background: "#141312", color: "#ECE8DF", overflow: "hidden" }}>
        <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".6", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "clamp(40px,6vw,96px)", alignItems: "center" }}>
          <div data-reveal="">
            <p style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}><Sparkle style={{ width: "12px", height: "12px" }} />OFFICIAL MERCH</p>
            <h2 data-attract=".05" style={{ margin: "0 0 18px", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(40px,5.4vw,88px)", lineHeight: "1" }}>Wear the odyssey.</h2>
            <p style={{ margin: "0 0 32px", maxWidth: "420px", fontSize: "17px", lineHeight: "1.6", color: "rgba(236,232,223,.82)", textWrap: "pretty" }}>Limited-run tees, hoodies and keepsakes. Pre-order online, collect on campus during the fest.</p>
            <a data-magnet="" href="#/merch" onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s cubic-bezier(.25,1,.1,1)", color: "#141312", background: "#ECE8DF" }} className="hv-gold-fill">
              <span data-scr="">VISIT THE STORE</span>
            </a>
          </div>
          <div data-reveal="" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "14px" }}>
            {v.merchTeaser.map((t, tI) => (
              <a key={tI} href="#/merch" style={{ display: "flex", flexDirection: "column", gap: "10px", textDecoration: "none", color: "#ECE8DF" }}>
                <div data-attract=".08" style={{ position: "relative", aspectRatio: "4 / 5", background: "#26241f", pointerEvents: "none" }}>
                  <ImageSlot id={t.slot} shape="rect" placeholder={t.ph} style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} />
                </div>
                <span style={{ fontSize: "14px", fontWeight: "700" }}>{t.name}</span>
                <span style={{ fontSize: "14px", color: "rgba(236,232,223,.75)" }}>{t.priceL}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section data-launch-sec="" style={{ position: "relative", overflow: "hidden", padding: "clamp(110px,18vh,200px) clamp(20px,4vw,64px) clamp(260px,40vh,420px)", textAlign: "center", background: "#ECE8DF" }}>
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "100%", width: "220vmax", height: "220vmax", margin: "-110vmax 0 0 -110vmax", borderRadius: "50%", background: "repeating-conic-gradient(from 0deg,rgba(20,19,18,.09) 0deg .5deg,transparent .5deg 5deg)", WebkitMaskImage: "radial-gradient(circle,transparent 22%,#000 28%,transparent 52%)", maskImage: "radial-gradient(circle,transparent 22%,#000 28%,transparent 52%)", pointerEvents: "none" }}></div>
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: "calc(min(130vw, 1700px) * -.8)", width: "min(130vw, 1700px)", aspectRatio: "1", marginLeft: "calc(min(130vw, 1700px) / -2)", pointerEvents: "none" }}>
          <img decoding="async" data-spin="480" src="/assets/planet-green.webp" alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
        </div>
        <div data-launch="" aria-hidden="true" style={{ position: "absolute", right: "clamp(20px,11vw,220px)", bottom: "16%", display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
          <img decoding="async" src="/assets/spaceship.webp" alt="" style={{ height: "min(34vh, 320px)", width: "auto", filter: "grayscale(1) contrast(1.35) brightness(1.05) drop-shadow(0 18px 24px rgba(0,0,0,.2))" }} />
          <span style={{ width: "3.6vh", height: "8vh", marginTop: "-1.4vh", borderRadius: "45% 45% 50% 50% / 20% 20% 80% 80%", background: "radial-gradient(ellipse 50% 100% at 50% 0,#fff,rgba(255,244,230,.75) 45%,transparent 100%)", transformOrigin: "50% 0", animation: "iv-flame .16s ease-in-out infinite alternate" }}></span>
          <span style={{ width: "2px", height: "70vh", background: "repeating-linear-gradient(180deg,rgba(20,19,18,.45) 0 8px,transparent 8px 18px)" }}></span>
        </div>
        <div data-reveal="" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Sparkle style={{ width: "28px", height: "28px", color: "#8a6a2a" }} />
          <h2 data-attract=".05" style={{ margin: "22px 0 22px", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(48px,8.4vw,150px)", lineHeight: ".95", letterSpacing: "-.01em" }}>The odyssey<br />awaits.</h2>
          <p style={{ margin: "0 auto 36px", maxWidth: "520px", fontSize: "18px", lineHeight: "1.6", color: "#3a3733", textWrap: "pretty" }}>Innovision 2026 is boarding soon at NIT Rourkela. Claim your seat on the voyage.</p>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>
            <a data-magnet="" href="#register" onClick={v.register} onMouseEnter={v.hover} onPointerEnter={v.prefetchAuth} onPointerDown={v.prefetchAuth} onFocus={v.prefetchAuth} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", color: "#ECE8DF", background: "#141312", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s cubic-bezier(.25,1,.1,1)" }} className="hv-bronze-fill">
              <span data-scr="">REGISTER</span>
            </a>
            <a data-magnet="" href="#/worlds/flagship-events" onMouseEnter={v.hover} style={{ position: "relative", isolation: "isolate", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", color: "#141312", background: "#141312", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }} className="hv-bronze">
              <span style={{ position: "absolute", inset: "1.5px", zIndex: "-1", background: "#ECE8DF", clipPath: "polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)" }}></span>
              <span data-scr="">EXPLORE THE WORLDS</span>
            </a>
          </div>
        </div>
      </section>
      <LiveFooter />
    </main>
  );
}
