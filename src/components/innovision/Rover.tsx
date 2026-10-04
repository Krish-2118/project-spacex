/**
 * Flagship rover: a rocker-bogie rover that drives over the top of the planet on the Flagship Events
 * slide. Static SVG only; Innovision#rover drives every [data-rv-*] part from one ticker (wheels,
 * suspension, body pitch, antenna whip, dish, dust, head look-arounds and the sampling arm).
 */
export default function Rover() {
  return (
    <div data-rover-rig="" aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
      <div data-rover="" style={{ position: "absolute", left: "40.5%", top: "-13.25%", width: "20%" }}>
        <svg viewBox="0 0 320 224" style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}>
          <g data-rv-dust="">
            <circle cx="30" cy="214" r="0" fill="#ecebe6" stroke="#141312" strokeWidth="1.5" opacity="0" />
            <circle cx="30" cy="214" r="0" fill="#ecebe6" stroke="#141312" strokeWidth="1.5" opacity="0" />
            <circle cx="30" cy="214" r="0" fill="#ecebe6" stroke="#141312" strokeWidth="1.5" opacity="0" />
            <circle cx="30" cy="214" r="0" fill="#ecebe6" stroke="#141312" strokeWidth="1.5" opacity="0" />
          </g>
          <defs><linearGradient id="rv-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="oklch(0.84 0.1 70)" stopOpacity=".75" /><stop offset="1" stopColor="oklch(0.84 0.1 70)" stopOpacity="0" /></linearGradient></defs>
          <ellipse data-rv-shadow="" cx="164" cy="222" rx="132" ry="6" fill="#141312" opacity=".2" />
          <g data-rv-wpos="70 189" transform="translate(70 189)"><g data-rv-wheel=""><circle r="26" fill="#8f8f8b" stroke="#141312" strokeWidth="3" /><circle r="22.5" fill="none" stroke="#141312" strokeWidth="5" strokeDasharray="3 4.07" /><path d="M0-16V16M-13.9-8L13.9 8M-13.9 8L13.9-8" stroke="#3a3936" strokeWidth="2" /><circle r="6" fill="#6f6f6b" stroke="#141312" strokeWidth="2.5" /></g></g>
          <g data-rv-wpos="164 183" transform="translate(164 183)"><g data-rv-wheel=""><circle r="26" fill="#8f8f8b" stroke="#141312" strokeWidth="3" /><circle r="22.5" fill="none" stroke="#141312" strokeWidth="5" strokeDasharray="3 4.07" /><path d="M0-16V16M-13.9-8L13.9 8M-13.9 8L13.9-8" stroke="#3a3936" strokeWidth="2" /><circle r="6" fill="#6f6f6b" stroke="#141312" strokeWidth="2.5" /></g></g>
          <g data-rv-wpos="270 190" transform="translate(270 190)"><g data-rv-wheel=""><circle r="26" fill="#8f8f8b" stroke="#141312" strokeWidth="3" /><circle r="22.5" fill="none" stroke="#141312" strokeWidth="5" strokeDasharray="3 4.07" /><path d="M0-16V16M-13.9-8L13.9 8M-13.9 8L13.9-8" stroke="#3a3936" strokeWidth="2" /><circle r="6" fill="#6f6f6b" stroke="#141312" strokeWidth="2.5" /></g></g>
          <path data-rv-link="b" d="M70 189L116 153L164 183M116 153L188 125L248 143L270 190" fill="none" stroke="#5f5e5a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <g data-rv-body="">
            <g transform="rotate(24 88 104)">
              <rect x="34" y="94" width="56" height="22" rx="5" fill="#d4d4d0" stroke="#141312" strokeWidth="2.5" />
              <path d="M44 87V123M52 87V123M60 87V123M68 87V123M76 87V123" fill="none" stroke="#141312" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M44 88.5V121.5M52 88.5V121.5M60 88.5V121.5M68 88.5V121.5M76 88.5V121.5" fill="none" stroke="#efefec" strokeWidth="1.6" strokeLinecap="round" />
              <rect x="28" y="98" width="8" height="14" rx="2" fill="#9d9d99" stroke="#141312" strokeWidth="2.2" />
            </g>
            <path d="M118 85V68" fill="none" stroke="#141312" strokeWidth="4" />
            <g data-rv-dish=""><ellipse cx="118" cy="63" rx="21" ry="6.5" transform="rotate(-18 118 63)" fill="#f5f5f3" stroke="#141312" strokeWidth="2.5" />
            <path d="M118 63L127 50" fill="none" stroke="#141312" strokeWidth="2" />
            <circle cx="127" cy="49" r="2.6" fill="#141312" /></g>
            <g data-rv-whip="">
              <path d="M96 85L92 34" fill="none" stroke="#141312" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M93 37L116 43.5L93.8 50Z" stroke="#141312" strokeWidth="1.8" strokeLinejoin="round" style={{ fill: "oklch(0.56 0.13 32)" }} />
              <circle cx="92" cy="32" r="4" fill="#f5f5f3" stroke="#141312" strokeWidth="2" />
            </g>
            <rect x="226" y="26" width="9" height="62" rx="2" fill="#dcdcd8" stroke="#141312" strokeWidth="2.5" />
            <rect x="222.5" y="56" width="16" height="7" rx="1.5" fill="#f2f2ef" stroke="#141312" strokeWidth="2" />
            <g data-rv-head="">
              <path data-rv-beam="" d="M246 17L380 -26L380 66Z" fill="url(#rv-beam)" opacity="0" />
              <circle cx="230.5" cy="28" r="6" fill="#f2f2ef" stroke="#141312" strokeWidth="2.5" />
              <rect x="200" y="4" width="62" height="26" rx="5" fill="#f3f3f0" stroke="#141312" strokeWidth="2.5" />
              <path d="M201.5 21H260.5V25Q260.5 28.5 257 28.5H205Q201.5 28.5 201.5 25Z" fill="#c4c4c0" />
              <path d="M207 9H221M207 13H221" fill="none" stroke="#141312" strokeWidth="1.4" />
              <circle cx="210" cy="21.5" r="2.8" style={{ fill: "oklch(0.56 0.13 32)", animation: "iv-blink 1.6s steps(2) infinite" }} />
              <g data-rv-eyes="">
                <circle cx="236" cy="16.5" r="8.5" fill="#141312" />
                <circle cx="252.5" cy="16.5" r="6.5" fill="#141312" />
                <circle cx="238.6" cy="13.8" r="2.5" fill="#fff" />
                <circle cx="254.4" cy="14.4" r="1.9" fill="#fff" />
              </g>
            </g>
            <rect x="72" y="84" width="204" height="11" rx="2" fill="#f5f5f3" stroke="#141312" strokeWidth="2.5" />
            <path d="M84 95H266L274 106V128L266 136H92L84 128Z" fill="#e9e9e6" stroke="#141312" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M86 122H272.8V128L266 134.6H92.6L86 128Z" fill="#b9b9b5" />
            <path d="M96 134L104 122M104 134L112 122M112 134L120 122M120 134L128 122M128 134L136 122M136 134L144 122M144 134L152 122M152 134L160 122M160 134L168 122M168 134L176 122M176 134L184 122M184 134L192 122M192 134L200 122M200 134L208 122M208 134L216 122M216 134L224 122M224 134L232 122M232 134L240 122M240 134L248 122M248 134L256 122M256 134L264 122" fill="none" stroke="#141312" strokeWidth="1" opacity=".5" />
            <path d="M134 95V136M204 95V136M86 122H274" fill="none" stroke="#141312" strokeWidth="1.5" />
            <path d="M90 99.5H262" fill="none" stroke="#fff" strokeWidth="1.6" opacity=".85" />
            <path d="M216 104V116M222 104V116M228 104V116M234 104V116M240 104V116M246 104V116" fill="none" stroke="#141312" strokeWidth="1.6" />
            <rect x="146" y="102" width="46" height="13" rx="1.5" fill="none" stroke="#141312" strokeWidth="1.3" />
            <text x="169" y="111.6" textAnchor="middle" style={{ fontFamily: "var(--font-grotesk),sans-serif", fontSize: "8.5px", fontWeight: "700", letterSpacing: "1.2px", fill: "#141312" }}>IV·26</text>
            <circle cx="92" cy="104" r="1.6" fill="#141312" /><circle cx="127" cy="104" r="1.6" fill="#141312" /><circle cx="141" cy="104" r="1.6" fill="#141312" /><circle cx="197" cy="104" r="1.6" fill="#141312" /><circle cx="211" cy="104" r="1.6" fill="#141312" /><circle cx="260" cy="104" r="1.6" fill="#141312" />
            <g data-rv-arm=""><path d="M272 112L295 124L292 156" fill="none" stroke="#141312" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M272 112L295 124L292 156" fill="none" stroke="#d6d6d2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="272" cy="112" r="6" fill="#f2f2ef" stroke="#141312" strokeWidth="2.2" />
            <circle cx="295" cy="124" r="5.5" fill="#f2f2ef" stroke="#141312" strokeWidth="2.2" />
            <rect x="280" y="154" width="25" height="16" rx="3" fill="#e4e4e0" stroke="#141312" strokeWidth="2.5" />
            <path d="M286 159H299" fill="none" stroke="#141312" strokeWidth="1.4" />
            <path d="M292.5 170V181" fill="none" stroke="#141312" strokeWidth="3" strokeLinecap="round" />
            <g data-rv-spark="" opacity="0"><path d="M292.5 186l-7 5M292.5 186l7 5M292.5 186v9" fill="none" stroke="#141312" strokeWidth="2" strokeLinecap="round" /><circle cx="292.5" cy="184" r="3" style={{ fill: "oklch(0.84 0.1 70)" }} /></g></g>
          </g>
          <path data-rv-link="f" d="M58 196L104 160L152 190M104 160L176 132L236 150L258 197" fill="none" stroke="#141312" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path data-rv-link="f" d="M58 196L104 160L152 190M104 160L176 132L236 150L258 197" fill="none" stroke="#dadad6" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle data-rv-piv="r" cx="176" cy="132" r="8" fill="#f5f5f3" stroke="#141312" strokeWidth="2.5" /><circle data-rv-piv="r" cx="176" cy="132" r="2.5" fill="#141312" />
          <circle data-rv-piv="b" cx="104" cy="160" r="7" fill="#f5f5f3" stroke="#141312" strokeWidth="2.5" /><circle data-rv-piv="b" cx="104" cy="160" r="2.3" fill="#141312" />
          <circle data-rv-piv="m" cx="236" cy="150" r="5" fill="#f5f5f3" stroke="#141312" strokeWidth="2.2" />
          <g data-rv-wpos="58 196" transform="translate(58 196)"><g data-rv-wheel=""><circle r="26" fill="#efefec" stroke="#141312" strokeWidth="3" /><circle r="22.5" fill="none" stroke="#141312" strokeWidth="5" strokeDasharray="3 4.07" /><circle r="16.5" fill="#cfcfcb" stroke="#141312" strokeWidth="2" /><path d="M0-16.5V16.5M-14.3-8.25L14.3 8.25M-14.3 8.25L14.3-8.25" stroke="#141312" strokeWidth="2" /><circle r="6" fill="#f7f7f5" stroke="#141312" strokeWidth="2.5" /><circle r="2" fill="#141312" /></g></g>
          <g data-rv-wpos="152 190" transform="translate(152 190)"><g data-rv-wheel=""><circle r="26" fill="#efefec" stroke="#141312" strokeWidth="3" /><circle r="22.5" fill="none" stroke="#141312" strokeWidth="5" strokeDasharray="3 4.07" /><circle r="16.5" fill="#cfcfcb" stroke="#141312" strokeWidth="2" /><path d="M0-16.5V16.5M-14.3-8.25L14.3 8.25M-14.3 8.25L14.3-8.25" stroke="#141312" strokeWidth="2" /><circle r="6" fill="#f7f7f5" stroke="#141312" strokeWidth="2.5" /><circle r="2" fill="#141312" /></g></g>
          <g data-rv-wpos="258 197" transform="translate(258 197)"><g data-rv-wheel=""><circle r="26" fill="#efefec" stroke="#141312" strokeWidth="3" /><circle r="22.5" fill="none" stroke="#141312" strokeWidth="5" strokeDasharray="3 4.07" /><circle r="16.5" fill="#cfcfcb" stroke="#141312" strokeWidth="2" /><path d="M0-16.5V16.5M-14.3-8.25L14.3 8.25M-14.3 8.25L14.3-8.25" stroke="#141312" strokeWidth="2" /><circle r="6" fill="#f7f7f5" stroke="#141312" strokeWidth="2.5" /><circle r="2" fill="#141312" /></g></g>
        </svg>
      </div>
    </div>
  );
}
