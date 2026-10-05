import { Logo } from './icons';
import type { V } from './types';

/** Top-bar label size: 13px up to ~1370px wide, growing with the screen to 16px beside the 24px wordmark. */
const LABEL = "clamp(13px,.95vw,16px)";
const INK = "#141312", PAPER = "#ECE8DF";
/** Frosted paper behind the HUD once the page scrolls under it. */
const FROST = "rgba(236,232,223,.86)";
const EASE = "cubic-bezier(.25,1,.1,1)";

/**
 * Fixed top bar: back, logo, nav, sound (orbit toggle), register, log in / menu.
 * At the top of a page the bars float over the scene and invert against it (mix-blend difference).
 * Once the page scrolls under them (v.hudSolid) that would invert the content too, so the top bar
 * settles onto a frosted paper strip with ink text.
 */
export default function Hud({ v }: { v: V }) {
  const solid = v.hudSolid, fg = solid ? INK : "#fff";
  const blend = solid ? "normal" : "difference";
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
          <a data-magnet="" href="#/" onClick={v.goHome} aria-label="Innovision home" className="hud-link" style={{ display: "inline-flex", alignItems: "center", gap: "10px", color: "inherit", textDecoration: "none" }}>
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
        <div className="hud-group" style={{ display: "flex", alignItems: "center", gap: "14px", pointerEvents: "auto" }}>
          {/* Sound: a satellite on its orbit. It circles while sound is on and freezes where it is when off (ring dashed,
              satellite hollow); turning sound on sends out one ping. On phones the label drops, leaving the orbit. */}
          <button type="button" onClick={v.toggleSound} onMouseEnter={v.hover} aria-pressed={v.soundOn} aria-label={v.soundLabel} title={v.soundLabel} data-on={v.soundOn ? "" : undefined} className="hud-link hud-sound" style={{ display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "40px", padding: "0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: LABEL, letterSpacing: ".14em", color: "inherit" }}>
            <span className="hud-orbit" aria-hidden="true">
              <svg viewBox="0 0 20 20">
                <circle className="hud-orbit-ring" cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"></circle>
                <g className="hud-orbit-sat"><circle cx="10" cy="3" r="2.6"></circle></g>
              </svg>
              {v.soundOn && <span key="ping" className="hud-orbit-ping"></span>}
            </span>
            <span className="hud-sound-label"><span data-scr="">SOUND</span> <span className="hud-sound-state">{v.soundOn ? "ON" : "OFF"}</span></span>
          </button>

          {/* Staff Portal Shortcut (Admin / IT-Team) */}
          {!v.noUser && v.isStaff && (
            <button
              id="hud-staff-portal-btn"
              type="button"
              onClick={v.openAdmin}
              onMouseEnter={v.hover}
              className="hud-register"
              title="Open Staff Control Portal"
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "clamp(10px,.7vw,12px) clamp(14px,1vw,18px)",
                border: "1px solid oklch(0.8 0.12 85)",
                background: "rgba(220,183,106,0.15)",
                color: fg,
                fontWeight: "700",
                fontSize: LABEL,
                letterSpacing: ".08em",
                cursor: "pointer",
                clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span data-scr="">PORTAL</span>
            </button>
          )}

          {/* Primary Action Button: REGISTER if not registered, MY PASS if registered */}
          <a
            id="hud-reg-pass-btn"
            data-magnet=""
            href="#register"
            onClick={v.register}
            onMouseEnter={v.hover}
            className="hud-register hud-cta"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(12px,.8vw,14px) clamp(20px,1.3vw,24px)",
              textDecoration: "none",
              fontWeight: "700",
              fontSize: LABEL,
              letterSpacing: ".08em",
              color: solid ? PAPER : "#000",
              background: solid ? INK : "#fff",
              clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
              transition: "background-color .4s, color .4s",
            }}
          >
            <span data-scr="">{v.noUser || !v.hasRegistered ? "REGISTER" : "MY PASS"}</span>
          </a>

          {/* Secondary Action: LOG IN if not logged in, PROFILE if logged in */}
          {v.showLogin && (
            <a
              id="hud-auth-profile-btn"
              data-magnet=""
              href={v.noUser ? "#login" : "#profile"}
              onClick={v.noUser ? v.loginClick : v.openProfile}
              onMouseEnter={v.hover}
              className="hud-register hud-ghost"
              style={{
                position: "relative",
                isolation: "isolate",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "clamp(12px,.8vw,14px) clamp(20px,1.3vw,24px)",
                textDecoration: "none",
                fontWeight: "700",
                fontSize: LABEL,
                letterSpacing: ".08em",
                color: "inherit",
                background: "currentColor",
                clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: "1.5px",
                  zIndex: "-1",
                  background: solid ? PAPER : "#000",
                  clipPath: "polygon(7.4px 0,100% 0,100% calc(100% - 7.4px),calc(100% - 7.4px) 100%,0 100%,0 7.4px)",
                  transition: "background-color .4s",
                }}
              ></span>
              <span data-scr="" style={{ color: fg }}>{v.noUser ? "LOG IN" : "PROFILE"}</span>
            </a>
          )}
          {!v.wide && (
            <button type="button" onClick={v.menuButton} onMouseEnter={v.hover} aria-expanded={v.menuExpanded} className="hud-link" style={{ display: "inline-flex", alignItems: "center", padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: LABEL, letterSpacing: ".14em", color: "inherit" }}>
              <span data-scr="">MENU</span>
            </button>
          )}
        </div>
      </header>
    </>
  );
}
