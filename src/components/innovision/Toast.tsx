import { Sparkle } from './icons';
import type { V } from './types';

/** Bottom toast message. */
export default function Toast({ v }: { v: V }) {
  return (
    <div aria-live="polite" style={{ position: "fixed", left: "0", right: "0", bottom: "calc(clamp(16px,2.6vw,44px) + 140px)", zIndex: "70", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 22px", background: "#141312", color: "#ECE8DF", fontSize: "14px", fontWeight: "500", letterSpacing: ".04em", clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)", opacity: v.toastO, transform: `translateY(${v.toastY})`, transition: "opacity .5s cubic-bezier(.25,1,.1,1),transform .5s cubic-bezier(.25,1,.1,1)" }}>
        <Sparkle style={{ width: "14px", height: "14px", color: "oklch(0.8 0.12 85)" }} />
        {v.toastMsg}
      </div>
    </div>
  );
}
