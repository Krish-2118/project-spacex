/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { createContext, useContext } from 'react';
import type { V } from './types';

/** The latest render values, for parts of memoised views that must track state. */
export const LiveV = createContext<V | null>(null);

/** The footer inside the (never re-rendering) home view: its Events link follows the current world. */
export function LiveFooter() {
  const v = useContext(LiveV);
  return v && <SiteFooter v={v} />;
}

/** Rounded starfield footer with newsletter sign-up. */
export default function SiteFooter({ v }: { v: V }) {
  return (
    <footer data-sec="footer" style={{ position: "relative", zIndex: 10, overflow: "hidden", background: "#141312", color: "#ECE8DF", borderRadius: "50% 50% 0 0 / 140px 140px 0 0", padding: "150px clamp(20px,4vw,64px) calc(clamp(16px,2.6vw,44px) + 90px)" }}>
      <img decoding="async" src="/assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".6", pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "48px 40px", paddingBottom: "56px", borderBottom: "1px solid rgba(236,232,223,.16)" }}>
          <div style={{ flex: "2 1 340px", minWidth: "0", maxWidth: "460px" }}>
            <div data-attract=".08" style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(30px,3.2vw,48px)", letterSpacing: ".04em" }}>INNOVISION</div>
            <div style={{ marginTop: "8px", fontSize: "13px", letterSpacing: ".3em", color: "rgba(236,232,223,.75)" }}>THE CELESTIAL ODYSSEY · NIT ROURKELA</div>
            <p style={{ margin: "32px 0 14px", fontSize: "15px", lineHeight: "1.6", color: "rgba(236,232,223,.82)" }}>Mission updates, straight to your inbox.</p>
            <form onSubmit={v.subscribe} style={{ display: "flex", border: "1.5px solid rgba(236,232,223,.4)" }}>
              <input name="email" type="email" required placeholder="you@college.edu" aria-label="Email address" style={{ flex: "1", minWidth: "0", padding: "15px 16px", border: "0", outline: "0", background: "transparent", color: "#ECE8DF", fontSize: "15px" }} />
              <button type="submit" style={{ padding: "0 22px", border: "0", background: "#ECE8DF", color: "#141312", fontWeight: "700", fontSize: "13px", letterSpacing: ".08em", cursor: "pointer", transition: "background-color .3s" }} className="hv-gold-bg">SUBSCRIBE</button>
            </form>
          </div>
          <nav aria-label="Explore" style={{ flex: "1 1 140px" }}>
            <p style={{ margin: "0 0 18px", fontSize: "12px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}>EXPLORE</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {v.footLinks.map((l, lI) => (
                <a key={lI} href={l.href} onClick={l.onClick} style={{ textDecoration: "none", color: "#ECE8DF", fontSize: "15px", opacity: ".82", transition: "opacity .3s" }} className="hv-link-paper">{l.name}</a>
              ))}
            </div>
          </nav>
          <nav aria-label="Worlds" style={{ flex: "1 1 160px" }}>
            <p style={{ margin: "0 0 18px", fontSize: "12px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}>WORLDS</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {v.worlds.map((w, wI) => (
                <a key={wI} href={w.href} style={{ textDecoration: "none", color: "#ECE8DF", fontSize: "15px", opacity: ".82", transition: "opacity .3s" }} className="hv-link-paper">{w.name}</a>
              ))}
            </div>
          </nav>
          <nav aria-label="Connect" style={{ flex: "1 1 140px" }}>
            <p style={{ margin: "0 0 18px", fontSize: "12px", fontWeight: "700", letterSpacing: ".3em", color: "oklch(0.8 0.12 85)" }}>CONNECT</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener" style={{ textDecoration: "none", color: "#ECE8DF", fontSize: "15px", opacity: ".82", transition: "opacity .3s" }} className="hv-link-paper">Instagram</a>
              <a href="https://www.linkedin.com/" target="_blank" rel="noopener" style={{ textDecoration: "none", color: "#ECE8DF", fontSize: "15px", opacity: ".82", transition: "opacity .3s" }} className="hv-link-paper">LinkedIn</a>
              <a href="https://www.youtube.com/" target="_blank" rel="noopener" style={{ textDecoration: "none", color: "#ECE8DF", fontSize: "15px", opacity: ".82", transition: "opacity .3s" }} className="hv-link-paper">YouTube</a>
              <a href="#about" onClick={v.openAbout} style={{ textDecoration: "none", color: "#ECE8DF", fontSize: "15px", opacity: ".82", transition: "opacity .3s" }} className="hv-link-paper">About the fest</a>
            </div>
          </nav>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 32px", justifyContent: "space-between", alignItems: "center", paddingTop: "28px", fontSize: "14px", color: "rgba(236,232,223,.78)" }}>
          <span>© 2026 Innovision · NIT Rourkela, Odisha</span>
          <span style={{ fontSize: "18px", fontWeight: "700", color: "#ECE8DF", textShadow: "0 0 10px rgba(236, 232, 223, 0.4)" }}>Crafted with <span style={{ color: "oklch(0.72 0.13 25)" }}>♥</span> by <b style={{ color: "#fff", textShadow: "0 0 15px rgba(255,255,255,0.7)" }}>OpenCode NIT Rourkela</b></span>
          <a data-magnet="" href="#top" onClick={v.toTop} onMouseEnter={v.hover} style={{ display: "inline-block", color: "#ECE8DF", textDecoration: "none", fontWeight: "500", letterSpacing: ".06em" }}>
            <span data-scr="">BACK TO ORBIT ↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
