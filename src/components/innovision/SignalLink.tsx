/* eslint-disable @next/next/no-img-element -- decorative layers are animated directly by GSAP */

/*
 * Ground station on the planet and a satellite in the sky, linked by travelling radio wavefronts
 * (Main Events slide). Everything is laid out in the planet box's own units (% of its side; the
 * planet's surface is the circle of radius 50 around 50,50), so the link stays attached to both
 * dishes at any screen size. Geometry comes from the trimmed artwork:
 *   receiver.webp  700x606: base anchor (46%, 98%), feed-horn tip (99%, 20.5%), horn aimed ~19° up-right
 *   satellite.webp 900x436: feed-horn tip (32.5%, 66.5%), where the waves start. The horn looks
 *     down-left along the satellite's own solar panel, so the satellite tips clockwise to swing the
 *     panel up off the link, and the waves are drawn over it with a paper halo for the short stretch
 *     where they still cross the panel.
 */

type Fit = { rW: number; sW: number; tilt: number; link: number; sink: number; satRot: number };

/** Landscape: the sky above the planet is ~36% of its size. Portrait: well over half, so everything grows. */
const WIDE: Fit = { rW: 18, sW: 26, tilt: -9, link: 16, sink: .6, satRot: 12 };
const TALL: Fit = { rW: 24, sW: 32, tilt: -20, link: 28, sink: .9, satRot: 12 };

const R_ANCHOR = [.46, .98], R_HORN = [.99, .205], R_AIM = 19;
const S_HORN = [.325, .665];
const VB_TOP = -40;                                  // the wave layer covers the box from 40% above it to 20% into it
const MONO = "grayscale(1) contrast(1.3) brightness(1.05)";

const rad = (d: number) => d * Math.PI / 180;
/** Rotates a point of the planet box about its centre, like a CSS rotate on a full-size layer. */
const turn = (x: number, y: number, deg: number) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), dx = x - 50, dy = y - 50;
  return [50 + dx * c - dy * s, 50 + dx * s + dy * c];
};
const pct = (n: number) => n.toFixed(3) + '%';
const U = (n: number) => +(n * 10).toFixed(2);      // planet-box % -> wave-layer viewBox units

function layout(f: Fit) {
  const rH = f.rW * 606 / 700, sH = f.sW * 436 / 900;
  // The station stands at the top of the planet; its whole layer then turns by tilt so it stays upright on the surface.
  const rLeft = 50 - R_ANCHOR[0] * f.rW, rTop = f.sink - R_ANCHOR[1] * rH;
  const [hx, hy] = turn(rLeft + R_HORN[0] * f.rW, rTop + R_HORN[1] * rH, f.tilt);
  // Tilting the station steepens its aim; the satellite's horn sits up that line.
  const elev = R_AIM - f.tilt;
  const sx = hx + f.link * Math.cos(rad(elev)), sy = hy - f.link * Math.sin(rad(elev));
  return {
    rLeft, rTop, sx, sy, elev, sLeft: sx - S_HORN[0] * f.sW, sTop: sy - S_HORN[1] * sH,
    ox: U(sx), oy: U(sy - VB_TOP), len: U(f.link),
  };
}

function Scene({ fit, accent, id, className }: { fit: Fit; accent: string; id: string; className: string }) {
  const g = layout(fit), len = g.len, origin = `${S_HORN[0] * 100}% ${S_HORN[1] * 100}%`;
  return (
    <div className={className} style={{ position: "absolute", inset: "0" }}>
      <div style={{ position: "absolute", inset: "0", transform: `rotate(${fit.tilt}deg)` }}>
        <img src="/assets/receiver.webp" alt="" style={{ position: "absolute", left: pct(g.rLeft), top: pct(g.rTop), width: pct(fit.rW), height: "auto", filter: `${MONO} drop-shadow(0 10px 14px rgba(20,19,18,.22))` }} />
      </div>

      {/* The satellite turns about its horn tip, so the waves always leave from the tip as it sways. */}
      <div style={{ position: "absolute", left: pct(g.sLeft), top: pct(g.sTop), width: pct(fit.sW), transformOrigin: origin, transform: `rotate(${fit.satRot}deg)` }}>
        <img data-link-sat="" src="/assets/satellite.webp" alt="" style={{ display: "block", width: "100%", height: "auto", transformOrigin: origin, filter: `${MONO} drop-shadow(0 18px 24px rgba(20,19,18,.18))` }} />
      </div>

      <svg data-s-link="" viewBox="0 0 1000 600" style={{ position: "absolute", left: "0", top: VB_TOP + "%", width: "100%", height: "60%", overflow: "visible" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#141312" stopOpacity=".16" />
            <stop offset="1" stopColor="#141312" stopOpacity=".03" />
          </linearGradient>
        </defs>
        {/* Local frame: origin on the satellite's horn tip, +x pointing down the link to the station's horn. */}
        <g transform={`translate(${g.ox} ${g.oy}) rotate(${180 - g.elev})`}>
          <path d={`M0 0L${len} ${-len * .09}L${len} ${len * .09}Z`} fill={`url(#${id})`} />
          {/* Dashes stream down the link; the paper halo keeps them visible where they cross the solar panel. */}
          <line data-link-beam="" x1="0" y1="0" x2={len} y2="0" stroke="#ECE8DF" strokeOpacity=".9" strokeWidth="4" strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <line data-link-beam="" x1="0" y1="0" x2={len} y2="0" stroke="#141312" strokeOpacity=".6" strokeWidth="1.4" strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {/* The transmitter: a ring answers each wave as it leaves the tip. */}
          <circle data-link-ring="" r="7" fill="none" stroke="#ECE8DF" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          <circle data-link-ring="" r="7" fill="none" stroke="#141312" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <circle r="2.6" fill="#141312" stroke="#ECE8DF" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {[0, 1, 2, 3].map((k) => (
            <g key={k} data-link-arc="" style={{ ["--len" as string]: len + "px", animationDelay: `${k * .65}s` }}>
              <path d="M-3 -9Q4 0 -3 9" fill="none" stroke="#ECE8DF" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d="M-3 -9Q4 0 -3 9" fill="none" stroke="#141312" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          <g transform={`translate(${len} 0)`}>
            <circle data-link-ring="" r="9" fill="none" stroke={accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <circle data-link-ring="" r="9" fill="none" stroke={accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" style={{ animationDelay: ".65s" }} />
            <circle r="3" fill={accent} style={{ animation: "iv-blink 1.3s steps(2) infinite" }} />
          </g>
        </g>
      </svg>

    </div>
  );
}

/**
 * Both fits are rendered and CSS shows the one for the screen's shape (globals.css, .uplink-*), so
 * the server markup is right before any script runs. The station and satellite turn with the
 * planet's entrance swing; the waves ([data-s-link]) fade in once it has settled.
 */
export default function SignalLink({ accent }: { accent: string }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
      <Scene fit={WIDE} accent={accent} id="iv-link-cone-w" className="uplink-wide" />
      <Scene fit={TALL} accent={accent} id="iv-link-cone-t" className="uplink-tall" />
    </div>
  );
}
