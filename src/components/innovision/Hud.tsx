import { Logo } from './icons';
import type { V } from './types';

/** Fixed top bar (back, logo, nav, register, about/menu) and bottom bar (Instagram, sound). */
export default function Hud({ v }: { v: V }) {
  return (
    <>
      <header data-hud="" className="hud-bar" style={{ position: "fixed", left: "0", right: "0", top: "0", zIndex: "50", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", padding: "clamp(14px,1.8vw,26px) clamp(16px,2.6vw,44px)", pointerEvents: "none", color: "#fff", mixBlendMode: "difference" }}>
        <div className="hud-group" style={{ display: "flex", alignItems: "center", gap: "18px", pointerEvents: "auto" }}>
          {v.isDetail && (
            <>
              <a href={v.backHref} onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 0", textDecoration: "none", fontWeight: "500", fontSize: "14px", letterSpacing: ".04em", color: "#fff" }}>
                <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
                  <path d="M5 1 1 5l4 4M1 5h15" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
                </svg>
                <span data-scr="">BACK</span>
              </a>
              <span style={{ width: "1px", height: "22px", background: "#fff", opacity: ".4" }}></span>
            </>
          )}
          <a data-magnet="" href="#/" onClick={v.goHome} aria-label="Innovision home" onMouseEnter={v.beep} style={{ display: "inline-flex", alignItems: "center", gap: "10px", color: "#fff", textDecoration: "none" }}>
            <Logo style={{ width: "clamp(24px,2vw,32px)", height: "auto" }} />
            <span className={v.isDetail ? "hud-wordmark hud-wordmark-detail" : "hud-wordmark"} style={{ fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(17px,1.6vw,24px)", letterSpacing: ".04em" }}>INNOVISION</span>
          </a>
        </div>
        {v.wide && (
          <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: "clamp(14px,2.2vw,36px)", pointerEvents: "auto" }}>
            {v.navLinks.map((l, lI) => (
              <a key={lI} data-magnet="" href={l.href} onClick={l.onClick} onMouseEnter={v.hover} aria-current={l.cur} style={{ position: "relative", display: "inline-block", padding: "8px 0", textDecoration: "none", fontWeight: "500", fontSize: "13px", letterSpacing: ".14em", color: "#fff", opacity: l.o, transition: "opacity .4s" }} className="hv-link-white">
                <span data-scr="">{l.label}</span>
                <span style={{ position: "absolute", left: "0", right: "0", bottom: "2px", height: "1.5px", background: "#fff", transform: `scaleX(${l.bar})`, transformOrigin: "left", transition: "transform .5s cubic-bezier(.25,1,.1,1)" }}></span>
              </a>
            ))}
          </nav>
        )}
        <div className="hud-group" style={{ display: "flex", alignItems: "center", gap: "18px", pointerEvents: "auto" }}>
          <a data-magnet="" href="#register" onClick={v.register} onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 20px", textDecoration: "none", fontWeight: "700", fontSize: "13px", letterSpacing: ".08em", color: "#000", background: "#fff", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} className="hv-black hud-register">
            <span data-scr="">REGISTER</span>
          </a>
          <button type="button" onClick={v.menuButton} onMouseEnter={v.hover} aria-expanded={v.menuExpanded} style={{ display: "inline-flex", alignItems: "center", padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: "13px", letterSpacing: ".14em", color: "#fff" }}>
            <span data-scr="">{v.menuLabel}</span>
          </button>
        </div>
      </header>
      <footer data-hud="" style={{ position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "50", display: "flex", justifyContent: "space-between", alignItems: "end", padding: "clamp(16px,2.6vw,44px)", pointerEvents: "none", color: "#fff", mixBlendMode: "difference" }}>
        <a href="https://www.instagram.com/" target="_blank" rel="noopener" onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", padding: "6px 0", textDecoration: "none", fontWeight: "500", fontSize: "clamp(13px,1vw,15px)", letterSpacing: ".02em", color: "#fff", pointerEvents: "auto" }}>
          <span data-scr="">INSTAGRAM</span>
        </a>
        <button type="button" onClick={v.toggleSound} onMouseEnter={v.hover} aria-pressed={v.soundOn} aria-label={v.soundLabel} style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: "clamp(13px,1vw,15px)", letterSpacing: ".02em", color: "#fff", pointerEvents: "auto" }}>
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
