import { Logo } from './icons';
import type { V } from './types';

/** Top-bar label size: 13px up to ~1370px wide, growing with the screen to 16px beside the 24px wordmark. */
const LABEL = "clamp(13px,.95vw,16px)";
const INK = "#141312", PAPER = "#ECE8DF";
/** Frosted paper behind the HUD once the page scrolls under it. */
const FROST = "rgba(236,232,223,.86)";
const EASE = "cubic-bezier(.25,1,.1,1)";

/**
 * Fixed top bar (back, logo, nav, register, about/menu) and bottom bar (Instagram, sound).
 * At the top of a page the bars float over the scene and invert against it (mix-blend difference).
 * Once the page scrolls under them (v.hudSolid) that would invert the content too, so the top bar
 * settles onto a frosted paper strip with ink text and the bottom items onto matching chips.
 */
export default function Hud({ v }: { v: V }) {
  const solid = v.hudSolid, fg = solid ? INK : "#fff";
  const blend = solid ? "normal" : "difference";
  // The chips keep the bottom items' text where it always sat (6px inset): the negative margin cancels the extra padding.
  const chip = { padding: "8px 14px", margin: "-2px -14px", borderRadius: "999px", border: `1px solid ${solid ? "rgba(20,19,18,.12)" : "transparent"}`, background: solid ? FROST : "transparent", backdropFilter: solid ? "blur(14px) saturate(1.2)" : "none", WebkitBackdropFilter: solid ? "blur(14px) saturate(1.2)" : "none", transition: "background-color .4s, border-color .4s" };
  return (
    <>
      <header data-hud="" data-hud-solid={solid ? "" : undefined} className="hud-bar" style={{ position: "fixed", left: "0", right: "0", top: "0", zIndex: "50", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", padding: solid ? "clamp(10px,1.05vw,16px) clamp(16px,2.6vw,44px)" : "clamp(14px,1.8vw,26px) clamp(16px,2.6vw,44px)", pointerEvents: "none", color: fg, mixBlendMode: blend, transition: `padding .5s ${EASE}` }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "-1", background: FROST, backdropFilter: "blur(14px) saturate(1.2)", WebkitBackdropFilter: "blur(14px) saturate(1.2)", borderBottom: "1px solid rgba(20,19,18,.12)", boxShadow: "0 10px 30px -18px rgba(20,19,18,.35)", opacity: solid ? 1 : 0, visibility: solid ? "visible" : "hidden", transition: solid ? "opacity .4s" : "opacity .25s, visibility 0s .25s", pointerEvents: "none" }}></div>
        <div className="hud-group" style={{ display: "flex", alignItems: "center", gap: "18px", pointerEvents: "auto" }}>
          {v.isDetail && (
            <>
              <a href={v.backHref} onMouseEnter={v.hover} className="hud-link" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 0", textDecoration: "none", fontWeight: "500", fontSize: LABEL, letterSpacing: ".04em", color: "inherit" }}>
                <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
                  <path d="M5 1 1 5l4 4M1 5h15" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
                </svg>
                <span data-scr="">BACK</span>
              </a>
              <span style={{ width: "1px", height: "22px", background: "currentColor", opacity: ".4" }}></span>
            </>
          )}
          <a data-magnet="" href="#/" onClick={v.goHome} aria-label="Innovision home" onMouseEnter={v.beep} className="hud-link" style={{ display: "inline-flex", alignItems: "center", gap: "10px", color: "inherit", textDecoration: "none" }}>
            <Logo style={{ width: "clamp(24px,2vw,32px)", height: "auto" }} />
            <span className={v.isDetail ? "hud-wordmark hud-wordmark-detail" : "hud-wordmark"} style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(17px,1.6vw,24px)", letterSpacing: ".04em" }}>INNOVISION</span>
          </a>
        </div>
        {v.wide && (
          <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: "clamp(14px,2.2vw,36px)", pointerEvents: "auto" }}>
            {v.navLinks.map((l, lI) => (
              <a key={lI} data-magnet="" href={l.href} onClick={l.onClick} onMouseEnter={v.hover} aria-current={l.cur === 'true' ? 'page' : undefined} className="hud-link" style={{ position: "relative", display: "inline-block", padding: "8px 0", textDecoration: "none", fontWeight: "500", fontSize: LABEL, letterSpacing: ".14em", color: "inherit", opacity: l.o, transition: "opacity .4s" }}>
                <span data-scr="">{l.label}</span>
                <span style={{ position: "absolute", left: "0", right: "0", bottom: "2px", height: "1.5px", background: "currentColor", transform: `scaleX(${l.bar})`, transformOrigin: "left", transition: `transform .5s ${EASE}` }}></span>
              </a>
            ))}
          </nav>
        )}
        <div className="hud-group" style={{ display: "flex", alignItems: "center", gap: "18px", pointerEvents: "auto" }}>
          <a data-magnet="" href="#register" onClick={v.register} onMouseEnter={v.hover} className="hud-register hud-cta" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px,.8vw,14px) clamp(20px,1.3vw,24px)", textDecoration: "none", fontWeight: "700", fontSize: LABEL, letterSpacing: ".08em", color: solid ? PAPER : "#000", background: solid ? INK : "#fff", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)", transition: "background-color .4s, color .4s" }}>
            <span data-scr="">{v.noUser ? "REGISTER" : "MY PASS"}</span>
          </a>
          {/* Outlined twin of REGISTER: a 1.5px ring of the HUD colour around a fill of the bar behind it. */}
          {v.showLogin && (
            <a data-magnet="" href="#login" onClick={v.loginClick} onMouseEnter={v.hover} className="hud-register hud-ghost" style={{ position: "relative", isolation: "isolate", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px,.8vw,14px) clamp(20px,1.3vw,24px)", textDecoration: "none", fontWeight: "700", fontSize: LABEL, letterSpacing: ".08em", color: "inherit", background: "currentColor", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }}>
              <span aria-hidden="true" style={{ position: "absolute", inset: "1.5px", zIndex: "-1", background: solid ? PAPER : "#000", clipPath: "polygon(7.4px 0,100% 0,100% calc(100% - 7.4px),calc(100% - 7.4px) 100%,0 100%,0 7.4px)", transition: "background-color .4s" }}></span>
              <span data-scr="" style={{ color: fg }}>{v.noUser ? "LOG IN" : "LOG OUT"}</span>
            </a>
          )}
          {!v.wide && (
            <button type="button" onClick={v.menuButton} onMouseEnter={v.hover} aria-expanded={v.menuExpanded} className="hud-link" style={{ display: "inline-flex", alignItems: "center", padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: LABEL, letterSpacing: ".14em", color: "inherit" }}>
              <span data-scr="">MENU</span>
            </button>
          )}
        </div>
      </header>
      <footer data-hud="" style={{ position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "50", display: "flex", justifyContent: "space-between", alignItems: "end", padding: "clamp(16px,2.6vw,44px)", pointerEvents: "none", color: fg, mixBlendMode: blend }}>
        <a href="https://www.instagram.com/" target="_blank" rel="noopener" onMouseEnter={v.hover} className="hud-link" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: "500", fontSize: "clamp(13px,1vw,15px)", letterSpacing: ".02em", color: "inherit", pointerEvents: "auto", ...chip }}>
          <span data-scr="">INSTAGRAM</span>
        </a>
        <button type="button" onClick={v.toggleSound} onMouseEnter={v.hover} aria-pressed={v.soundOn} aria-label={v.soundLabel} className="hud-link" style={{ display: "inline-flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: "500", fontSize: "clamp(13px,1vw,15px)", letterSpacing: ".02em", color: "inherit", pointerEvents: "auto", ...chip }}>
          <svg width="40" height="9" viewBox="0 0 73 9" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeMiterlimit="10">
              {v.muted && (
                <path d="M0 4.5h73"></path>
              )}
              {v.soundOn && (
                <g data-wave="">
                  <path d="M0 .5C3.33.5 3.33 8.5 6.66 8.5 9.99 8.5 10 .5 13.33.5c3.33 0 3.33 8 6.67 8"></path>
                  <path d="M53 .5c3.33 0 3.33 8 6.66 8 3.33 0 3.34-8 6.67-8 3.33 0 3.33 8 6.67 8"></path>
                  <path d="M20 8.5c2.5 0 3-6.5 6-7.5 3-1 3.33 5.5 6.66 5.5S36 3 39.33 3s3.33 5 6.67 5c3 0 3.8-7.5 7-7.5"></path>
                </g>
              )}
            </g>
          </svg>
          <span data-scr="">SOUND</span>
        </button>
      </footer>
    </>
  );
}
