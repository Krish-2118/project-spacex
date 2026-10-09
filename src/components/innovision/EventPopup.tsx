"use client";
/* eslint-disable @next/next/no-img-element -- posters come from the events store at arbitrary sizes */
import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { V } from './types';

const FOCUSABLE = 'a[href],button:not([disabled])';

/**
 * An event's poster and rulebook, opened from the arrow on its mission ticket (DetailView). Closes from the
 * red corner cross, Escape (Innovision#onKey) or a click on the backdrop, and hands focus back
 * to the arrow that opened it.
 */
export default function EventPopup({ v }: { v: V }) {
  const m = v.eventPop == null ? null : v.cw.missions[v.eventPop];
  const closeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keyed on the index, not the mission object: the view model is rebuilt on every render.
  const open = v.eventPop != null;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { opener?.focus?.(); };
  }, [open]);

  if (!m) return null;
  const accent = v.cw.accentL;

  // Keeps Tab inside the dialog while it is open.
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !boxRef.current) return;
    const els = [...boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="ev-pop" onClick={v.closeEvent} onKeyDown={trap} style={{ position: "fixed", inset: "0", zIndex: 90, display: "grid", placeItems: "center", padding: "clamp(16px,4vw,40px)", background: "rgba(7,6,5,.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="ev-pop-title" className="ev-pop-box" onClick={(e) => e.stopPropagation()} style={{ position: "relative", display: "flex", flexDirection: "column", width: "min(460px, 100%)", maxHeight: "100%", overflow: "hidden", background: "#191816", border: "1px solid rgba(236,232,223,.16)", borderRadius: "18px", boxShadow: "0 40px 80px -20px rgba(0,0,0,.6)", color: "#ECE8DF" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 14px 14px 20px", borderBottom: "1px solid rgba(236,232,223,.12)", fontSize: "11px", fontWeight: "700", letterSpacing: ".28em", color: accent }}>
          <span>GATE {m.no} · {v.cw.serial}</span>
          <button ref={closeRef} type="button" onClick={v.closeEvent} aria-label="Close" className="ev-pop-x" style={{ display: "grid", placeItems: "center", width: "38px", height: "38px", padding: "0", borderRadius: "50%", border: "0", background: "#DC2626", color: "#FFFFFF", boxShadow: "0 6px 16px -6px rgba(220,38,38,.7)", cursor: "pointer" }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "18px", height: "18px" }}><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"></path></svg>
          </button>
        </div>

        <div style={{ flex: "1 1 auto", minHeight: "0", display: "grid", placeItems: "center", padding: "16px 16px 0" }}>
          {m.posterUrl ? (
            <img src={m.posterUrl} alt={`${m.name} poster`} style={{ display: "block", maxWidth: "100%", maxHeight: "min(60vh, 600px)", width: "auto", height: "auto", borderRadius: "10px", objectFit: "contain" }} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", gap: "14px", width: "100%", aspectRatio: "4 / 5", maxHeight: "min(52vh, 520px)", borderRadius: "10px", border: "1.5px dashed rgba(236,232,223,.2)", background: "radial-gradient(rgba(236,232,223,.06) 1px,transparent 1.3px) 0 0/14px 14px,linear-gradient(160deg,#23211e,#191816 70%)", textAlign: "center" }}>
              <div style={{ display: "grid", justifyItems: "center", gap: "14px" }}>
                <img src={m.img} alt="" style={{ height: "84px", width: "auto", filter: "grayscale(1) contrast(1.3) brightness(1.15)", opacity: ".7" }} />
                <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".28em", color: "rgba(236,232,223,.6)" }}>POSTER DROPS SOON</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "18px 20px 20px" }}>
          <h2 id="ev-pop-title" style={{ margin: "0 0 16px", fontFamily: "var(--font-cinzel),serif", fontWeight: "900", fontSize: "clamp(22px,2.2vw,28px)", lineHeight: "1.15" }}>{m.name}</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            {m.brochureUrl ? (
              <a href={m.brochureUrl} target="_blank" rel="noopener noreferrer" className="ev-pop-rule" style={{ ["--hv-accent" as string]: accent, flex: "1", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px", height: "48px", borderRadius: "999px", background: accent, color: "#141312", textDecoration: "none", fontSize: "13px", fontWeight: "700", letterSpacing: ".16em" }}>
                RULEBOOK
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px" }}><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
              </a>
            ) : (
              <button type="button" disabled style={{ flex: "1", height: "48px", borderRadius: "999px", border: "1px dashed rgba(236,232,223,.25)", background: "transparent", color: "rgba(236,232,223,.5)", fontSize: "13px", fontWeight: "700", letterSpacing: ".16em", cursor: "not-allowed" }}>RULEBOOK SOON</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
