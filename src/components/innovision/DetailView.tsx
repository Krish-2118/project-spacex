/* eslint-disable @typescript-eslint/ban-ts-comment -- view-model props are untyped across the views */
// @ts-nocheck
"use client";
/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import type { CSSProperties } from 'react';
import { CornerFrame, OrbitBackdrop, Radar } from './decor';
import { Sparkle } from './icons';
import type { V } from './types';

const MONO = "grayscale(1) contrast(1.35) brightness(1.05)";
const GLASS: CSSProperties = { background: "rgba(250,248,243,.66)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(20,19,18,.18)", borderRadius: "20px", boxShadow: "0 30px 60px -30px rgba(20,19,18,.35)" };
const barcode = (c: string) => `repeating-linear-gradient(90deg,${c} 0 2px,transparent 2px 4px,${c} 4px 5px,transparent 5px 8px,${c} 8px 11px,transparent 11px 13px,${c} 13px 14px,transparent 14px 18px)`;
/** Ticket notches punched top and bottom at the stub's perforation line. */
const TICKET_MASK = "radial-gradient(circle 13px at 120px 0,transparent 96%,#000 100%) top/100% 51% no-repeat,radial-gradient(circle 13px at 120px 100%,transparent 96%,#000 100%) bottom/100% 51% no-repeat";

// "Highpoint" scene: a teal wave with an astronaut surfing its crest.
const SNOW = 'oklch(0.97 0.012 180)';
const WAVE = 'M2600 800L2600 520C2100 500 1700 470 1560 420C1440 380 1340 320 1270 230C1200 150 1100 100 990 108C880 116 800 180 790 262C784 316 826 350 868 330C900 314 904 276 878 262C880 220 930 190 980 200C1060 215 1090 320 1060 430C1030 540 940 610 800 640C600 680 300 660 -1000 690L-1000 800Z';
const SWELL = 'M-1000 800L-1000 470C-700 430 -450 520 -150 470C150 420 350 500 650 455C950 410 1150 480 1450 440C1750 400 2000 470 2600 430L2600 800Z';
// The shore runs on below the frame: on phones the scene is placed by its crest and its base can sit under the screen edge.
const SHORE = 'M-1000 1400L-1000 720C-600 690 -300 740 100 712C500 684 800 742 1200 712C1600 682 1900 736 2600 700L2600 1400Z';
const SPRAY: [number, number, number][] = [[760, 230, 7], [735, 188, 4], [772, 158, 9], [718, 282, 5], [812, 118, 6], [852, 80, 4], [902, 58, 8], [962, 38, 5], [1042, 52, 6], [1112, 72, 4], [1182, 96, 7], [742, 322, 4], [700, 240, 3], [884, 18, 3], [1012, 8, 4], [668, 300, 2.5], [1150, 30, 3]];

function WaveScene() {
  return (
    <svg viewBox="0 0 1600 800" preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        <linearGradient id="fw-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.5 0.055 184)"></stop><stop offset=".45" stopColor="oklch(0.38 0.05 186)"></stop><stop offset="1" stopColor="oklch(0.3 0.045 188)"></stop></linearGradient>
        <linearGradient id="fw-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.83 0.04 180)"></stop><stop offset="1" stopColor="oklch(0.64 0.06 183)"></stop></linearGradient>
        <linearGradient id="fw-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0"></stop><stop offset=".5" stopColor="#fff" stopOpacity=".32"></stop><stop offset="1" stopColor="#fff" stopOpacity="0"></stop></linearGradient>
        <pattern id="fw-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-22)"><rect width="1.5" height="12" fill="rgba(255,255,255,.1)"></rect></pattern>
        <clipPath id="fw-clip"><path d={WAVE}></path></clipPath>
      </defs>
      <path d={SWELL} fill="url(#fw-far)"></path>
      <path d={SWELL} fill="url(#fw-hatch)"></path>
      <path d="M-1000 470C-700 430 -450 520 -150 470C150 420 350 500 650 455C950 410 1150 480 1450 440C1750 400 2000 470 2600 430" fill="none" stroke={SNOW} strokeWidth="5"></path>
      <path d={WAVE} fill="url(#fw-body)"></path>
      <g clipPath="url(#fw-clip)" fill="none" strokeLinecap="round">
        <path d={WAVE} fill="url(#fw-hatch)" stroke="none"></path>
        <path d="M1010 236C1080 262 1104 350 1078 450C1050 548 970 620 850 652" stroke="rgba(236,232,223,.3)" strokeWidth="3"></path>
        <path d="M1050 262C1110 300 1124 380 1098 470C1070 560 1000 630 900 664" stroke="rgba(236,232,223,.22)" strokeWidth="3"></path>
        <path d="M2600 580C2100 560 1720 530 1580 480C1450 432 1350 360 1290 290" stroke="rgba(236,232,223,.28)" strokeWidth="3"></path>
        <path d="M2600 640C2100 620 1720 590 1590 545C1450 497 1340 420 1270 350" stroke="rgba(236,232,223,.2)" strokeWidth="3"></path>
        <path d="M1250 190C1180 140 1090 140 1020 160" stroke="rgba(236,232,223,.3)" strokeWidth="3"></path>
        <g transform="skewX(-18)"><rect x="0" y="-100" width="240" height="1000" fill="url(#fw-sheen)" style={{ animation: "iv-sheen 7s cubic-bezier(.65,0,.35,1) infinite" }}></rect></g>
      </g>
      <path d="M1560 420C1440 380 1340 320 1270 230C1220 170 1160 128 1100 112" fill="none" stroke={SNOW} strokeWidth="4" opacity=".75"></path>
      <path d="M1240 196C1170 120 1070 96 980 110C870 128 800 190 792 262C789 302 812 336 850 336" fill="none" stroke={SNOW} strokeWidth="9" strokeLinecap="round"></path>
      <path d="M1240 196C1170 120 1070 96 980 110C870 128 800 190 792 262C789 302 812 336 850 336" fill="none" stroke={SNOW} strokeWidth="24" strokeLinecap="round" strokeDasharray="0 30"></path>
      {SPRAY.map(([cx, cy, r], k) => (
        <circle key={k} cx={cx} cy={cy} r={r} fill={SNOW} style={{ animation: `iv-hang ${(4 + (k % 5) * .7).toFixed(1)}s ease-in-out ${-k * .45}s infinite` }}></circle>
      ))}
      <g style={{ animation: "iv-hang 4.6s ease-in-out infinite" }}>
        {/* An astronaut snowboarding the crest. The image is pinned by the middle of the board's underside (122,292 at this
            size) and set 20 below the crest at x 1165; the board runs at 13° in the art, so an 18° turn lays it along the
            crest's slope there, both tips clearing the foam evenly as the crest falls away beneath them. */}
        <g transform="translate(1165 180) rotate(18)">
          <image href="/assets/astronaut-snowboard.webp" x="-122" y="-292" width="268" height="310"></image>
        </g>
      </g>
      {/* Viewfinder framing the rider (its bounds are about 1063 -86 to 1361 214), caption above in open sky. */}
      <g fill="none" stroke="oklch(0.3 0.06 185)" strokeWidth="3" style={{ transformBox: "fill-box", transformOrigin: "center", animation: "iv-focus 5s ease-in-out infinite" }}>
        <path d="M1045 -65V-115H1095"></path><path d="M1335 -115H1385V-65"></path><path d="M1045 182V232H1095"></path><path d="M1335 232H1385V182"></path>
      </g>
      <g className="hp-freeze" fill="oklch(0.3 0.06 185)">
        <rect x="1045" y="-150" width="6" height="22"></rect><rect x="1057" y="-150" width="6" height="22"></rect>
        <text x="1077" y="-131" style={{ fontSize: "22px", fontWeight: "700", letterSpacing: "4px" }}>FREEZE FRAME · 1/8000 S</text>
      </g>
      <path d={SHORE} fill="oklch(0.3 0.045 188)"></path>
      <path d={SHORE} fill="url(#fw-hatch)"></path>
      <path d="M-1000 720C-600 690 -300 740 100 712C500 684 800 742 1200 712C1600 682 1900 736 2600 700" fill="none" stroke={SNOW} strokeWidth="6"></path>
    </svg>
  );
}

// "Touchdown" (Main Events) scene: an astronaut on a cratered ledge watching a field of drifting rock and a rocket heading
// out. The site's mono art is tinted violet to sit in this world's palette.
const VIOLET = "grayscale(1) sepia(.5) hue-rotate(218deg) saturate(1.35) contrast(1.25) brightness(1.03)";
/**
 * Drifting rocks: [x, y (centre, % of the screen), size (vmin), tilt, scroll y, scroll x, scroll turn, pointer depth].
 * On scroll they part outward from the title, the nearer ones faster, so the camera seems to push through the field.
 */
const ROCKS: [string, string, number, number, number, number, number, string][] = [
  ['5%', '46%', 8, -20, -.3, -.12, -70, '.5'],
  ['10%', '61%', 6, 25, -.18, -.08, 90, '.45'],
  ['15%', '31%', 3, 10, -.4, -.05, -120, '.3'],
  ['57%', '15%', 2.4, 0, -.5, .02, 160, '.2'],
  ['86%', '24%', 4.5, -30, -.34, .1, 110, '.35'],
  ['89%', '51%', 7.5, 15, -.26, .16, -80, '.5'],
  ['70%', '87%', 10, -8, -.14, .08, 40, '.6'],
  ['94%', '79%', 4, 40, -.2, .14, -140, '.4'],
];
/** Four-point stars: [x, y, size px, twinkle delay s]. */
const STARS: [string, string, number, number][] = [['26%', '19%', 30, 0], ['79%', '14%', 24, 1.3], ['39%', '57%', 20, 2.2], ['74%', '66%', 26, .7], ['18%', '9%', 14, 1.8]];
/** A zero-size anchor at (x, y), so scroll transforms turn things about their own centre. */
const at = (x: string, y: string, px?: string, py?: string) => ({ "--x": x, "--y": y, ...(px && { "--px": px }), ...(py && { "--py": py }) }) as CSSProperties;

function TouchdownBack() {
  return (
    <>
      <div data-speed="-0.012" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
        <OrbitBackdrop top="40%" />
      </div>
      <div data-speed="-0.1" data-sx="-0.03" className="td-at" style={at('29%', '14%', '14%', '21%')}>
        <div data-depth=".25">
          <img decoding="async" src="/assets/moon-full.webp" alt="" className="td-moon" style={{ filter: VIOLET }} />
        </div>
      </div>
      {/* Ringed moon cut off by the right edge. */}
      <div data-speed="-0.18" data-sx="0.08" className="td-at" style={at('98%', '37%', '100%', '24%')}>
        <div data-depth=".3">
          <div className="td-ringed">
            <img decoding="async" src="/assets/moon-cratered.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", filter: VIOLET }} />
            <svg viewBox="-130 -60 260 120" aria-hidden="true" style={{ position: "absolute", left: "-80%", top: "-10%", width: "260%", height: "120%", overflow: "visible" }}>
              <g transform="rotate(-14)" fill="none" stroke="#1d1830" vectorEffect="non-scaling-stroke">
                <ellipse rx="118" ry="24" strokeOpacity=".45" strokeWidth="1.2" vectorEffect="non-scaling-stroke"></ellipse>
                <ellipse rx="96" ry="18" strokeOpacity=".3" strokeWidth="1" strokeDasharray="3 6" vectorEffect="non-scaling-stroke"></ellipse>
                <circle cx="112" cy="-7" r="2.2" fill="#1d1830" stroke="none"></circle>
              </g>
            </svg>
          </div>
        </div>
      </div>
      <div data-speed="-0.15" aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
        <div data-depth=".35" style={{ position: "absolute", inset: "0" }}>
          {STARS.map(([x, y, s, d], k) => (
            <Sparkle key={k} className="td-star" style={{ left: x, top: y, width: s, height: s, animationDelay: `-${d}s` }} />
          ))}
        </div>
      </div>
      {ROCKS.map(([x, y, s, r, sp, sx, rot, depth], k) => (
        <div key={k} data-speed={sp} data-sx={sx} data-rot={rot} className="td-at" style={at(x, y)}>
          <div data-depth={depth}>
            <img decoding="async" src="/assets/asteroid.webp" alt="" className="td-rock" style={{ ["--s" as string]: s, transform: `translate(-50%,-50%) rotate(${r}deg)`, filter: VIOLET }} />
          </div>
        </div>
      ))}
      {/* A rocket heading out, its trail running back down the sky; scrolling flies it off the top right. */}
      <div data-speed="-0.34" data-sx="0.42" className="td-at" style={at('60%', '61%', '60%', '57%')}>
        <div data-depth=".4">
          <div className="td-flight">
            <span className="td-trail"></span>
            <img decoding="async" src="/assets/rocket.svg" alt="" className="td-rocket" style={{ filter: VIOLET }} />
          </div>
        </div>
      </div>
    </>
  );
}

function TouchdownFront() {
  return (
    <div data-speed="0.22" data-zoom="1.15" style={{ position: "absolute", inset: "0", transformOrigin: "25% 100%", pointerEvents: "none" }}>
      <div data-depth=".55" style={{ position: "absolute", inset: "0" }}>
        <img decoding="async" src="/assets/planet-moon.webp" alt="" className="td-ledge" style={{ filter: VIOLET + " contrast(1.15) brightness(.9)" }} />
        <div className="td-at td-sitter" style={at('25vw', '74vh', '32vw', '76vh')}>
          {/* Low-gravity hop: the shadow shrinks while the astronaut is up and a dust ring puffs out on landing. */}
          <span className="td-hop" style={{ position: "absolute", left: "-6vh", top: "-1.2vh", width: "12vh", height: "2.4vh", borderRadius: "50%", background: "rgba(29,24,48,.5)", animation: "iv-hopshadow 3.6s infinite" }}></span>
          <span className="td-hop" style={{ position: "absolute", left: "-12vh", top: "-3.4vh", width: "24vh", height: "5.6vh", borderRadius: "50%", background: "radial-gradient(closest-side,rgba(236,232,223,.95),rgba(236,232,223,0))", border: "1.5px dotted rgba(29,24,48,.45)", animation: "iv-dust 3.6s ease-out infinite" }}></span>
          <img decoding="async" src="/assets/indian-astronaut.webp" alt="Astronaut making a low-gravity hop on a cratered ledge" className="td-astro td-hop" style={{ transformOrigin: "50% 100%", filter: VIOLET + " drop-shadow(0 12px 14px rgba(0,0,0,.25))", animation: "iv-hop 3.6s infinite" }} />
        </div>
      </div>
    </div>
  );
}

/** Scroll-driven world detail page with missions. */
export default function DetailView({ v }: { v: V }) {
  const cw = v.cw;
  return (
    <section data-view="detail" data-screen-label="Events – World detail" aria-label="World details" style={{ position: "absolute", inset: "0", overflow: "hidden", visibility: "hidden", background: "#141312" }}>
      <div data-d-scroller="" data-noscroll="" style={{ position: "absolute", inset: "0", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", scrollbarWidth: "none" }}>
        <div data-d-track="" style={{ position: "relative", height: "300vh" }}>
          <div style={{ position: "sticky", top: "0", height: "100vh", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: "0", background: `linear-gradient(180deg,${cw.tint} 0%,${cw.tint2} 100%)` }}></div>
            <div data-speed="-0.03" aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
              <Radar top="46%" size={180} alpha={.08} mask="radial-gradient(circle,transparent 14%,#000 22%,transparent 56%)" />
            </div>

            {/* ---- scene backgrounds ---- */}
            {v.isTakeoff && (
              <>
                <div data-speed="-0.012" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
                  <OrbitBackdrop top="30%" />
                </div>
                <div data-speed="-0.14" style={{ position: "absolute", left: "calc(50% - max(47vw, 60vh) / 2)", top: "calc(77% - max(47vw, 60vh) * 1.329)", width: "max(47vw, 60vh)", pointerEvents: "none" }}>
                  <div data-depth=".25" style={{ position: "relative", width: "110%", margin: "4% 0 0 -5%", aspectRatio: "1" }}>
                    <img decoding="async" src="/assets/planet-ringed.webp" alt="" style={{ width: "100%", height: "100%", transform: "rotate(6deg)", filter: MONO, animation: "iv-drift 9s ease-in-out infinite" }} />
                  </div>
                </div>
                <div data-speed="-0.22" aria-hidden="true" style={{ position: "absolute", right: "max(9%, 40px)", top: "17%", height: "min(30vh, 290px)", pointerEvents: "none" }}>
                  <div data-depth=".45" style={{ height: "100%" }}>
                    <div style={{ height: "100%", transform: "rotate(16deg)" }}>
                      <img decoding="async" src="/assets/rocket.svg" alt="" style={{ height: "100%", width: "auto", filter: MONO + " drop-shadow(0 18px 24px rgba(0,0,0,.2))", animation: "iv-drift 6s ease-in-out infinite" }} />
                    </div>
                  </div>
                </div>
              </>
            )}
            {v.isTouchdown && <TouchdownBack />}
            {v.isHighpoint && (
              <>
                <div data-speed="-0.012" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
                  <OrbitBackdrop top="34%" />
                </div>
                <div data-speed="-0.16" style={{ position: "absolute", left: "calc(50% - max(37vw, 52vh) / 2.4)", top: "calc(38% - max(37vw, 52vh) * 1.0625)", width: "max(37vw, 52vh)", pointerEvents: "none" }}>
                  <div data-depth=".15" style={{ position: "relative", aspectRatio: "1" }}>
                    <img decoding="async" src="/assets/planet-storm.webp" alt="" style={{ width: "100%", height: "100%", filter: MONO }} />
                    <span style={{ position: "absolute", inset: "-14%", borderRadius: "50%", border: "1px dashed rgba(20,19,18,.4)" }}></span>
                  </div>
                </div>
                <div data-speed="-0.1" style={{ position: "absolute", right: "-4%", top: "-6%", width: "min(34vw, 560px)", opacity: ".9", pointerEvents: "none" }}>
                  <div data-depth=".3" style={{ width: "38%", marginLeft: "40%", aspectRatio: "1" }}>
                    <img decoding="async" data-spin="180" src="/assets/moon-cratered.webp" alt="" style={{ width: "100%", height: "100%", filter: MONO }} />
                  </div>
                </div>
                <div data-speed="-0.1" className="hp-asteroid">
                  <div data-depth=".35" className="hp-asteroid-rock"><img decoding="async" data-spin="90" src="/assets/asteroid.webp" alt="" style={{ height: "100%", width: "auto", filter: MONO }} /></div>
                </div>
              </>
            )}

            <div data-d-titleblock="" className={v.isTouchdown ? "td-title" : undefined} style={{ position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", pointerEvents: "none" }}>
              {v.isTouchdown ? (
                <div data-d-stats="" style={{ display: "flex", alignItems: "center", gap: "clamp(10px,1.2vw,18px)", marginBottom: ".5em", fontWeight: "700", fontSize: "clamp(12px,1.15vw,19px)", letterSpacing: ".22em", color: cw.ink }}>
                  <svg viewBox="0 0 90 6" aria-hidden="true" style={{ width: "clamp(36px,5vw,90px)" }}><path d="M0 3H62" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 5"></path><circle cx="84" cy="3" r="2.6" fill="currentColor"></circle></svg>
                  <span style={{ paddingLeft: ".22em" }}>{cw.statLU}</span>
                  <svg viewBox="0 0 90 6" aria-hidden="true" style={{ width: "clamp(36px,5vw,90px)", transform: "scaleX(-1)" }}><path d="M0 3H62" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 5"></path><circle cx="84" cy="3" r="2.6" fill="currentColor"></circle></svg>
                </div>
              ) : (
                <div data-d-stats="" style={{ display: "flex", justifyContent: "space-between", width: "min(76vw, 1400px)", margin: "0 auto -.4em", fontWeight: "700", fontSize: "clamp(15px,1.6vw,26px)", textTransform: "uppercase", color: cw.ink }}>
                  <span>{cw.statL}</span>
                  <span>{cw.statR}</span>
                </div>
              )}
              <h1 data-d-title="" data-size={v.isTouchdown ? "clamp(48px, 10vw, 200px)" : undefined} aria-label={cw.name} style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(56px,13vw,250px)", lineHeight: "1", letterSpacing: "-.01em", whiteSpace: "nowrap", color: cw.ink, textShadow: v.titleShadow }}>
                {cw.chars.map((c, cI) => (v.isTouchdown && !c.ch.trim() ? (
                  <span key={cI} data-d-ch="" style={{ display: "inline-block", margin: "0 .14em", verticalAlign: ".22em" }}><Sparkle style={{ display: "block", width: ".34em", height: ".34em", color: cw.accent }} /></span>
                ) : (
                  <span key={cI} data-d-ch="" style={{ display: "inline-block" }}>{c.ch}</span>
                )))}
              </h1>
              {cw.sub && <p data-d-sub="" className="td-sub" style={{ margin: ".9em 0 0", fontWeight: "700", textTransform: "uppercase", color: cw.ink }}>{cw.sub}</p>}
            </div>

            {/* ---- scene foregrounds ---- */}
            {v.isTakeoff && (
              <div data-speed="0" style={{ position: "absolute", left: "calc(50% - max(124vw, 170vh) / 2)", bottom: "-4%", width: "max(124vw, 170vh)", aspectRatio: "4000 / 973", pointerEvents: "none" }}>
                <div data-depth=".35" style={{ position: "absolute", inset: "0" }}>
                  <img decoding="async" src="/assets/lab.webp" alt="" style={{ position: "absolute", left: "10%", bottom: "14%", width: "24%", height: "auto", transform: "rotate(4deg)", filter: `${MONO} drop-shadow(0 12px 16px rgba(0,0,0,.4))` }} />
                  <img decoding="async" src="/assets/mesa.svg" alt="" style={{ position: "absolute", left: "0", bottom: "0", width: "50.6%", height: "auto", transform: "scaleX(-1)", filter: MONO }} />
                  <img decoding="async" src="/assets/mesa.svg" alt="" style={{ position: "absolute", right: "0", bottom: "0", width: "50.6%", height: "auto", filter: MONO }} />
                  <div style={{ position: "absolute", left: "50%", bottom: "35%", width: "18%", aspectRatio: "6 / 1", marginLeft: "-9%" }}>
                    <span style={{ position: "absolute", inset: "0", borderRadius: "50%", border: "2px solid rgba(20,19,18,.5)", animation: "iv-pulse 2.4s cubic-bezier(.25,1,.1,1) infinite" }}></span>
                    <span style={{ position: "absolute", inset: "0", borderRadius: "50%", border: "2px solid rgba(20,19,18,.5)", animation: "iv-pulse 2.4s cubic-bezier(.25,1,.1,1) 1.2s infinite" }}></span>
                    <span style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "#1f1d1b", boxShadow: "inset 0 -6px 0 rgba(255,255,255,.12),0 10px 24px rgba(0,0,0,.3)" }}></span>
                    <span style={{ position: "absolute", inset: "22% 18%", borderRadius: "50%", border: "1px dashed rgba(236,232,223,.5)" }}></span>
                    <div data-lander="" style={{ position: "absolute", left: "50%", bottom: "36.5%", width: "40vh", marginLeft: "-20vh", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "1.5vh" }}>
                      <img decoding="async" src="/assets/lander.webp" alt="Lander hovering above the launch pad" style={{ height: "32vh", width: "auto", filter: "grayscale(1) contrast(1.15) drop-shadow(0 14px 18px rgba(0,0,0,.25))" }} />
                      <div data-thrust="" style={{ position: "relative", width: "100%", height: 0, marginTop: "-3.5vh", zIndex: -1 }}>
                        <span style={{ position: "absolute", left: "50%", marginLeft: "-7vh", top: "-1vh", width: "3.5vh", height: "7vh", borderRadius: "45% 45% 50% 50% / 20% 20% 80% 80%", background: "radial-gradient(ellipse 50% 100% at 50% 0,#fff,rgba(255,244,230,.7) 45%,transparent 100%)", transformOrigin: "50% 0", animation: "iv-flame .16s ease-in-out infinite alternate" }}></span>
                        <span style={{ position: "absolute", left: "50%", marginLeft: "1vh", top: "-2vh", width: "3.5vh", height: "7.5vh", borderRadius: "45% 45% 50% 50% / 20% 20% 80% 80%", background: "radial-gradient(ellipse 50% 100% at 50% 0,#fff,rgba(255,244,230,.7) 45%,transparent 100%)", transformOrigin: "50% 0", animation: "iv-flame .16s ease-in-out infinite alternate", animationDelay: "0.05s" }}></span>
                        <span style={{ position: "absolute", left: "50%", marginLeft: "4.5vh", top: "-1vh", width: "3.5vh", height: "7vh", borderRadius: "45% 45% 50% 50% / 20% 20% 80% 80%", background: "radial-gradient(ellipse 50% 100% at 50% 0,#fff,rgba(255,244,230,.7) 45%,transparent 100%)", transformOrigin: "50% 0", animation: "iv-flame .16s ease-in-out infinite alternate", animationDelay: "0.1s" }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {v.isTouchdown && <TouchdownFront />}
            {v.isHighpoint && (
              <div data-speed="-0.03" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
                <div data-depth=".3" className="hp-wave">
                  <WaveScene />
                </div>
              </div>
            )}

            {/* ---- copy ---- */}
            {v.compact && (
              <h2 style={{ position: "absolute", top: "max(88px, 12%)", left: "0", right: "0", width: v.taglineW, margin: "0 auto", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(26px,3.1vw,56px)", lineHeight: "1.04", textAlign: "center", color: "#fff", mixBlendMode: "difference", pointerEvents: "none" }}>
                {cw.words.map((wd, wdI) => (
                  <span key={wdI} data-d-word="" style={{ display: "inline-block", margin: "0 .14em" }}>{wd.t}</span>
                ))}
              </h2>
            )}
            {v.notCompact && (
              <div data-d-panels="" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: "6%", top: "15%", width: "min(460px, 30vw)", display: "flex", flexDirection: "column", gap: "22px" }}>
                  <p style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0", fontSize: "12px", fontWeight: "700", letterSpacing: ".3em", textTransform: "uppercase", color: cw.ink }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cw.accent }}></span>
                    {cw.statL} / {cw.statR}
                  </p>
                  <h2 style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(28px,2.9vw,52px)", lineHeight: "1.02", color: cw.ink, textWrap: "balance" }}>
                    {cw.words.map((wd, wdI) => (
                      <span key={wdI} data-d-word="" style={{ display: "inline-block", marginRight: ".24em" }}>{wd.t}</span>
                    ))}
                  </h2>
                  <div data-d-intro="" style={{ pointerEvents: "auto", padding: "22px 26px 24px", ...GLASS }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", paddingBottom: "14px", marginBottom: "14px", borderBottom: "1px solid rgba(20,19,18,.14)", fontSize: "11px", fontWeight: "700", letterSpacing: ".28em", color: cw.accent }}>
                      <span>TRANSMISSION</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "12px" }}>
                          {[0, .15, .3, .45, .6].map((d) => (
                            <i key={d} style={{ width: "2px", height: "100%", background: "currentColor", transformOrigin: "bottom", animation: `iv-sig .9s ease-in-out ${d}s infinite` }}></i>
                          ))}
                        </span>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cw.accent, animation: "iv-blink 1.4s steps(2) infinite" }}></span>
                        LIVE
                      </span>
                    </div>
                    <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.65", color: "#22201d", textWrap: "pretty" }}>{cw.intro}</p>
                  </div>
                </div>
                <div data-d-spec="" style={{ position: "absolute", right: "6%", bottom: "max(20vh, 150px)", width: "min(360px, 24vw)", pointerEvents: "auto", padding: "22px 26px 10px", ...GLASS }}>
                  <span aria-hidden="true" style={{ position: "absolute", right: "-30px", top: "-44px", width: "92px", height: "92px", color: cw.accent, pointerEvents: "none" }}>
                    <span style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "rgba(250,248,243,.9)", boxShadow: "0 10px 24px -10px rgba(20,19,18,.4)" }}></span>
                    <span style={{ position: "absolute", inset: "0", animation: "iv-spin 22s linear infinite" }}>
                      <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%" }}>
                        <defs><path id={"stamp-" + cw.key} d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1 -148 0"></path></defs>
                        <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="3"></circle>
                        <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 5"></circle>
                        <text style={{ fontSize: "20px", fontWeight: "700", letterSpacing: "3px", fill: "currentColor" }}><textPath href={"#stamp-" + cw.key}>{cw.stampText}</textPath></text>
                      </svg>
                    </span>
                    <Sparkle style={{ position: "absolute", left: "50%", top: "50%", width: "24px", height: "24px", margin: "-12px 0 0 -12px" }} />
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", marginBottom: "6px", paddingRight: "44px" }}>
                    <span style={{ fontFamily: "var(--font-display)", whiteSpace: "nowrap", fontWeight: "400", fontSize: "clamp(17px,1.35vw,22px)", color: "#141312" }}>Flight data</span>
                    <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".28em", color: cw.accent }}>{cw.categoryU}</span>
                  </div>
                  <dl style={{ margin: "0" }}>
                    {cw.specs.map((sp) => (
                      <div key={sp.i} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto", alignItems: "baseline", gap: "10px", padding: "12px 0", borderTop: "1px solid rgba(20,19,18,.12)", fontSize: "15px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: cw.accent }}>{sp.i}</span>
                        <dt style={{ color: "#5c574f" }}>{sp.k}</dt>
                        <dd style={{ margin: "0", fontWeight: "700", color: "#141312", textAlign: "right" }}>{sp.v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 0 12px", borderTop: "1px solid rgba(20,19,18,.12)" }}>
                    <span aria-hidden="true" style={{ flex: "1", height: "30px", background: barcode("#141312") }}></span>
                    <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".2em", color: "#5c574f" }}>{cw.serial}</span>
                  </div>
                </div>
              </div>
            )}

            <CornerFrame color={cw.frame} rulers={['34%', '30%']} />
            <div data-d-fade="" style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "45%", background: "linear-gradient(180deg,rgba(20,19,18,0),#141312 85%)", pointerEvents: "none" }}></div>
            <div data-d-hint="" aria-hidden="true" style={{ position: "absolute", left: "0", right: "0", bottom: "calc(clamp(16px,2.6vw,44px) + 110px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", fontSize: "12px", letterSpacing: ".3em", color: cw.ink, pointerEvents: "none" }}>
              <span>SCROLL</span>
              <i data-hint-line="" style={{ display: "block", width: "1.5px", height: "38px", background: `linear-gradient(${cw.ink},transparent)` }}></i>
            </div>
          </div>
        </div>

        {/* ---- mission manifest ---- */}
        <section aria-label={cw.category} style={{ position: "relative", overflow: "hidden", padding: "18vh clamp(16px,2.6vw,44px) calc(clamp(16px,2.6vw,44px) + 200px)", background: "#141312", color: "#ECE8DF" }}>
          <img decoding="async" src="/assets/starfield.svg" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".45", pointerEvents: "none" }} />
          <div aria-hidden="true" style={{ position: "absolute", inset: "0", backgroundImage: "linear-gradient(rgba(236,232,223,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(236,232,223,.05) 1px,transparent 1px)", backgroundSize: "80px 80px", WebkitMaskImage: "linear-gradient(180deg,transparent,#000 18%,#000 62%,transparent 90%)", maskImage: "linear-gradient(180deg,transparent,#000 18%,#000 62%,transparent 90%)", pointerEvents: "none" }}></div>
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: "calc(min(110vw, 1500px) * -.74)", width: "min(110vw, 1500px)", aspectRatio: "1", marginLeft: "calc(min(110vw, 1500px) / -2)", opacity: ".2", pointerEvents: "none" }}>
            <img decoding="async" src={v.nw.planet} alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.3)", animation: "iv-spin 240s linear infinite" }} />
          </div>
          <div aria-hidden="true" style={{ position: "absolute", left: "-6vw", right: "-6vw", top: "5vh", transform: "rotate(-1.6deg)", overflow: "hidden", padding: "clamp(8px,.7vw,12px) 0", background: cw.accentL, color: "#141312", boxShadow: "0 14px 30px rgba(0,0,0,.35)", pointerEvents: "none" }}>
            <div style={{ display: "inline-flex", whiteSpace: "nowrap", animation: "iv-tick 40s linear infinite" }}>
              {cw.ticker.map((b, bI) => (
                <span key={bI} style={{ display: "inline-flex", alignItems: "center", gap: "clamp(14px,1.4vw,22px)", paddingRight: "clamp(14px,1.4vw,22px)", fontWeight: "700", fontSize: "clamp(11px,1vw,15px)", letterSpacing: ".08em", lineHeight: "1", textTransform: "uppercase" }}>
                  <Sparkle style={{ width: ".8em", height: ".8em", flex: "none" }} />{b.t}
                </span>
              ))}
            </div>
          </div>
          {v.compact && (
            <div style={{ position: "relative", display: "grid", gap: "18px", maxWidth: "640px", margin: "0 auto 64px" }}>
              <div data-d-card="" style={{ padding: "22px 22px 24px", border: "1px solid rgba(236,232,223,.16)", borderRadius: "20px", background: "#1b1a18" }}>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "12px", marginBottom: "12px", borderBottom: "1px solid rgba(236,232,223,.12)", fontSize: "11px", fontWeight: "700", letterSpacing: ".28em", color: cw.accentL }}>
                  <span>TRANSMISSION</span><span>LIVE</span>
                </div>
                <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6" }}>{cw.intro}</p>
              </div>
              <div data-d-card="" style={{ padding: "22px 22px 8px", border: "1px solid rgba(236,232,223,.16)", borderRadius: "20px", background: "#1b1a18" }}>
                <div style={{ marginBottom: "6px", fontFamily: "var(--font-display)", whiteSpace: "nowrap", fontWeight: "400", fontSize: "18px" }}>Flight data</div>
                <dl style={{ margin: "0" }}>
                  {cw.specs.map((sp) => (
                    <div key={sp.i} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto", alignItems: "baseline", gap: "10px", padding: "12px 0", borderTop: "1px solid rgba(236,232,223,.12)", fontSize: "15px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: cw.accentL }}>{sp.i}</span>
                      <dt style={{ color: "rgba(236,232,223,.7)" }}>{sp.k}</dt>
                      <dd style={{ margin: "0", fontWeight: "700", textAlign: "right" }}>{sp.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
          <header style={{ position: "relative", maxWidth: "1240px", margin: "0 auto 48px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "end", gap: "16px 32px" }}>
            <div>
              <p style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0 0 14px", fontSize: "13px", letterSpacing: ".3em", color: cw.accentL }}>
                <span style={{ width: "28px", height: "2px", background: cw.accentL }}></span>
                {cw.categoryU}
              </p>
              <h2 style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(36px,5vw,80px)", lineHeight: "1" }}>Mission manifest</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <strong style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(56px,6vw,104px)", lineHeight: ".8", color: "transparent", WebkitTextStroke: `1.5px ${cw.accentL}` }}>{cw.missionCount}</strong>
              <span style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", letterSpacing: ".3em", color: "rgba(236,232,223,.65)" }}><span>EVENTS</span><span>ON BOARD</span></span>
            </div>
          </header>
          <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,500px),1fr))", gap: "22px" }}>
            {cw.missions.map((m) => (

              <article key={m.no} data-d-card="" onMouseEnter={v.beep} style={{ display: "flex" }}>
                <div
                  className="hv-ticket"
                  style={{
                    "--hv-accent": cw.accentL,
                    position: "relative",
                    flex: "1",
                    display: "grid",
                    gridTemplateColumns: "120px minmax(0,1fr)",
                    minHeight: "270px",
                    background: "#191816",
                    border: "1px solid rgba(236,232,223,.16)",
                    borderRadius: "18px",
                    overflow: "hidden",
                    WebkitMask: TICKET_MASK,
                    mask: TICKET_MASK,
                    transition: "transform .6s cubic-bezier(.25,1,.1,1),border-color .6s cubic-bezier(.25,1,.1,1)",
                  } as CSSProperties}
                >
                  {/* Poster Background with atmospheric sci-fi overlay */}
                  {m.posterUrl ? (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        overflow: "hidden",
                        pointerEvents: "none",
                      }}
                    >
                      <img
                        src={m.posterUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          opacity: 0.35,
                          filter: "contrast(1.15) brightness(0.9)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(135deg, rgba(16,15,14,0.94) 0%, rgba(20,19,18,0.85) 45%, rgba(16,15,14,0.78) 100%)",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        pointerEvents: "none",
                        background:
                          "radial-gradient(rgba(236,232,223,.06) 1px,transparent 1.3px) 0 0/14px 14px,linear-gradient(160deg,#23211e,#191816 70%)",
                      }}
                    />
                  )}

                  {/* Left Column: GATE and Porthole */}
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                      padding: "24px 10px",
                      borderRight: "1.5px dashed rgba(236,232,223,.22)",
                    }}
                  >

                    <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".28em", color: "rgba(236,232,223,.6)" }}>GATE</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "48px", lineHeight: "1", color: cw.accentL }}>{m.no}</span>
                    <span style={{ position: "relative", width: "80px", height: "80px" }}>
                      <span style={{ position: "absolute", inset: "0", display: "grid", gridTemplate: "100%/100%", placeItems: "center", borderRadius: "50%", overflow: "hidden", background: "radial-gradient(circle at 32% 28%,rgba(236,232,223,.16),transparent 58%),url(/assets/starfield.svg) center/260% auto,#0d0c0b", boxShadow: "inset 0 0 0 3px #2b2926,inset 0 0 0 4px rgba(236,232,223,.3),inset 0 12px 20px rgba(0,0,0,.65)" }}>
                        <img decoding="async" src={m.img} alt="" style={{ height: "62px", width: "auto", maxWidth: "88%", objectFit: "contain", filter: "grayscale(1) contrast(1.3) brightness(1.15) drop-shadow(0 6px 8px rgba(0,0,0,.5))", animation: "iv-porthole 5s ease-in-out infinite" }} />
                      </span>
                      <span style={{ position: "absolute", inset: "-8px", borderRadius: "50%", border: "1.5px dotted rgba(236,232,223,.4)" }}></span>
                    </span>
                  </div>

                  {/* Right Column: Mission Details */}
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      padding: "24px clamp(18px,2vw,28px) 20px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "11px", fontWeight: "700", letterSpacing: ".28em", color: cw.accentL }}>
                      <span>{cw.statLU}</span>
                      <span style={{ color: "rgba(236,232,223,.55)" }}>{cw.serial} · {m.no}</span>
                    </div>

                    <h3 style={{ margin: "0", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(24px,2.4vw,34px)", lineHeight: "1.1", color: "#ECE8DF" }}>
                      {m.name}
                    </h3>
                    <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "rgba(236,232,223,.82)", textWrap: "pretty" }}>
                      {m.text}
                    </p>

                    {/* Bottom Row: Barcode & Brochure Link */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "auto", paddingTop: "20px" }}>

                      <span aria-hidden="true" style={{ flex: "1", height: "26px", opacity: ".55", background: barcode("#ECE8DF") }}></span>
                      {m.brochureUrl ? (
                        <a
                          href={m.brochureUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Event Brochure (Google Drive)"
                          style={{
                            flex: "none",
                            display: "grid",
                            placeItems: "center",
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            border: `1.5px solid ${cw.accentL}`,
                            background: "rgba(236,232,223,0.08)",
                            color: cw.accentL,
                            textDecoration: "none",
                            cursor: "pointer",
                            transition: "background .2s, transform .2s, box-shadow .2s",
                            boxShadow: `0 0 16px ${cw.accentL}40`,
                          }}
                        >
                          <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px" }}>
                            <path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </a>
                      ) : (
                        <span aria-hidden="true" style={{ flex: "none", display: "grid", placeItems: "center", width: "48px", height: "48px", borderRadius: "50%", border: "1px solid rgba(236,232,223,.2)", color: "rgba(236,232,223,.3)" }}>
                          <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px" }}><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.5"></path></svg>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: "96px" }}>
            <a href={v.nw.href} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "6px", textDecoration: "none", color: "#ECE8DF" }}>
              <span style={{ position: "relative", width: "88px", height: "88px", marginBottom: "12px" }}>
                <img decoding="async" src={v.nw.planet} alt="" style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.3) brightness(1.1)", animation: "iv-spin 60s linear infinite" }} />
                <span style={{ position: "absolute", left: "-30%", top: "40%", width: "160%", height: "22%", borderRadius: "50%", border: "1.5px solid rgba(236,232,223,.5)", transform: "rotate(-14deg)" }}></span>
              </span>
              <small style={{ fontSize: "13px", letterSpacing: ".3em", opacity: ".7" }}>NEXT WORLD</small>
              <strong style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(40px,7vw,120px)", lineHeight: "1", color: "transparent", WebkitTextStroke: "1.5px #ECE8DF", transition: "color .6s cubic-bezier(.25,1,.1,1)", textAlign: "center" }} className="hv-paper">{v.nw.nameU}</strong>
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}
