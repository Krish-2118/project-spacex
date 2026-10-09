/* eslint-disable @typescript-eslint/ban-ts-comment -- view-model props are untyped across the views */
// @ts-nocheck
"use client";
/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import type { CSSProperties } from 'react';
import { Sparkle } from './icons';
import { CornerFrame } from './decor';
import Sponsors from './Sponsors';
import ImageSlot from './ImageSlot';
import { LiveFooter } from './SiteFooter';
import type { V } from './types';

/** Landing page: sticky hero, briefing, odyssey map, gallery tunnel, sponsors, merch teaser and closing call to action. */
export default function HomeView({ v }: { v: V }) {
  return (
    <main data-view="home" data-noscroll="" data-screen-label="Home" style={{ position: "absolute", inset: "0", overflowX: "hidden", overflowY: "auto", scrollbarWidth: "none", visibility: "hidden" }}>
      {/* Two screens tall: the hero stays pinned for a full screen of scroll while the briefing (pulled up by the same amount) slides over it. */}
      <div data-hero-wrap="" style={{ position: "relative", height: "calc(max(100vh, 620px) * 2)" }}>
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
            {/* Own layer: the leave animation scales it, which otherwise re-rasters the starfield. */}
            <div data-hero-disc="" className="hero-disc" style={{ borderRadius: "50%", background: "#141312", overflow: "hidden", willChange: "transform" }}>
              <img decoding="async" src="/assets/starfield.svg" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".95" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "18%", borderRadius: "50%", border: "1px dashed rgba(236,232,223,.12)" }}></span>
              <span style={{ position: "absolute", inset: "4%", borderRadius: "50%", border: "1px solid rgba(236,232,223,.14)" }}></span>
            </div>
            {v.heroSparks.map((s, sI) => (
              <div key={sI} data-h-spark="" style={{ position: "absolute", left: s.x, top: s.y, width: s.s, height: s.s, color: s.c, pointerEvents: "none" }}>
                <Sparkle data-twinkle="" style={{ display: "block", width: "100%", height: "100%" }} />
              </div>
            ))}
            <div className="hero-copy" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", pointerEvents: "none" }}>
              {/* Wide screens: display contents, so copy and buttons share one centred column. Stacked screens: a box the size of the disc. */}
              <div className="hero-copy-disc">
                <div data-h-kicker="" className="hero-kicker" style={{ display: "flex", alignItems: "center", color: "#ECE8DF", fontFamily: "var(--font-sans)", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <span className="hero-track">NIT ROURKELA PRESENTS</span>
                </div>
                <h1 aria-label="Innovision" className="hero-title" style={{ display: "flex", fontFamily: "var(--font-display)", fontWeight: "400", lineHeight: ".95", letterSpacing: ".01em", color: "#fff", mixBlendMode: "difference", whiteSpace: "nowrap" }}>
                  {v.heroChars.map((c, cI) => (
                    <span key={cI} data-h-ch="" data-attract=".22" style={{ display: "inline-block" }}>{c.ch}</span>
                  ))}
                </h1>
                {/* Radar sweep, painted just above the title with lighten: it brightens the dark disc but not the letters, so it reads
                    as passing behind INNOVISION (under the difference-blended title it dimmed them instead). Same box as the disc; the subtitle, buttons, planet and astronaut are painted after it, so they stay in front of it. */}
                <div data-hero-sweep="" aria-hidden="true" className="hero-sweep" style={{ borderRadius: "50%", overflow: "hidden", mixBlendMode: "lighten", pointerEvents: "none" }}>
                  <span style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "conic-gradient(from 0deg,transparent 0 292deg,rgba(236,232,223,.16) 360deg)", animation: "iv-spin 14s linear infinite" }}></span>
                </div>
                <div data-h-sub="" className="hero-sub" style={{ position: "relative", display: "flex", alignItems: "center", color: "oklch(0.8 0.12 85)", fontFamily: "var(--font-sans)", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <span className="hero-sub-rule" style={{ height: "1px", background: "currentColor" }}></span>
                  <span className="hero-track">2026 · THE CELESTIAL ODYSSEY</span>
                  <span className="hero-sub-rule" style={{ height: "1px", background: "currentColor" }}></span>
                </div>
              </div>
              <div className="hero-ctas" style={{ position: "relative", zIndex: "1", display: "flex", justifyContent: "center", pointerEvents: "auto" }}>
                <div data-h-cta="" className="hero-cta-slot">
                  <a href="#/worlds/flagship-events" onMouseEnter={v.hover} className="hero-cta hero-cta-primary hv-gold-fill" style={{ clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s cubic-bezier(.25,1,.1,1), color .4s cubic-bezier(.25,1,.1,1)" }}>
                    <span data-scr="">BEGIN THE ODYSSEY</span>
                  </a>
                </div>

                <div data-h-cta="">
                  <a href={v.noUser || !v.hasRegistered ? "#register" : "#pass"} onClick={v.register} onMouseEnter={v.hover} style={{ position: "relative", isolation: "isolate", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", color: "#ECE8DF", background: "rgba(236,232,223,.85)", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }} className="hv-gold">
                    <span style={{ position: "absolute", inset: "1.5px", zIndex: "-1", background: "#141312", clipPath: "polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)" }}></span>
                    <span data-scr="">{v.noUser || !v.hasRegistered ? "REGISTER" : "MY PASS"}</span>

                  </a>
                </div>
              </div>
            </div>
            {/* Planet and astronaut come after the copy so they stay in front of the radar sweep, as they are in front of the disc. */}
            <div data-depth=".6" className="hero-planet" style={{ pointerEvents: "none" }}>
              <div data-h-planet="" style={{ width: "100%", height: "100%" }}>
                {/* The storm texture is lit from one side, so it holds still instead of spinning. */}
                <img decoding="async" src="/assets/planet-storm.webp" alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
              </div>
            </div>
            <div data-depth=".4" className="hero-astro" style={{ display: "flex", justifyContent: "flex-end", pointerEvents: "none" }}>
              <div data-h-astro="" style={{ width: "100%", height: "100%" }}>
                {/* Same box and tilt as the image, so the bob moves it exactly as before while the filter stays static. */}
                <div data-bob="" style={{ width: "fit-content", height: "100%", marginLeft: "auto", transform: "rotate(-8deg)" }}>
                  <img decoding="async" src="/assets/indian-astronaut.webp" alt="Astronaut drifting beside the celestial disc" style={{ height: "100%", width: "auto", filter: "grayscale(1) contrast(1.12) drop-shadow(0 24px 30px rgba(0,0,0,.35))" }} />
                </div>
              </div>
            </div>
            <CornerFrame color="rgba(20,19,18,.5)">
              <span className="hero-coords" style={{ position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%) rotate(180deg)", writingMode: "vertical-rl", fontSize: "11px", fontWeight: "700", letterSpacing: ".3em", color: "#141312" }}>22.2533° N · 84.9011° E · NIT ROURKELA</span>
            </CornerFrame>
            {/* Scroll dimming (z-index 1 like the buttons, which must stay over the planet on phones): black at opacity a matches filter: brightness(1 - a) on the whole hero, but
                fades on the compositor instead of re-filtering the full-screen scene every frame. */}
            <div data-h-dim="" aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "1", background: "#000", opacity: "0", willChange: "opacity", pointerEvents: "none" }}></div>
          </div>
        </section>
      </div>
      <section style={{ position: "relative", zIndex: "2", marginTop: "calc(max(100vh, 620px) * -1)",padding: "clamp(110px,18vh,200px) clamp(20px,4vw,64px) clamp(96px,14vh,160px)", background: "#ECE8DF", boxShadow: "0 -40px 80px rgba(20,19,18,.28)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <h2 aria-label="For a few days, NIT Rourkela turns into a launch pad for builders, thinkers and makers from across the country." style={{ display: "flex", flexWrap: "wrap", alignItems: "center", rowGap: ".14em", margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(34px,5.2vw,84px)", lineHeight: "1.08", letterSpacing: "-.01em" }}>
            {v.briefWords.map((t, bwI) => (
              <span key={bwI} data-fill="" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", marginRight: ".26em" }}>{t}</span>
            ))}
          </h2>
          <div data-reveal="" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "clamp(32px,5vw,80px)", marginTop: "clamp(48px,8vh,96px)", paddingTop: "28px", borderTop: "1px solid rgba(20,19,18,.18)" }}>
            <p style={{ margin: "0", maxWidth: "60ch", fontSize: "18px", lineHeight: "1.65", color: "#2b2926", textWrap: "pretty" }}>Innovision is the techno-management fest of NIT Rourkela. This year it charts a Celestial Odyssey across four worlds: <b>Flagship Events</b> for the technical arena, <b>Standout Events</b> for the signature showcases, <b>Main Events</b> for workshops and talks, and <b>DTS and Fun Events</b> for the games, quizzes and showcases where the fest peaks.</p>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", margin: "0", alignSelf: "start" }}>
              {[['HOST', 'NIT Rourkela, Odisha'], ['WORLDS', 'Four, each with its own line-up'], ['CREW', 'Students, makers & dreamers']].map(([dt, dd]) => (
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
        <img decoding="async" src="/assets/starfield.svg" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".7", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto" }}>
          <header data-reveal="" style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "48px" }}>
            <h2 style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(36px,5vw,80px)", lineHeight: "1" }}>The Odyssey Map</h2>
            <p style={{ maxWidth: "52ch", margin: "0", fontSize: "16px", lineHeight: "1.6", color: "rgba(236,232,223,.8)", textWrap: "pretty" }}>Four worlds, four kinds of mission. Each one opens into its own line-up of events.</p>
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
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(48px,5vw,72px)", lineHeight: ".9", color: "transparent", WebkitTextStroke: `1.5px ${w.accentL}` }}>{w.secNo}</span>
                  <span style={{ paddingTop: "8px", fontSize: "12px", fontWeight: "700", letterSpacing: ".28em", textAlign: "right", color: w.accentL }}>{w.statLU}</span>
                </div>
                <div style={{ position: "absolute", left: "28px", right: "28px", bottom: "44px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".28em", color: w.accentL }}>{w.categoryU}</span>
                  <h3 style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(28px,2.8vw,42px)", lineHeight: "1.05", textWrap: "balance" }}>{w.name}</h3>
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
          <img decoding="async" src="/assets/starfield.svg" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".75", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: "0", perspective: "900px", perspectiveOrigin: "50% 50%" }}>
            <div style={{ position: "absolute", inset: "0", transformStyle: "preserve-3d" }}>
              {v.tunnel.map((g, gI) => (
                <figure key={gI} data-t-frame="" style={{ position: "absolute", left: `calc(50% + ${g.x})`, top: `calc(50% + ${g.y})`, width: "clamp(220px,30vw,460px)", margin: "0", transform: "translate(-50%,-50%) translate3d(0,0,-6000px)", willChange: "transform,opacity" }}>
                  <div style={{ position: "relative", aspectRatio: g.ar, background: "#1b1a18", border: "1px solid rgba(236,232,223,.18)", overflow: "hidden" }}>
                    {g.imageUrl ? (
                      <img decoding="async" src={g.imageUrl} alt={g.capU} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <ImageSlot id={g.id} shape="rect" placeholder={g.ph} style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} />
                    )}
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
            <p style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}>GALLERY</p>
            <h2 style={{ margin: "0 0 14px", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(34px,4.4vw,68px)", lineHeight: "1" }}>Into the archive</h2>
            <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", color: "rgba(236,232,223,.82)", textWrap: "pretty" }}>Keep scrolling to fly through moments from Innovision past.</p>
          </header>
          <div style={{ position: "absolute", left: "clamp(20px,4vw,64px)", bottom: "calc(clamp(16px,2.6vw,44px) + 64px)", display: "flex", alignItems: "baseline", gap: "10px", fontFamily: "var(--font-display)", fontWeight: "400", pointerEvents: "none" }}>
            <span data-t-count="" style={{ fontSize: "clamp(36px,4vw,60px)", lineHeight: "1" }}>01</span>
            <span style={{ fontSize: "18px", color: "rgba(236,232,223,.7)" }}>/ {v.tunnelTotal}</span>
          </div>
        </div>
      </section>
      <section data-sec="sponsors" aria-label="Sponsors" style={{ position: "relative", padding: "clamp(96px,16vh,180px) clamp(20px,4vw,64px)", background: "#ECE8DF" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <header data-reveal="" style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: "24px", marginBottom: "56px" }}>
            <div>
              <h2 style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(36px,5vw,80px)", lineHeight: "1" }}>Sponsors &amp; partners</h2>
            </div>
            <p style={{ maxWidth: "380px", margin: "0", fontSize: "16px", lineHeight: "1.6", color: "#3a3733", textWrap: "pretty" }}>The brands fuelling Innovision 2026. Full line-up announced closer to launch.</p>
          </header>
          <Sponsors v={v} />
          <div data-reveal="" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px", marginTop: "clamp(48px,7vh,72px)", paddingTop: "28px", borderTop: "1px solid rgba(20,19,18,.14)" }}>
            <p style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(22px,2.2vw,32px)" }}>Want your brand in orbit?</p>
            <a href="#sponsor" onClick={v.sponsorCta} onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s cubic-bezier(.25,1,.1,1)", color: "#ECE8DF", background: "#141312" }} className="hv-bronze-fill">
              <span data-scr="">BECOME A SPONSOR</span>
            </a>
          </div>
        </div>
      </section>
      <section data-sec="merch" aria-label="Merch" style={{ position: "relative", padding: "clamp(96px,14vh,160px) clamp(20px,4vw,64px)", background: "#141312", color: "#ECE8DF", overflow: "hidden" }}>
        <img decoding="async" src="/assets/starfield.svg" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".6", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "clamp(40px,6vw,96px)", alignItems: "center" }}>
          <div data-reveal="">
            <p style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px", fontSize: "13px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}>OFFICIAL MERCH</p>
            <h2 style={{ margin: "0 0 18px", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(40px,5.4vw,88px)", lineHeight: "1" }}>Wear the odyssey.</h2>
            <p style={{ margin: "0 0 32px", maxWidth: "420px", fontSize: "17px", lineHeight: "1.6", color: "rgba(236,232,223,.82)", textWrap: "pretty" }}>Limited-run tees, hoodies and keepsakes. Pre-order online, collect on campus during the fest.</p>
            <a href="#/merch" onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s cubic-bezier(.25,1,.1,1)", color: "#141312", background: "#ECE8DF" }} className="hv-gold-fill">
              <span data-scr="">VISIT THE STORE</span>
            </a>
          </div>
          <div data-reveal="" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "14px" }}>
            {v.merchTeaser.map((t, tI) => (
              <a key={tI} href="#/merch" style={{ display: "flex", flexDirection: "column", gap: "10px", textDecoration: "none", color: "#ECE8DF" }}>
                <div style={{ position: "relative", aspectRatio: "4 / 5", background: "#26241f", pointerEvents: "none" }}>
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
          <img decoding="async" data-spin="480" src="/assets/planet-mercury.webp" alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.35) brightness(1.05)" }} />
        </div>
        <div data-launch="" aria-hidden="true" style={{ position: "absolute", right: "clamp(20px,11vw,220px)", bottom: "16%", display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
          <img decoding="async" src="/assets/rocket.svg" alt="" style={{ height: "min(34vh, 320px)", width: "auto", filter: "grayscale(1) contrast(1.35) brightness(1.05) drop-shadow(0 18px 24px rgba(0,0,0,.2))" }} />
          <span style={{ width: "3.6vh", height: "8vh", marginTop: "-1.4vh", borderRadius: "45% 45% 50% 50% / 20% 20% 80% 80%", background: "radial-gradient(ellipse 50% 100% at 50% 0,#fff,rgba(255,244,230,.75) 45%,transparent 100%)", transformOrigin: "50% 0", animation: "iv-flame .16s ease-in-out infinite alternate" }}></span>
          <span style={{ width: "2px", height: "70vh", background: "repeating-linear-gradient(180deg,rgba(20,19,18,.45) 0 8px,transparent 8px 18px)" }}></span>
        </div>
        <div data-reveal="" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h2 style={{ margin: "0 0 22px", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(48px,8.4vw,150px)", lineHeight: ".95", letterSpacing: "-.01em" }}>The odyssey<br />awaits.</h2>
          <p style={{ margin: "0 auto 36px", maxWidth: "520px", fontSize: "18px", lineHeight: "1.6", color: "#3a3733", textWrap: "pretty" }}>Innovision 2026 is boarding soon at NIT Rourkela. Claim your seat on the voyage.</p>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>

            <a href={v.noUser || !v.hasRegistered ? "#register" : "#pass"} onClick={v.register} onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", color: "#ECE8DF", background: "#141312", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s cubic-bezier(.25,1,.1,1)" }} className="hv-bronze-fill">
              <span data-scr="">{v.noUser || !v.hasRegistered ? "REGISTER" : "MY PASS"}</span>

            </a>
            <a href="#/worlds/flagship-events" onMouseEnter={v.hover} style={{ position: "relative", isolation: "isolate", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "168px", padding: "17px 30px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".06em", color: "#141312", background: "#141312", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }} className="hv-bronze">
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
