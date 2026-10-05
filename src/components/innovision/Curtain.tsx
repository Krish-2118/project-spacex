/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */
import { Sparkle } from './icons';
import type { V } from './types';

/** Layered cloud curtain used for view transitions. */
export default function Curtain({ v }: { v: V }) {
  return (
    <div data-curtain="" aria-hidden="true" style={{ position: "fixed", inset: "0", zIndex: "40", overflow: "hidden", pointerEvents: "none" }}>
      <div data-c-layer="" style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "300vh", transform: "translateY(100%)", filter: "grayscale(1) sepia(.15) brightness(.3)" }}>
        <img decoding="async" src="/assets/cloud-5.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom" }} />
        <div style={{ height: "calc(100vh + 4px)", margin: "-2px 0", background: "#743a61" }}></div>
        <img decoding="async" src="/assets/cloud-5.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom", transform: "scaleY(-1)" }} />
      </div>
      <div data-c-layer="" style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "300vh", transform: "translateY(100%)", filter: "grayscale(1) sepia(.15) brightness(.55)" }}>
        <img decoding="async" src="/assets/cloud-4.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom" }} />
        <div style={{ height: "calc(100vh + 4px)", margin: "-2px 0", background: "#ba647c" }}></div>
        <img decoding="async" src="/assets/cloud-4.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom", transform: "scaleY(-1)" }} />
      </div>
      <div data-c-layer="" style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "300vh", transform: "translateY(100%)", filter: "grayscale(1) sepia(.15) brightness(.8)" }}>
        <img decoding="async" src="/assets/cloud-3.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom" }} />
        <div style={{ height: "calc(100vh + 4px)", margin: "-2px 0", background: "#d95535" }}></div>
        <img decoding="async" src="/assets/cloud-3.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom", transform: "scaleY(-1)" }} />
      </div>
      <div data-c-layer="" style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "300vh", transform: "translateY(100%)", filter: "grayscale(1) sepia(.15) brightness(1)" }}>
        <img decoding="async" src="/assets/cloud-2.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom" }} />
        <div style={{ height: "calc(100vh + 4px)", margin: "-2px 0", background: "#f99f51" }}></div>
        <img decoding="async" src="/assets/cloud-2.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom", transform: "scaleY(-1)" }} />
      </div>
      <div data-c-layer="" style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "300vh", transform: "translateY(100%)", filter: "grayscale(1) sepia(.12) brightness(1.18)" }}>
        <img decoding="async" src="/assets/cloud-1.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom" }} />
        <div style={{ position: "relative", height: "calc(100vh + 4px)", margin: "-2px 0", background: "#fec466", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", textAlign: "center", color: "#141312", padding: "0 20px" }}>
          <Sparkle data-c-spark="" style={{ width: "22px", height: "22px" }} />
          <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".34em" }}>{v.curtainKicker}</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(34px,6vw,96px)", lineHeight: "1", letterSpacing: ".02em" }}>{v.curtainLabel}</span>
        </div>
        <img decoding="async" src="/assets/cloud-1.webp" alt="" style={{ width: "100%", height: "100vh", objectFit: "cover", objectPosition: "center bottom", transform: "scaleY(-1)" }} />
      </div>
    </div>
  );
}
