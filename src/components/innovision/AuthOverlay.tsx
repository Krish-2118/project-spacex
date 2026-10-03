// @ts-nocheck
import type { V } from './types';
import { Sparkle } from './icons';

export default function AuthOverlay({ v }: { v: V }) {
  return (
  <div data-auth-root="" aria-hidden={v.authHidden} style={{ position: "fixed", inset: "0", zIndex: "62", visibility: "hidden", pointerEvents: "none" }}>
    <div data-rift-veil="" style={{ position: "absolute", inset: "0", background: "#070605", opacity: "0" }}></div>
    <section data-auth="" data-screen-label="Register" role="dialog" aria-modal="true" aria-label={v.authAria} onDragOver={v.noDrop} onDrop={v.noDrop} style={{ position: "absolute", inset: "0", overflow: "hidden", background: "#0c0b0a", color: "#ECE8DF" }}>
      <img src="assets/stars.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".3", pointerEvents: "none" }} />
      <canvas data-warp="" aria-hidden="true" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }}></canvas>
      <div data-a-planet-wrap="" aria-hidden="true" style={{ position: "absolute", right: "calc(min(92vh, 64vw) * -.3)", bottom: "calc(min(92vh, 64vw) * -.34)", width: "min(92vh, 64vw)", aspectRatio: "1", pointerEvents: "none" }}>
        <span style={{ position: "absolute", inset: "-16%", border: "1px solid rgba(236,232,223,.12)", borderRadius: "50%" }}></span>
        <span style={{ position: "absolute", inset: "-34%", border: "1px dashed rgba(236,232,223,.08)", borderRadius: "50%" }}></span>
        <div data-a-orbit="" style={{ position: "absolute", inset: "-16%" }}><span style={{ position: "absolute", left: "50%", top: "0", width: "10px", height: "10px", margin: "-5px 0 0 -5px", borderRadius: "50%", background: "oklch(0.8 0.12 85)" }}></span></div>
        <img data-a-planet="" src="assets/moon.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div data-auth-scroll="" data-noscroll="" style={{ position: "absolute", inset: "0", overflowX: "hidden", overflowY: "auto", scrollbarWidth: "none", overscrollBehavior: "contain" }}>
        <div data-a-ui="" style={{ position: "relative", minHeight: "100%", display: "flex", flexDirection: "column" }}>
          <div data-a-in="" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "clamp(14px,1.8vw,26px) clamp(16px,2.6vw,44px)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <svg viewBox="0 0 40 40" aria-hidden="true" style={{ width: "clamp(24px,2vw,32px)", height: "auto" }}><ellipse cx="20" cy="20" rx="18" ry="18" fill="none" stroke="currentColor" strokeWidth="4"></ellipse><ellipse cx="20" cy="22" rx="11" ry="7" fill="none" stroke="currentColor" strokeWidth="3.5"></ellipse></svg>
              <span style={{ fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(17px,1.6vw,24px)", letterSpacing: ".04em" }}>INNOVISION</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "clamp(16px,2.4vw,36px)" }}>
              {v.showSwitch ? (
                <span style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                  <span style={{ display: v.switchQD, color: "rgba(236,232,223,.72)" }}>{v.switchQ}</span>
                  <button type="button" onClick={v.switchMode} onMouseEnter={v.beep} style={{ padding: "6px 0 4px", border: "0", borderBottom: "1.5px solid oklch(0.8 0.12 85)", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "13px", letterSpacing: ".12em", color: "#ECE8DF" }}>{v.switchLbl}</button>
                </span>
              ) : null}
              <button type="button" onClick={v.closeAuthH} onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: "13px", letterSpacing: ".14em", color: "#ECE8DF" }}><span data-scr="">CLOSE</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1 1 11" fill="none" stroke="currentColor" strokeWidth="1.5"></path></svg></button>
            </div>
          </div>

          <div style={{ flex: "1", display: "grid", gridTemplateColumns: v.authCols, alignItems: "center", gap: "clamp(28px,6vw,120px)", width: "100%", maxWidth: "1360px", margin: "0 auto", padding: "clamp(8px,2vh,24px) clamp(16px,4vw,72px) clamp(36px,7vh,80px)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(24px,4.5vh,48px)", minWidth: "0" }}>
              <div data-a-in="">
                <h2 data-m-in="" style={{ margin: "0", fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(36px,5.2vw,88px)", lineHeight: ".98", letterSpacing: ".01em", textWrap: "balance" }}>{v.authTitle}</h2>
                <p data-m-in="" style={{ margin: "18px 0 0", maxWidth: "34ch", fontSize: "clamp(15px,1.2vw,18px)", lineHeight: "1.55", color: "rgba(236,232,223,.78)", textWrap: "pretty" }}>{v.authSub}</p>
              </div>
              <ol data-a-in="" aria-label="Registration progress" style={{ display: v.railD, flexDirection: "column", margin: "0", padding: "0", listStyle: "none" }}>
                {v.prog.map((p, pI) => (
                  <li key={pI} aria-current={p.cur} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", columnGap: "18px" }}>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <button data-rail-node="" type="button" onClick={p.go} disabled={p.lock} aria-label={p.aria} style={{ position: "relative", flex: "none", display: "grid", placeItems: "center", width: "28px", height: "28px", padding: "0", border: `1.5px solid ${p.bc}`, borderRadius: "50%", background: p.fill, color: "#141312", cursor: p.cursor, transition: "background-color .4s,border-color .4s" }}>
                        <svg viewBox="0 0 16 16" aria-hidden="true" style={{ width: "12px", height: "12px", opacity: p.chk, transition: "opacity .3s" }}><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4"></path></svg>
                        <span style={{ position: "absolute", inset: "6px", borderRadius: "50%", background: "oklch(0.8 0.12 85)", opacity: p.dot, transform: `scale(${p.dotS})`, transition: "opacity .4s,transform .5s cubic-bezier(.34,1.56,.64,1)" }}></span>
                      </button>
                      <span style={{ display: p.lineD, position: "relative", flex: "1", width: "1.5px", minHeight: "30px", margin: "6px 0", background: "rgba(236,232,223,.16)" }}><span style={{ position: "absolute", inset: "0", background: "oklch(0.8 0.12 85)", transform: `scaleY(${p.lineS})`, transformOrigin: "top", transition: "transform .8s cubic-bezier(.25,1,.1,1)" }}></span></span>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "0", padding: "4px 0 22px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: ".16em", color: p.c, transition: "color .4s" }}>{p.label}</span>
                      <span style={{ fontSize: "14px", lineHeight: "1.4", color: "rgba(236,232,223,.62)", overflowWrap: "anywhere" }}>{p.note}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <ol data-a-in="" aria-label="Registration progress" style={{ display: v.hprogD, gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "6px", margin: "0", padding: "0", listStyle: "none" }}>
                {v.prog.map((p, pI) => (
                  <li key={pI} aria-current={p.cur} style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", fontWeight: "700", letterSpacing: ".12em", color: p.c }}>
                    <span style={{ position: "relative", height: "3px", background: "rgba(236,232,223,.16)" }}><span style={{ position: "absolute", inset: "0", background: "oklch(0.8 0.12 85)", transform: `scaleX(${p.segS})`, transformOrigin: "left", transition: "transform .7s cubic-bezier(.25,1,.1,1)" }}></span></span>
                    <span>{p.short}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div data-a-in="" style={{ position: "relative", width: "100%", maxWidth: "540px", justifySelf: "end" }}>
              <div style={{ position: "relative", padding: "1px", background: "rgba(236,232,223,.22)", clipPath: "polygon(20px 0,100% 0,100% calc(100% - 20px),calc(100% - 20px) 100%,0 100%,0 20px)" }}>
                <div style={{ position: "relative", padding: "clamp(22px,3vw,40px)", background: "rgba(16,15,14,.9)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", clipPath: "polygon(19.5px 0,100% 0,100% calc(100% - 19.5px),calc(100% - 19.5px) 100%,0 100%,0 19.5px)" }}>
                  <form data-auth-form="" noValidate={v.true} onSubmit={v.authSubmit} onInput={v.clearErr} style={{ display: "flex", flexDirection: "column" }}>

                    <div style={{ display: v.d.s0, flexDirection: "column", gap: "20px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>Your details</h3>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>FULL NAME</span>
<input name="name" autoComplete="name" placeholder="As on your college ID" aria-invalid={v.inv.name} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.name}` }} style-focus="border-color:oklch(0.8 0.12 85);background:rgba(236,232,223,.08)" />
{v.err.name ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.name}</span>) : null}
</label>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>COLLEGE NAME</span>
<input name="college" autoComplete="organization" placeholder="Full name of your institute" aria-invalid={v.inv.college} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.college}` }} style-focus="border-color:oklch(0.8 0.12 85);background:rgba(236,232,223,.08)" />
{v.err.college ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.college}</span>) : null}
</label>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>EMAIL</span>
<input name="email" type="email" autoComplete="email" placeholder="you@college.edu" aria-invalid={v.inv.email} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.email}` }} style-focus="border-color:oklch(0.8 0.12 85);background:rgba(236,232,223,.08)" />
<span style={{ fontSize: "13px", lineHeight: "1.4", color: "rgba(236,232,223,.62)" }}>Your registration ID is sent here.</span>
{v.err.email ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.email}</span>) : null}
</label>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>PHONE</span>
<span style={{ display: "flex", gap: "8px" }}><span style={{ display: "flex", alignItems: "center", padding: "0 14px", border: "1.5px solid rgba(236,232,223,.28)", fontSize: "16px", fontWeight: "500" }}>+91</span><input name="phone" type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="98765 43210" aria-invalid={v.inv.phone} style={{ flex: "1", minWidth: "0", height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.phone}` }} style-focus="border-color:oklch(0.8 0.12 85);background:rgba(236,232,223,.08)" /></span>
{v.err.phone ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.phone}</span>) : null}
</label>
                    </div>

                    <div style={{ display: v.d.s1, flexDirection: "column", gap: "16px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>College ID card</h3>
                      <p data-s-in="" style={{ margin: "0 0 4px", fontSize: "16px", lineHeight: "1.55", color: "rgba(236,232,223,.78)", textWrap: "pretty" }}>Upload a clear photo of the front of your ID. We match it with you at the gate.</p>
                      
<label data-s-in="" onDragEnter={v.upId.over} onDragOver={v.upId.over} onDragLeave={v.upId.leave} onDrop={v.upId.drop} style={{ position: "relative", display: "block", aspectRatio: "1.586", border: `1.5px dashed ${v.upId.bc}`, background: v.upId.bg, overflow: "hidden", cursor: "pointer", transition: "border-color .3s,background-color .3s" }} style-hover="border-color:oklch(0.8 0.12 85)">
<span style={{ display: v.upId.emptyD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "20px", textAlign: "center" }}>
<span style={{ display: "grid", placeItems: "center", width: "52px", height: "52px", border: "1.5px solid rgba(236,232,223,.4)", borderRadius: "50%", color: "oklch(0.8 0.12 85)" }}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "22px", height: "22px" }}><path d="M12 15V4M7 9l5-5 5 5M4 14v6h16v-6" fill="none" stroke="currentColor" strokeWidth="1.6"></path></svg></span>
<span style={{ fontSize: "16px", fontWeight: "500" }}>{v.upId.prompt}</span>
<span style={{ fontSize: "13px", color: "rgba(236,232,223,.62)" }}>JPG, PNG or PDF up to 5 MB</span>
</span>
<span style={{ display: v.upId.prevD, position: "absolute", inset: "0", background: "#0c0b0a" }}>
{v.upId.hasImg ? (<img src={v.upId.url} alt="Your college ID" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : null}
<span style={{ display: v.upId.pdfD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", background: "rgba(236,232,223,.05)" }}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "40px", height: "40px", color: "oklch(0.8 0.12 85)" }}><path d="M6 2h9l5 5v15H6zM15 2v5h5" fill="none" stroke="currentColor" strokeWidth="1.4"></path></svg><span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: ".2em" }}>PDF</span></span>
<span style={{ position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none" }}><span data-scan="id" style={{ position: "absolute", inset: "0", opacity: "0" }}><span style={{ position: "absolute", left: "0", right: "0", top: "-64px", height: "64px", background: "linear-gradient(rgba(220,183,106,0),rgba(220,183,106,.3))" }}></span><span style={{ position: "absolute", left: "0", right: "0", top: "0", height: "2px", background: "#F3DFA8" }}></span></span></span>
<span style={{ display: v.upId.busyD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "rgba(12,11,10,.66)" }}>
<span data-up-pct="id" style={{ fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "34px", lineHeight: "1" }}>0%</span>
<span style={{ position: "relative", width: "56%", height: "2px", background: "rgba(236,232,223,.2)" }}><span data-up-bar="id" style={{ position: "absolute", inset: "0", background: "oklch(0.8 0.12 85)", transform: "scaleX(0)", transformOrigin: "left" }}></span></span>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".22em" }}>UPLOADING</span>
</span>
</span>
<input type="file" name="idfile" accept="image/*,application/pdf" aria-label="Upload college ID card" onChange={v.upId.pick} style={{ position: "absolute", inset: "0", zIndex: "2", width: "100%", height: "100%", opacity: "0", cursor: "pointer" }} />
</label>
<div data-s-in="" style={{ display: v.upId.rowD, alignItems: "center", justifyContent: "space-between", gap: "10px 16px", flexWrap: "wrap" }}>
<span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0", flex: "1" }}>
<svg viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", width: "16px", height: "16px", color: "oklch(0.8 0.12 85)" }}><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
<span style={{ minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "15px" }}>{v.upId.name}</span>
<span style={{ flex: "none", fontSize: "13px", color: "rgba(236,232,223,.62)" }}>{v.upId.size}</span>
</span>
<span style={{ display: "flex", gap: "18px" }}>
<button type="button" onClick={v.upId.replace} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", textDecoration: "underline", textUnderlineOffset: "4px" }} style-hover="color:oklch(0.8 0.12 85)">REPLACE</button>
<button type="button" onClick={v.upId.remove} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", textDecoration: "underline", textUnderlineOffset: "4px" }} style-hover="color:oklch(0.8 0.12 85)">REMOVE</button>
</span>
</div>
{v.err.idfile ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.idfile}</span>) : null}
                    </div>

                    <div style={{ display: v.d.s2, flexDirection: "column", gap: "22px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>Pay the fee</h3>
                      <div data-s-in="" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: "28px", alignItems: "center" }}>
                        <div style={{ position: "relative", width: "100%", maxWidth: "240px", justifySelf: "center", aspectRatio: "1", padding: "12px", background: "#ECE8DF" }}>
                          <image-slot id="upi-qr" shape="rect" fit="contain" placeholder="Drop your UPI QR code" style={{ display: "block", width: "100%", height: "100%" }}></image-slot>
                          <span style={{ position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none" }}><span data-scan="qr" style={{ position: "absolute", inset: "0", opacity: "0" }}><span style={{ position: "absolute", left: "0", right: "0", top: "-64px", height: "64px", background: "linear-gradient(rgba(220,183,106,0),rgba(220,183,106,.3))" }}></span><span style={{ position: "absolute", left: "0", right: "0", top: "0", height: "2px", background: "#F3DFA8" }}></span></span></span>
                          <span style={{ position: "absolute", left: "-9px", top: "-9px", borderLeftWidth: "2px", borderTopWidth: "2px", width: "22px", height: "22px", borderColor: "oklch(0.8 0.12 85)", borderStyle: "solid", borderWidth: "0" }}></span>
                          <span style={{ position: "absolute", right: "-9px", top: "-9px", borderRightWidth: "2px", borderTopWidth: "2px", width: "22px", height: "22px", borderColor: "oklch(0.8 0.12 85)", borderStyle: "solid", borderWidth: "0" }}></span>
                          <span style={{ position: "absolute", left: "-9px", bottom: "-9px", borderLeftWidth: "2px", borderBottomWidth: "2px", width: "22px", height: "22px", borderColor: "oklch(0.8 0.12 85)", borderStyle: "solid", borderWidth: "0" }}></span>
                          <span style={{ position: "absolute", right: "-9px", bottom: "-9px", borderRightWidth: "2px", borderBottomWidth: "2px", width: "22px", height: "22px", borderColor: "oklch(0.8 0.12 85)", borderStyle: "solid", borderWidth: "0" }}></span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>AMOUNT</span>
                            <span style={{ fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(36px,3.4vw,48px)", lineHeight: "1" }}>₹{v.fee}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>UPI ID</span>
                            <span style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "17px", fontWeight: "500", overflowWrap: "anywhere" }}>{v.upi}</span>
                              <button type="button" onClick={v.copyUpi} style={{ padding: "7px 12px", border: "1.5px solid rgba(236,232,223,.5)", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", transition: "border-color .3s,color .3s" }} style-hover="border-color:oklch(0.8 0.12 85);color:oklch(0.8 0.12 85)">{v.copyLbl}</button>
                            </span>
                          </div>
                          <a href={v.upiLink} style={{ display: v.upiAppD, alignItems: "center", justifyContent: "center", minHeight: "50px", padding: "0 20px", border: "1.5px solid oklch(0.8 0.12 85)", textDecoration: "none", fontWeight: "700", fontSize: "13px", letterSpacing: ".12em", color: "oklch(0.8 0.12 85)" }}>OPEN UPI APP</a>
                        </div>
                      </div>
                      <ol data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "0", padding: "18px 0 0", borderTop: "1px solid rgba(236,232,223,.14)", listStyle: "none", fontSize: "15px", lineHeight: "1.5", color: "rgba(236,232,223,.82)" }}>
                        <li style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: "10px" }}><span style={{ fontWeight: "700", color: "oklch(0.8 0.12 85)" }}>1</span><span>Scan the code with any UPI app.</span></li>
                        <li style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: "10px" }}><span style={{ fontWeight: "700", color: "oklch(0.8 0.12 85)" }}>2</span><span>Pay exactly ₹{v.fee}.</span></li>
                        <li style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: "10px" }}><span style={{ fontWeight: "700", color: "oklch(0.8 0.12 85)" }}>3</span><span>Screenshot the success screen. You'll upload it next.</span></li>
                      </ol>
                    </div>

                    <div style={{ display: v.d.s3, flexDirection: "column", gap: "22px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>Confirm payment</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <span data-s-in="" style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>PAYMENT SCREENSHOT</span>
                        
<label data-s-in="" onDragEnter={v.upPay.over} onDragOver={v.upPay.over} onDragLeave={v.upPay.leave} onDrop={v.upPay.drop} style={{ position: "relative", display: "block", aspectRatio: "16 / 9", border: `1.5px dashed ${v.upPay.bc}`, background: v.upPay.bg, overflow: "hidden", cursor: "pointer", transition: "border-color .3s,background-color .3s" }} style-hover="border-color:oklch(0.8 0.12 85)">
<span style={{ display: v.upPay.emptyD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "20px", textAlign: "center" }}>
<span style={{ display: "grid", placeItems: "center", width: "52px", height: "52px", border: "1.5px solid rgba(236,232,223,.4)", borderRadius: "50%", color: "oklch(0.8 0.12 85)" }}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "22px", height: "22px" }}><path d="M12 15V4M7 9l5-5 5 5M4 14v6h16v-6" fill="none" stroke="currentColor" strokeWidth="1.6"></path></svg></span>
<span style={{ fontSize: "16px", fontWeight: "500" }}>{v.upPay.prompt}</span>
<span style={{ fontSize: "13px", color: "rgba(236,232,223,.62)" }}>JPG or PNG up to 5 MB</span>
</span>
<span style={{ display: v.upPay.prevD, position: "absolute", inset: "0", background: "#0c0b0a" }}>
{v.upPay.hasImg ? (<img src={v.upPay.url} alt="Your payment screenshot" style={{ width: "100%", height: "100%", objectFit: "contain" }} />) : null}
<span style={{ display: v.upPay.pdfD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", background: "rgba(236,232,223,.05)" }}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "40px", height: "40px", color: "oklch(0.8 0.12 85)" }}><path d="M6 2h9l5 5v15H6zM15 2v5h5" fill="none" stroke="currentColor" strokeWidth="1.4"></path></svg><span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: ".2em" }}>PDF</span></span>
<span style={{ position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none" }}><span data-scan="pay" style={{ position: "absolute", inset: "0", opacity: "0" }}><span style={{ position: "absolute", left: "0", right: "0", top: "-64px", height: "64px", background: "linear-gradient(rgba(220,183,106,0),rgba(220,183,106,.3))" }}></span><span style={{ position: "absolute", left: "0", right: "0", top: "0", height: "2px", background: "#F3DFA8" }}></span></span></span>
<span style={{ display: v.upPay.busyD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "rgba(12,11,10,.66)" }}>
<span data-up-pct="pay" style={{ fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "34px", lineHeight: "1" }}>0%</span>
<span style={{ position: "relative", width: "56%", height: "2px", background: "rgba(236,232,223,.2)" }}><span data-up-bar="pay" style={{ position: "absolute", inset: "0", background: "oklch(0.8 0.12 85)", transform: "scaleX(0)", transformOrigin: "left" }}></span></span>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".22em" }}>UPLOADING</span>
</span>
</span>
<input type="file" name="payfile" accept="image/*" aria-label="Upload payment screenshot" onChange={v.upPay.pick} style={{ position: "absolute", inset: "0", zIndex: "2", width: "100%", height: "100%", opacity: "0", cursor: "pointer" }} />
</label>
<div data-s-in="" style={{ display: v.upPay.rowD, alignItems: "center", justifyContent: "space-between", gap: "10px 16px", flexWrap: "wrap" }}>
<span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0", flex: "1" }}>
<svg viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", width: "16px", height: "16px", color: "oklch(0.8 0.12 85)" }}><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
<span style={{ minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "15px" }}>{v.upPay.name}</span>
<span style={{ flex: "none", fontSize: "13px", color: "rgba(236,232,223,.62)" }}>{v.upPay.size}</span>
</span>
<span style={{ display: "flex", gap: "18px" }}>
<button type="button" onClick={v.upPay.replace} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", textDecoration: "underline", textUnderlineOffset: "4px" }} style-hover="color:oklch(0.8 0.12 85)">REPLACE</button>
<button type="button" onClick={v.upPay.remove} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", textDecoration: "underline", textUnderlineOffset: "4px" }} style-hover="color:oklch(0.8 0.12 85)">REMOVE</button>
</span>
</div>
{v.err.payfile ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.payfile}</span>) : null}
                      </div>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>UPI TRANSACTION ID (UTR)</span>
<input name="utr" inputMode="numeric" autoComplete="off" maxLength="16" placeholder="12-digit number" aria-invalid={v.inv.utr} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.utr}`, letterSpacing: ".08em" }} style-focus="border-color:oklch(0.8 0.12 85);background:rgba(236,232,223,.08)" />
<span style={{ fontSize: "13px", lineHeight: "1.4", color: "rgba(236,232,223,.62)" }}>Find it under payment details in your UPI app.</span>
{v.err.utr ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.utr}</span>) : null}
</label>
                    </div>

                    <div style={{ display: v.d.login, flexDirection: "column", gap: "20px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>Log in</h3>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>EMAIL</span>
<input name="lemail" type="email" autoComplete="email" placeholder="you@college.edu" aria-invalid={v.inv.lemail} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.lemail}` }} style-focus="border-color:oklch(0.8 0.12 85);background:rgba(236,232,223,.08)" />
{v.err.lemail ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.lemail}</span>) : null}
</label>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>REGISTRATION ID</span>
<input name="lid" autoComplete="off" placeholder="IV26-0000" aria-invalid={v.inv.lid} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.lid}`, letterSpacing: ".06em", textTransform: "uppercase" }} style-focus="border-color:oklch(0.8 0.12 85);background:rgba(236,232,223,.08)" />
<span style={{ fontSize: "13px", lineHeight: "1.4", color: "rgba(236,232,223,.62)" }}>It's in your confirmation email.</span>
{v.err.lid ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.lid}</span>) : null}
</label>
                    </div>

                    <div style={{ display: v.d.pass, flexDirection: "column", gap: "22px" }}>
                      <div data-pass-wrap="">
                        <div style={{ position: "relative", overflow: "hidden", color: "#141312", background: "#ECE8DF", clipPath: "polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px)" }}>
                          <img src="assets/planet-yellow.webp" alt="" style={{ position: "absolute", right: "-58px", top: "-58px", width: "140px", height: "auto", pointerEvents: "none" }} />
                          <div style={{ position: "relative", padding: "26px 26px 22px" }}>
                            <p style={{ margin: "0", fontSize: "12px", fontWeight: "700", letterSpacing: ".26em", color: "#7a5c20" }}>BOARDING PASS</p>
                            <p style={{ margin: "24px 0 6px", fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "#5c574f" }}>PASSENGER</p>
                            <p style={{ margin: "0", maxWidth: "62%", fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "clamp(26px,2.6vw,34px)", lineHeight: "1.05", overflowWrap: "anywhere" }}>{v.passName}</p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "18px 16px", marginTop: "24px" }}>
                              <div style={{ display: v.passCollegeD, gridColumn: "1 / -1" }}><p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "#5c574f" }}>COLLEGE</p><p style={{ margin: "0", fontSize: "16px", lineHeight: "1.4" }}>{v.passCollege}</p></div>
                              <div><p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "#5c574f" }}>GATE</p><p style={{ margin: "0", fontSize: "16px", lineHeight: "1.4" }}>NIT Rourkela</p></div>
                              <div><p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "#5c574f" }}>FEST</p><p style={{ margin: "0", fontSize: "16px", lineHeight: "1.4" }}>Innovision 2026</p></div>
                            </div>
                          </div>
                          <div style={{ position: "relative", margin: "0 18px", borderTop: "1.5px dashed rgba(20,19,18,.3)" }}></div>
                          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "end", gap: "14px 20px", padding: "18px 26px 24px" }}>
                            <div><p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "#5c574f" }}>REGISTRATION ID</p><p style={{ margin: "0", fontFamily: "Cinzel,serif", fontWeight: "900", fontSize: "26px", letterSpacing: ".04em" }}>{v.passId}</p></div>
                            <span style={{ padding: "7px 10px", border: "1.5px solid #141312", fontSize: "11px", fontWeight: "700", letterSpacing: ".14em" }}>{v.passStatus}</span>
                          </div>
                          <span style={{ position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none" }}><span data-scan="pass" style={{ position: "absolute", inset: "0", opacity: "0" }}><span style={{ position: "absolute", left: "0", right: "0", top: "-64px", height: "64px", background: "linear-gradient(rgba(220,183,106,0),rgba(220,183,106,.3))" }}></span><span style={{ position: "absolute", left: "0", right: "0", top: "0", height: "2px", background: "#F3DFA8" }}></span></span></span>
                        </div>
                      </div>
                      <p data-s-in="" style={{ margin: "0", fontSize: "15px", lineHeight: "1.55", color: "rgba(236,232,223,.78)", textWrap: "pretty", overflowWrap: "anywhere" }}>{v.passNote}</p>
                      <div data-s-in="" style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        <a href="#/worlds/takeoff" onClick={v.exploreFromPass} onMouseEnter={v.hover} style={{ flex: "1", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "58px", padding: "0 28px", textDecoration: "none", fontWeight: "700", fontSize: "15px", letterSpacing: ".08em", whiteSpace: "nowrap", color: "#141312", background: "#ECE8DF", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s" }} style-hover="background:oklch(0.8 0.12 85)"><span data-scr="">EXPLORE THE WORLDS</span></a>
                        <button type="button" onClick={v.closeAuthH} onMouseEnter={v.hover} style={{ position: "relative", isolation: "isolate", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "58px", padding: "0 26px", border: "0", cursor: "pointer", fontWeight: "700", fontSize: "14px", letterSpacing: ".08em", color: "#ECE8DF", background: "rgba(236,232,223,.7)", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }} style-active="transform:scale(.98)"><span style={{ position: "absolute", inset: "1.5px", zIndex: "-1", background: "#100f0e", clipPath: "polygon(11.4px 0,100% 0,100% calc(100% - 11.4px),calc(100% - 11.4px) 100%,0 100%,0 11.4px)" }}></span><span data-scr="">DONE</span></button>
                      </div>
                    </div>

                    <div data-auth-act="" style={{ display: v.d.act, alignItems: "stretch", gap: "12px", marginTop: "32px" }}>
                      {v.canBack ? (
                        <button type="button" onClick={v.stepBack} onMouseEnter={v.hover} style={{ position: "relative", isolation: "isolate", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "58px", padding: "0 26px", border: "0", cursor: "pointer", fontWeight: "700", fontSize: "14px", letterSpacing: ".08em", color: "#ECE8DF", background: "rgba(236,232,223,.7)", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }} style-active="transform:scale(.98)"><span style={{ position: "absolute", inset: "1.5px", zIndex: "-1", background: "#100f0e", clipPath: "polygon(11.4px 0,100% 0,100% calc(100% - 11.4px),calc(100% - 11.4px) 100%,0 100%,0 11.4px)" }}></span><span data-scr="">BACK</span></button>
                      ) : null}
                      <button type="submit" disabled={v.busy} onMouseEnter={v.beep} style={{ flex: "1", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "12px", minHeight: "58px", padding: "0 28px", border: "0", cursor: "pointer", fontWeight: "700", fontSize: "15px", letterSpacing: ".08em", whiteSpace: "nowrap", color: "#141312", background: "#ECE8DF", opacity: v.busyO, clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)", transition: "background-color .4s,opacity .3s" }} style-hover="background:oklch(0.8 0.12 85)" style-active="transform:scale(.98)"><span>{v.submitLbl}</span><svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true"><path d="M11 1l4 4-4 4M15 5H0" fill="none" stroke="currentColor" strokeWidth="1.5"></path></svg></button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  );
}

