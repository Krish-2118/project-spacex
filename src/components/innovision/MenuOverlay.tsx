/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import type { CSSProperties } from 'react';
import { Logo } from './icons';
import type { V } from './types';

/**
 * Full-screen circular-reveal menu for compact screens: a top bar mirroring the HUD (CLOSE sits where MENU was),
 * a ruled list of destinations, then the secondary links. Layout and the staggered row entrance live in
 * globals.css (.menu-*); data-open drives the entrance so it replays each time the menu opens.
 */
export default function MenuOverlay({ v }: { v: V }) {
  return (
    <div data-menu="" aria-hidden={v.menuHidden} data-open={v.menuHidden ? undefined : ""} className="menu" style={{ position: "fixed", inset: "0", zIndex: "66", visibility: v.menuVis, transition: `visibility 0s linear ${v.menuDelay}` }}>
      <div className="menu-panel" style={{ clipPath: v.menuClip, transition: "clip-path .9s cubic-bezier(.25,1,.1,1)" }}>
        <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".45", pointerEvents: "none" }} />
        <div className="menu-top">
          <a href="#/" onClick={(e) => { v.closeMenu(); v.goHome(e); }} aria-label="Innovision home" className="menu-brand">
            <Logo style={{ width: "24px", height: "auto" }} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "17px", letterSpacing: ".04em" }}>INNOVISION</span>
          </a>
          <button type="button" onClick={v.closeMenu} onMouseEnter={v.hover} className="menu-close">
            <span data-scr="">CLOSE</span>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1 1 11" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
            </svg>
          </button>
        </div>
        <div className="menu-body">
          <nav aria-label="Menu">
            <ul className="menu-list">
              {v.topNav.map((t, tI) => (
                <li key={tI} className="menu-item" style={{ "--i": tI } as CSSProperties}>
                  <a href={t.href} onClick={t.onClick} aria-current={t.cur ? "page" : undefined} className="menu-link" style={{ color: t.menuColor }}>
                    <span className="menu-label">{t.labelCap}</span>
                    <svg className="menu-arrow" width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
                      <path d="M13 1l4 4-4 4M17 5H0" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="menu-foot menu-item" style={{ "--i": v.topNav.length } as CSSProperties}>
            <div className="menu-meta">
              {/* Account (phones, where the HUD has no LOG IN): LOG IN signed out; PROFILE and LOG OUT signed in. */}
              {!v.showLogin && v.authReady && v.noUser && <a href="#login" onClick={v.menuLogin} onPointerDown={v.prefetchAuth} onFocus={v.prefetchAuth} className="hv-sand">LOG IN</a>}
              {!v.showLogin && v.authReady && !v.noUser && <a href="#profile" onClick={v.openProfile} aria-label={v.profileAria} className="hv-sand">PROFILE</a>}
              {!v.showLogin && v.authReady && !v.noUser && <a href="#logout" onClick={v.menuLogout} className="hv-sand">LOG OUT</a>}
              <a href="#about" onClick={v.openAbout} className="hv-sand">ABOUT</a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener" className="hv-sand">INSTAGRAM</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
