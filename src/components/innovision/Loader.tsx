/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { Sparkle } from './icons';
import { CornerFrame } from './decor';
import type { V } from './types';

const MONO = "grayscale(1) contrast(1.35) brightness(1.05)";
/** Orbiting planets that swing into alignment as loading progresses: [ring inset, ring border, orb index, start angle, size %, image]. */
const ORBS: [string, string, number, number, number, string][] = [
  ['0', '1px dotted rgba(20,19,18,.5)', 2, 236, 12, 'planet-tide.webp'],
  ['14%', '1px dashed rgba(20,19,18,.45)', 1, -148, 13, 'planet-blue.webp'],
  ['26%', '1px solid rgba(20,19,18,.3)', 0, 128, 16, 'planet-yellow.webp'],
];
const DISC = 'min(58vmin, 540px, 100vh - 330px)';

/** Orbital preloader. */
export default function Loader({ v }: { v: V }) {
  return (
    <div data-loader="" data-screen-label="Loader" aria-hidden="true" style={{ position: "fixed", inset: "0", zIndex: "100", overflow: "hidden" }}>
      <div data-loader-bg="" style={{ position: "absolute", inset: "0", background: "#ECE8DF" }}>
        <div style={{ position: "absolute", left: "50%", top: "44%", width: "180vmax", height: "180vmax", margin: "-90vmax 0 0 -90vmax", borderRadius: "50%", background: "repeating-conic-gradient(from 0deg,rgba(20,19,18,.08) 0deg .5deg,transparent .5deg 5deg)", WebkitMaskImage: "radial-gradient(circle,transparent 17%,#000 22%,transparent 50%)", maskImage: "radial-gradient(circle,transparent 17%,#000 22%,transparent 50%)" }}></div>
        <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(20,19,18,.18) 1px,transparent 1.4px)", backgroundSize: "22px 22px", WebkitMaskImage: "radial-gradient(ellipse at 50% 44%,#000 8%,transparent 62%)", maskImage: "radial-gradient(ellipse at 50% 44%,#000 8%,transparent 62%)" }}></div>
      </div>
      {v.loaderSparks.map((s, sI) => (
        <div key={sI} data-l-fade="" data-lp-skip={sI % 2 ? "" : undefined} style={{ position: "absolute", left: s.x, top: s.y, width: s.s, height: s.s, color: "#141312", pointerEvents: "none" }}>
          <Sparkle data-twinkle="" style={{ display: "block", width: "100%", height: "100%" }} />
        </div>
      ))}
      <div data-l-fade="" data-l-corner="" style={{ position: "absolute", top: "clamp(16px,2.6vw,44px)", left: "clamp(16px,2.6vw,44px)", fontWeight: "500", fontSize: "13px", letterSpacing: ".3em" }}>CELESTIAL ODYSSEY</div>
      <div data-l-fade="" data-l-corner="" style={{ position: "absolute", top: "clamp(16px,2.6vw,44px)", right: "clamp(16px,2.6vw,44px)", fontWeight: "500", fontSize: "13px", letterSpacing: ".3em" }}>MMXXVI</div>
      <CornerFrame data-l-fade="" data-l-corner="" color="rgba(20,19,18,.45)" style={{ top: "calc(clamp(16px,2.6vw,44px) + 34px)", bottom: "clamp(16px,2.6vw,44px)" }} />
      <div style={{ position: "absolute", left: `calc(50% - ${DISC} / 2)`, top: `calc(40% - ${DISC} / 2)`, width: DISC, height: DISC }}>
        <div data-l-ring="" style={{ position: "absolute", inset: "-4%", borderRadius: "50%", background: "repeating-conic-gradient(from -.25deg,rgba(20,19,18,.5) 0deg .5deg,transparent .5deg 3.6deg)", WebkitMaskImage: "radial-gradient(circle closest-side,transparent 94%,#000 94.5%,#000 98.5%,transparent 99%)", maskImage: "radial-gradient(circle closest-side,transparent 94%,#000 94.5%,#000 98.5%,transparent 99%)" }}></div>
        <div data-l-ring="" style={{ position: "absolute", inset: "-4%", borderRadius: "50%", background: "repeating-conic-gradient(from -.4deg,rgba(20,19,18,.8) 0deg .8deg,transparent .8deg 36deg)", WebkitMaskImage: "radial-gradient(circle closest-side,transparent 90%,#000 90.5%,#000 98.5%,transparent 99%)", maskImage: "radial-gradient(circle closest-side,transparent 90%,#000 90.5%,#000 98.5%,transparent 99%)" }}></div>
        <svg data-l-fade="" viewBox="0 0 100 100" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
          <polyline data-l-link="" points="50,50 50,26 50,14 50,0" fill="none" stroke="#8a6a2a" strokeWidth=".45" strokeLinecap="round" strokeDasharray="1.2 1.8"></polyline>
        </svg>
        {ORBS.map(([inset, border, i, a0, size, img]) => (
          <div key={i} data-l-ring="" style={{ position: "absolute", inset, borderRadius: "50%", border }}>
            <div data-l-orb="" data-i={i} data-a0={a0} style={{ position: "absolute", inset: "0" }}>
              <div style={{ position: "absolute", left: "50%", top: "0", width: size + "%", height: size + "%", margin: `-${size / 2}% 0 0 -${size / 2}%` }}>
                <span data-l-lock="" style={{ position: "absolute", inset: "-30%", borderRadius: "50%", border: "1.5px solid #8a6a2a", opacity: "0" }}></span>
                <img decoding="async" src={"/assets/" + img} alt="" style={{ width: "100%", height: "100%", filter: MONO }} />
              </div>
            </div>
          </div>
        ))}
        <svg data-l-fade="" viewBox="0 0 100 100" style={{ position: "absolute", inset: "31%", width: "38%", height: "38%", overflow: "visible" }}>
          <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(20,19,18,.14)" strokeWidth="1.2"></circle>
          <circle data-l-progress="" cx="50" cy="50" r="49" fill="none" stroke="#8a6a2a" strokeWidth="1.6" strokeDasharray="307.9" strokeDashoffset="307.9" transform="rotate(-90 50 50)"></circle>
        </svg>
        <span data-l-flare="" style={{ position: "absolute", inset: "30%", borderRadius: "50%", border: "2px solid #8a6a2a", opacity: "0", pointerEvents: "none" }}></span>
        <div data-loader-disc="" style={{ position: "absolute", inset: "34%", borderRadius: "50%", background: "#141312", overflow: "hidden" }}>
          <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".95" }} />
          <span style={{ position: "absolute", inset: "4%", borderRadius: "50%", border: "1px solid rgba(236,232,223,.14)" }}></span>
          <div data-l-fade="" style={{ position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#ECE8DF" }}>
            <span data-l-count="" style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "min(6.2vmin, 54px)", lineHeight: "1", fontVariantNumeric: "tabular-nums" }}>000</span>
            <span style={{ marginTop: "6px", fontSize: "min(1.3vmin, 11px)", letterSpacing: ".3em", opacity: ".75" }}>PERCENT</span>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: "0", right: "0", bottom: "clamp(30px,6.5vh,80px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" }}>
        <div data-l-fade="" style={{ overflow: "hidden" }}>
          <div data-l-line="" style={{ fontSize: "12px", fontWeight: "500", letterSpacing: ".34em" }}>NIT ROURKELA PRESENTS</div>
        </div>
        <div data-l-fade="" style={{ overflow: "hidden" }}>
          <div data-l-line="" style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(24px,2.6vw,38px)", letterSpacing: ".12em" }}>INNOVISION 2026</div>
        </div>
        <div data-l-fade="" style={{ overflow: "hidden" }}>
          <div data-l-line="" style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".3em", color: "#8a6a2a" }}>
            <span data-l-status="">ALIGNING THE ORBITS</span>
          </div>
        </div>
        <div data-l-fade="" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 26px", marginTop: "6px", fontSize: "11px", fontWeight: "700", letterSpacing: ".26em" }}>
          {['FLAGSHIP', 'MAIN', 'DTS & FUN'].map((t) => (
            <span key={t} data-l-world="" style={{ display: "flex", alignItems: "center", gap: "8px", opacity: ".4" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" }}></span>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
