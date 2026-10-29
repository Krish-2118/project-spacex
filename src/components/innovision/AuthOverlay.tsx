/* eslint-disable @typescript-eslint/ban-ts-comment -- view-model is untyped dynamic GSAP view */
// @ts-nocheck
"use client";
/* eslint-disable @next/next/no-img-element -- decorative/user-uploaded images not suited for next/image */
import React, { useRef, useState } from 'react';
import { useDialogFocus } from './useDialogFocus';
import type { V } from './types';
import { Logo } from './icons';
import EntryPassCard from './EntryPassCard';
import SeatCounter from './SeatCounter';
import styles from './AuthOverlay.module.css';
import { isIterSoaCollege, isIterSoaEmail, ITER_SOA_ERROR_MESSAGE } from '@/lib/validation';

/* ── Payment QR lightbox state lives here, outside JSX ── */

export default function AuthOverlay({ v }: { v: V }) {
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(v.authHidden === 'false', dialog, v.closeAuthH);
  const [userCollege, setUserCollege] = useState<string | null>(null);
  const collegeValue = userCollege !== null ? userCollege : (v.regVals?.college || '');
  const isIterSoa = isIterSoaCollege(collegeValue) || isIterSoaEmail(v.regVals?.email);
  const [payQrOpen, setPayQrOpen] = useState(false);
  return (
    <>
      <div data-auth-root="" aria-hidden={v.authHidden} style={{ position: "fixed", inset: "0", zIndex: "62", visibility: "hidden", pointerEvents: "none" }}>
    <div data-rift-veil="" style={{ position: "absolute", inset: "0", background: "#070605", opacity: "0" }}></div>
    <section ref={dialog} tabIndex={-1} data-auth="" data-screen-label="Register" role="dialog" aria-modal="true" aria-label={v.authAria} onDragOver={v.noDrop} onDrop={v.noDrop} style={{ position: "absolute", inset: "0", overflow: "hidden", background: "#0c0b0a", color: "#ECE8DF" }}>
      <img decoding="async" src="assets/starfield.svg" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", opacity: ".3", pointerEvents: "none" }} />
      <canvas data-warp="" aria-hidden="true" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }}></canvas>
      <div data-a-planet-wrap="" aria-hidden="true" style={{ position: "absolute", right: "calc(min(92vh, 64vw) * -.3)", bottom: "calc(min(92vh, 64vw) * -.34)", width: "min(92vh, 64vw)", aspectRatio: "1", pointerEvents: "none" }}>
        <span style={{ position: "absolute", inset: "-16%", border: "1px solid rgba(236,232,223,.12)", borderRadius: "50%" }}></span>
        <span style={{ position: "absolute", inset: "-34%", border: "1px dashed rgba(236,232,223,.08)", borderRadius: "50%" }}></span>
        <div data-a-orbit="" style={{ position: "absolute", inset: "-16%" }}><span style={{ position: "absolute", left: "50%", top: "0", width: "10px", height: "10px", margin: "-5px 0 0 -5px", borderRadius: "50%", background: "oklch(0.78 0.075 85)" }}></span></div>
        <img decoding="async" data-a-planet="" src="assets/planet-crescent.webp" alt="" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div data-auth-scroll="" data-noscroll="" style={{ position: "absolute", inset: "0", overflowX: "hidden", overflowY: "auto", scrollbarWidth: "none", overscrollBehavior: "contain" }}>
        <div data-a-ui="" style={{ position: "relative", minHeight: "100%", display: "flex", flexDirection: "column" }}>
          <div data-a-in="" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "clamp(14px,1.8vw,26px) clamp(16px,2.6vw,44px)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <Logo style={{ width: "clamp(24px,2vw,32px)" }} />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(17px,1.6vw,24px)", letterSpacing: ".04em" }}>INNOVISION</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "clamp(16px,2.4vw,36px)" }}>
              {v.showSwitch ? (
                <span style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                  <span style={{ display: v.switchQD, color: "rgba(236,232,223,.72)" }}>{v.switchQ}</span>
                  <button type="button" onClick={v.switchMode} style={{ padding: "6px 0 4px", border: "0", borderBottom: "1.5px solid oklch(0.78 0.075 85)", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "13px", letterSpacing: ".12em", color: "#ECE8DF" }}>{v.switchLbl}</button>
                </span>
              ) : null}
              <button type="button" onClick={v.closeAuthH} onMouseEnter={v.hover} style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "500", fontSize: "13px", letterSpacing: ".14em", color: "#ECE8DF" }}><span data-scr="">CLOSE</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1 1 11" fill="none" stroke="currentColor" strokeWidth="1.5"></path></svg></button>
            </div>
          </div>

          {v.isPreviewUser && <p className={styles.previewNote}>Registration preview · No payment or registration is sent to the server.</p>}
          <div className={styles.layout} data-approved={v.d.pass === "flex" ? "true" : undefined} data-pass-view={v.d.pass === "flex" ? "true" : undefined}>
            <div className={styles.intro} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div data-a-in="">
                <h2 data-m-in="" style={{ margin: "0", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "var(--auth-title-size)", lineHeight: ".98", letterSpacing: ".01em", textWrap: "balance" }}>{v.authTitle}</h2>
                <p data-m-in="" style={{ margin: "18px 0 0", maxWidth: "34ch", fontSize: "clamp(15px,1.2vw,18px)", lineHeight: "1.55", color: "rgba(236,232,223,.78)", textWrap: "pretty" }}>{v.authSub}</p>
                {v.showSeats ? <SeatCounter /> : null}
              </div>
              <ol data-a-in="" aria-label="Registration progress" style={{ display: "none", flexDirection: "column", margin: "0", padding: "0", listStyle: "none" }}>
                {v.prog.map((p, pI) => (
                  <li key={pI} aria-current={p.cur} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", columnGap: "18px" }}>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <button data-rail-node="" type="button" onClick={p.go} disabled={p.lock} aria-label={p.aria} style={{ position: "relative", flex: "none", display: "grid", placeItems: "center", width: "28px", height: "28px", padding: "0", border: `1.5px solid ${p.bc}`, borderRadius: "50%", background: p.fill, color: "#141312", cursor: p.cursor, transition: "background-color .4s,border-color .4s" }}>
                        <svg viewBox="0 0 16 16" aria-hidden="true" style={{ width: "12px", height: "12px", opacity: p.chk, transition: "opacity .3s" }}><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4"></path></svg>
                        <span style={{ position: "absolute", inset: "6px", borderRadius: "50%", background: "oklch(0.78 0.075 85)", opacity: p.dot, transform: `scale(${p.dotS})`, transition: "opacity .4s,transform .5s cubic-bezier(.34,1.56,.64,1)" }}></span>
                      </button>
                      <span style={{ display: p.lineD, position: "relative", flex: "1", width: "1.5px", minHeight: "30px", margin: "6px 0", background: "rgba(236,232,223,.16)" }}><span style={{ position: "absolute", inset: "0", background: "oklch(0.78 0.075 85)", transform: `scaleY(${p.lineS})`, transformOrigin: "top", transition: "transform .8s cubic-bezier(.25,1,.1,1)" }}></span></span>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "0", padding: "4px 0 22px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: ".16em", color: p.c, transition: "color .4s" }}>{p.label}</span>
                      <span style={{ fontSize: "14px", lineHeight: "1.4", color: "rgba(236,232,223,.62)", overflowWrap: "anywhere" }}>{p.note}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <ol data-a-in="" aria-label="Registration progress" style={{ display: v.railD === "flex" || v.hprogD === "grid" ? "grid" : "none", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "6px", margin: "0", padding: "0", listStyle: "none" }}>
                {v.prog.map((p, pI) => (
                  <li key={pI} aria-current={p.cur} style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", fontWeight: "700", letterSpacing: ".12em", color: p.c }}>
                    <span style={{ position: "relative", height: "3px", background: "rgba(236,232,223,.16)" }}><span style={{ position: "absolute", inset: "0", background: "oklch(0.78 0.075 85)", transform: `scaleX(${p.segS})`, transformOrigin: "left", transition: "transform .7s cubic-bezier(.25,1,.1,1)" }}></span></span>
                    <span>{p.short}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div data-a-in="" className={styles.panel} data-pass-panel={v.d.pass === "flex" ? "true" : undefined}>
              <div className={styles.panelBorder} data-pass-border={v.d.pass === "flex" ? "true" : undefined} style={{ position: "relative", padding: "1px", background: "rgba(236,232,223,.22)", clipPath: "polygon(20px 0,100% 0,100% calc(100% - 20px),calc(100% - 20px) 100%,0 100%,0 20px)" }}>
                <div className={styles.panelBody} data-pass-panel={v.d.pass === "flex"}>
                  <form data-auth-form="" noValidate={v.true} onSubmit={v.authSubmit} onInput={v.clearErr} style={{ display: "flex", flexDirection: "column" }}>

                    <div style={{ display: v.d.s0, flexDirection: "column", gap: "20px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>Your details</h3>
                      <p data-s-in="" role="note" style={{ display: "flex", alignItems: "flex-start", gap: "10px", margin: "-4px 0 0", padding: "12px 14px", border: "1px solid rgba(239,68,68,.55)", background: "rgba(239,68,68,.1)", fontSize: "14px", lineHeight: "1.45", color: "#fca5a5", overflowWrap: "anywhere" }}>
                        <svg viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", width: "16px", height: "16px", marginTop: "1px" }}><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5"></circle><path d="M3.5 12.5l9-9" stroke="currentColor" strokeWidth="1.5"></path></svg>
                        <span>Students of ITER / SOA (Siksha &lsquo;O&rsquo; Anusandhan) are not allowed to register.</span>
                      </p>
                      {v.gNote ? (
                        <p data-s-in="" role="status" style={{ display: "flex", alignItems: "flex-start", gap: "10px", margin: "-4px 0 0", padding: "12px 14px", border: "1px solid rgba(236,232,223,.18)", background: "rgba(236,232,223,.04)", fontSize: "14px", lineHeight: "1.45", color: "rgba(236,232,223,.86)", overflowWrap: "anywhere" }}>
                          <svg viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", width: "16px", height: "16px", marginTop: "1px", color: "oklch(0.78 0.075 85)" }}><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
                          <span>{v.gNote}</span>
                        </p>
                      ) : null}
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>FULL NAME</span>
                        <input name="name" defaultValue={v.regVals.name} autoComplete="name" placeholder="As on your college ID" aria-invalid={v.inv.name} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.name}` }} style-focus="border-color:oklch(0.78 0.075 85);background:rgba(236,232,223,.08)" />
                        {v.err.name ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.name}</span>) : null}
                      </label>
                      <fieldset data-s-in="" aria-invalid={v.inv.gender} style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "0", padding: "0", border: "0", minWidth: "0" }}>
                        <legend style={{ padding: "0", marginBottom: "8px", fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>GENDER</legend>
                        <span role="radiogroup" aria-label="Gender" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px" }}>
                          {v.genderOptions.map((g) => (
                            <label key={g.value} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "54px", padding: "0 12px", border: `1.5px solid ${v.bc.gender}`, background: "rgba(236,232,223,.04)", fontSize: "15px", fontWeight: "500", color: "#ECE8DF", cursor: "pointer", transition: "border-color .3s,background-color .3s" }} style-hover="border-color:oklch(0.78 0.075 85)">
                              <input type="radio" name="gender" value={g.value} defaultChecked={v.regVals.gender === g.value} style={{ width: "16px", height: "16px", margin: "0", accentColor: "oklch(0.78 0.075 85)", cursor: "pointer" }} />
                              {g.label}
                            </label>
                          ))}
                        </span>
                        {v.err.gender ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.gender}</span>) : null}
                      </fieldset>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>COLLEGE NAME</span>
                        <input
                          name="college"
                          value={collegeValue}
                          onChange={(e) => {
                            setUserCollege(e.target.value);
                            if (v.clearErr) v.clearErr({ target: { name: 'college' } });
                          }}
                          onInput={(e: React.FormEvent<HTMLInputElement>) => {
                            setUserCollege(e.currentTarget.value);
                          }}
                          autoComplete="organization"
                          placeholder="Full name of your institute"
                          aria-invalid={!!v.err.college}
                          style={{
                            height: "54px",
                            padding: "0 16px",
                            borderRadius: "0",
                            background: "rgba(236,232,223,.04)",
                            fontSize: "16px",
                            color: "#ECE8DF",
                            outline: "none",
                            transition: "border-color .3s,background-color .3s",
                            border: `1.5px solid ${v.bc.college}`,
                            cursor: "text",
                          }}
                          style-focus="border-color:oklch(0.78 0.075 85);background:rgba(236,232,223,.08)"
                        />
                        {v.err.college || isIterSoa ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{isIterSoa ? ITER_SOA_ERROR_MESSAGE : v.err.college}</span>) : null}
                      </label>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>EMAIL</span>
                        <input name="email" type="email" value={v.regVals.email} readOnly autoComplete="email" placeholder="you@college.edu" aria-invalid={v.inv.email} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.08)", fontSize: "16px", color: "#ECE8DF", outline: "none", border: `1.5px solid ${v.bc.email}`, cursor: "not-allowed", opacity: "0.85" }} />
                        <span style={{ fontSize: "13px", lineHeight: "1.4", color: "rgba(236,232,223,.62)" }}>The email you signed in with.</span>
                        {v.err.email ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.email}</span>) : null}
                      </label>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>
                          COLLEGE ROLL / ENROLLMENT NUMBER
                        </span>
                        <input name="enrollment_no" defaultValue={v.regVals.enrollment_no} autoComplete="off" required placeholder="Your college roll / enrollment number" aria-invalid={v.inv.enrollment_no} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.enrollment_no}` }} style-focus="border-color:oklch(0.78 0.075 85);background:rgba(236,232,223,.08)" />
                        {v.err.enrollment_no ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.enrollment_no}</span>) : null}
                      </label>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>PHONE</span>
                        <span style={{ display: "flex", gap: "8px" }}><span style={{ display: "flex", alignItems: "center", padding: "0 14px", border: "1.5px solid rgba(236,232,223,.28)", fontSize: "16px", fontWeight: "500" }}>+91</span><input name="phone" defaultValue={v.regVals.phone} type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="98765 43210" aria-invalid={v.inv.phone} style={{ flex: "1", minWidth: "0", height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.phone}` }} style-focus="border-color:oklch(0.78 0.075 85);background:rgba(236,232,223,.08)" /></span>
                        {v.err.phone ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.phone}</span>) : null}
                      </label>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>REFERRAL CODE <span style={{ fontWeight: "500", color: "rgba(236,232,223,.55)" }}>(OPTIONAL)</span></span>
                        <input name="referred_by_code" defaultValue={v.regVals.referred_by_code} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength="20" placeholder="e.g. K7QM2X or CA-K7QM2X" aria-invalid={v.inv.referred_by_code} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.referred_by_code}`, letterSpacing: ".12em", textTransform: "uppercase" }} style-focus="border-color:oklch(0.78 0.075 85);background:rgba(236,232,223,.08)" />
                        <span style={{ fontSize: "13px", lineHeight: "1.4", color: "rgba(236,232,223,.62)" }}>Got a code from a friend who registered, or from your campus ambassador? Enter it here.</span>
                        {v.err.referred_by_code ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.referred_by_code}</span>) : null}
                      </label>
                    </div>

                    <div style={{ display: v.d.s2, flexDirection: "column", gap: "22px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>Pay the fee</h3>
                      <div data-s-in="" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: "28px", alignItems: "center" }}>
                        {/* Payment QR — prominent, click to enlarge */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", justifySelf: "center" }}>
                          <button
                            type="button"
                            onClick={() => setPayQrOpen(true)}
                            style={{
                              position: "relative", padding: "8px", background: "#ECE8DF",
                              border: "2px solid oklch(0.78 0.075 85)", borderRadius: "6px",
                              cursor: "pointer", transition: "transform .2s, box-shadow .2s",
                              boxShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(220,183,106,.3)",
                            }}
                            style-hover="transform:scale(1.03);box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 2px oklch(0.78 0.075 85)"
                            aria-label="Tap to enlarge payment QR code"
                          >
                            <img src={v.upiQr} alt={`Pay ₹${v.fee} via UPI`} width={200} height={280} decoding="async" draggable={false} style={{ display: "block", width: "min(200px, 50vw)", height: "auto", objectFit: "contain" }} />
                            {/* corner brackets */}
                            <span style={{ position:"absolute", left:"-6px", top:"-6px", width:"18px", height:"18px", borderTop:"2.5px solid oklch(0.78 0.075 85)", borderLeft:"2.5px solid oklch(0.78 0.075 85)" }} />
                            <span style={{ position:"absolute", right:"-6px", top:"-6px", width:"18px", height:"18px", borderTop:"2.5px solid oklch(0.78 0.075 85)", borderRight:"2.5px solid oklch(0.78 0.075 85)" }} />
                            <span style={{ position:"absolute", left:"-6px", bottom:"-6px", width:"18px", height:"18px", borderBottom:"2.5px solid oklch(0.78 0.075 85)", borderLeft:"2.5px solid oklch(0.78 0.075 85)" }} />
                            <span style={{ position:"absolute", right:"-6px", bottom:"-6px", width:"18px", height:"18px", borderBottom:"2.5px solid oklch(0.78 0.075 85)", borderRight:"2.5px solid oklch(0.78 0.075 85)" }} />
                          </button>
                          <span style={{ fontSize:"11px", fontWeight:"700", letterSpacing:".14em", color:"rgba(220,183,106,.7)", textTransform:"uppercase" }}>TAP TO ENLARGE</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>AMOUNT</span>
                            <span style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(36px,3.4vw,48px)", lineHeight: "1" }}>₹{v.fee}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>UPI ID</span>
                            <span style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "17px", fontWeight: "500", overflowWrap: "anywhere" }}>{v.upi}</span>
                              <button type="button" onClick={v.copyUpi} style={{ padding: "7px 12px", border: "1.5px solid rgba(236,232,223,.5)", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", transition: "border-color .3s,color .3s" }} style-hover="border-color:oklch(0.78 0.075 85);color:oklch(0.78 0.075 85)">{v.copyLbl}</button>
                            </span>
                          </div>
                          <a href={v.upiLink} style={{ display: v.isPreviewUser ? "none" : v.upiAppD, alignItems: "center", justifyContent: "center", minHeight: "50px", padding: "0 20px", border: "1.5px solid oklch(0.78 0.075 85)", textDecoration: "none", fontWeight: "700", fontSize: "13px", letterSpacing: ".12em", color: "oklch(0.78 0.075 85)" }}>OPEN UPI APP</a>
                        </div>
                      </div>
                      <ol data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "0", padding: "18px 0 0", borderTop: "1px solid rgba(236,232,223,.14)", listStyle: "none", fontSize: "15px", lineHeight: "1.5", color: "rgba(236,232,223,.82)" }}>
                        <li style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: "10px" }}><span style={{ fontWeight: "700", color: "oklch(0.78 0.075 85)" }}>1</span><span>Scan the code with any UPI app.</span></li>
                        <li style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: "10px" }}><span style={{ fontWeight: "700", color: "oklch(0.78 0.075 85)" }}>2</span><span>Pay exactly ₹{v.fee}.</span></li>
                        <li style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: "10px" }}><span style={{ fontWeight: "700", color: "oklch(0.78 0.075 85)" }}>3</span><span>Screenshot the success screen. You&apos;ll upload it next.</span></li>
                      </ol>
                      {v.isPreviewUser && <p className={styles.previewNote}>Preview only: don’t make a payment. Continue to try the screenshot upload and 12-digit UTR fields.</p>}
                    </div>

                    <div style={{ display: v.d.s3, flexDirection: "column", gap: "22px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>Confirm payment</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <span data-s-in="" style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>PAYMENT SCREENSHOT</span>
                        
<label data-s-in="" onDragEnter={v.upPay.over} onDragOver={v.upPay.over} onDragLeave={v.upPay.leave} onDrop={v.upPay.drop} style={{ position: "relative", display: "block", aspectRatio: "16 / 9", border: `1.5px dashed ${v.upPay.bc}`, background: v.upPay.bg, overflow: "hidden", cursor: "pointer", transition: "border-color .3s,background-color .3s" }} style-hover="border-color:oklch(0.78 0.075 85)">
<span style={{ display: v.upPay.emptyD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "20px", textAlign: "center" }}>
<span style={{ display: "grid", placeItems: "center", width: "52px", height: "52px", border: "1.5px solid rgba(236,232,223,.4)", borderRadius: "50%", color: "oklch(0.78 0.075 85)" }}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "22px", height: "22px" }}><path d="M12 15V4M7 9l5-5 5 5M4 14v6h16v-6" fill="none" stroke="currentColor" strokeWidth="1.6"></path></svg></span>
<span style={{ fontSize: "16px", fontWeight: "500" }}>{v.upPay.prompt}</span>
<span style={{ fontSize: "13px", color: "rgba(236,232,223,.62)" }}>JPG or PNG up to 1 MB</span>
</span>
<span style={{ display: v.upPay.prevD, position: "absolute", inset: "0", background: "#0c0b0a" }}>
{v.upPay.hasImg ? (<img decoding="async" src={v.upPay.url} alt="Your payment screenshot" style={{ width: "100%", height: "100%", objectFit: "contain" }} />) : null}
<span style={{ display: v.upPay.pdfD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", background: "rgba(236,232,223,.05)" }}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "40px", height: "40px", color: "oklch(0.78 0.075 85)" }}><path d="M6 2h9l5 5v15H6zM15 2v5h5" fill="none" stroke="currentColor" strokeWidth="1.4"></path></svg><span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: ".2em" }}>PDF</span></span>
<span style={{ position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none" }}><span data-scan="pay" style={{ position: "absolute", inset: "0", opacity: "0" }}><span style={{ position: "absolute", left: "0", right: "0", top: "-64px", height: "64px", background: "linear-gradient(rgba(220,183,106,0),rgba(220,183,106,.3))" }}></span><span style={{ position: "absolute", left: "0", right: "0", top: "0", height: "2px", background: "#F3DFA8" }}></span></span></span>
<span style={{ display: v.upPay.busyD, position: "absolute", inset: "0", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "rgba(12,11,10,.66)" }}>
<span data-up-pct="pay" style={{ fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "34px", lineHeight: "1" }}>0%</span>
<span style={{ position: "relative", width: "56%", height: "2px", background: "rgba(236,232,223,.2)" }}><span data-up-bar="pay" style={{ position: "absolute", inset: "0", background: "oklch(0.78 0.075 85)", transform: "scaleX(0)", transformOrigin: "left" }}></span></span>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".22em" }}>UPLOADING</span>
</span>
</span>
<input type="file" name="payfile" accept="image/*" aria-label="Upload payment screenshot" onChange={v.upPay.pick} style={{ position: "absolute", inset: "0", zIndex: "2", width: "100%", height: "100%", opacity: "0", cursor: "pointer" }} />
</label>
<div data-s-in="" style={{ display: v.upPay.rowD, alignItems: "center", justifyContent: "space-between", gap: "10px 16px", flexWrap: "wrap" }}>
<span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0", flex: "1" }}>
<svg viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", width: "16px", height: "16px", color: "oklch(0.78 0.075 85)" }}><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
<span style={{ minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "15px" }}>{v.upPay.name}</span>
<span style={{ flex: "none", fontSize: "13px", color: "rgba(236,232,223,.62)" }}>{v.upPay.size}</span>
</span>
<span style={{ display: "flex", gap: "18px" }}>
<button type="button" onClick={v.upPay.replace} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", textDecoration: "underline", textUnderlineOffset: "4px" }} style-hover="color:oklch(0.78 0.075 85)">REPLACE</button>
<button type="button" onClick={v.upPay.remove} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", textDecoration: "underline", textUnderlineOffset: "4px" }} style-hover="color:oklch(0.78 0.075 85)">REMOVE</button>
</span>
</div>
<div data-s-in="" style={{ display: v.upPay.failD, alignItems: "center", justifyContent: "space-between", gap: "10px 16px", flexWrap: "wrap" }}>
<span style={{ minWidth: "0", flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "15px" }}>{v.upPay.name}</span>
<span style={{ display: "flex", gap: "18px" }}>
<button type="button" onClick={v.upPay.retry} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", textDecoration: "underline", textUnderlineOffset: "4px" }} style-hover="color:oklch(0.78 0.075 85)">RETRY UPLOAD</button>
<button type="button" onClick={v.upPay.remove} style={{ padding: "6px 0", border: "0", background: "none", cursor: "pointer", fontWeight: "700", fontSize: "12px", letterSpacing: ".14em", color: "#ECE8DF", textDecoration: "underline", textUnderlineOffset: "4px" }} style-hover="color:oklch(0.78 0.075 85)">REMOVE</button>
</span>
</div>
{v.err.payfile ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.payfile}</span>) : null}
                      </div>
                      <label data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(236,232,223,.86)" }}>UPI TRANSACTION ID (UTR)</span>
<input name="utr" inputMode="numeric" autoComplete="off" maxLength="16" placeholder="12-digit number" aria-invalid={v.inv.utr} style={{ height: "54px", padding: "0 16px", borderRadius: "0", background: "rgba(236,232,223,.04)", fontSize: "16px", color: "#ECE8DF", outline: "none", transition: "border-color .3s,background-color .3s", border: `1.5px solid ${v.bc.utr}`, letterSpacing: ".08em" }} style-focus="border-color:oklch(0.78 0.075 85);background:rgba(236,232,223,.08)" />
<span style={{ fontSize: "13px", lineHeight: "1.4", color: "rgba(236,232,223,.62)" }}>Find it under payment details in your UPI app.</span>
{v.err.utr ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.utr}</span>) : null}
</label>
                    </div>

                    <div style={{ display: v.d.login, flexDirection: "column", gap: "18px" }}>
                      <h3 data-s-in="" style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: "400", fontSize: "clamp(24px,2.2vw,32px)", lineHeight: "1.1" }}>Log in / Sign up</h3>

                      <p data-s-in="" style={{ margin: "0 0 4px", fontSize: "14px", lineHeight: "1.5", color: "rgba(236,232,223,.75)" }}>Sign in with your Google account to register for events.</p>

                      <div data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <button id="google-login-external" data-g-btn="" type="button" onClick={() => v.googleLogin(false)} disabled={v.gBusy} aria-busy={v.gBusy} className="hv-google" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", height: "54px", padding: "0 16px", border: "1px solid #8e918f", borderRadius: "0", background: "#131314", color: "#e3e3e3", cursor: v.gBusy ? "progress" : "pointer", fontSize: "15px", fontWeight: "500", letterSpacing: ".01em", transition: "background-color .3s,border-color .3s" }}>
                          <span style={{ position: "relative", display: "grid", placeItems: "center", width: "24px", height: "24px" }}>
                            <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "20px", height: "20px" }}><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>
                          </span>
                          <span>Continue with Google</span>
                        </button>
                      </div>

                      {v.isDev ? (
                        <div data-s-in="" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px", padding: "14px", border: "1px dashed rgba(236,232,223,.22)", background: "rgba(236,232,223,.03)" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".16em", color: "oklch(0.78 0.075 85)" }}>REGISTRATION PREVIEW</span>
                          <button
                            type="button"
                            onClick={v.devOpenRegister}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px",
                              padding: "0 14px", border: "1px solid rgba(236,232,223,.3)", background: "rgba(236,232,223,.08)",
                              color: "#ECE8DF", fontSize: "13px", fontWeight: "700", letterSpacing: ".06em", cursor: "pointer",
                            }}
                          >
                            Review full registration flow
                          </button>
                          <button
                            type="button"
                            onClick={v.devOpenPass}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px",
                              padding: "0 14px", border: "1px solid rgba(236,232,223,.3)", background: "rgba(236,232,223,.08)",
                              color: "#ECE8DF", fontSize: "13px", fontWeight: "700", letterSpacing: ".06em", cursor: "pointer",
                            }}
                          >
                            Preview approved pass
                          </button>
                        </div>
                      ) : null}

                      {v.gErr ? (<span role="alert" style={{ fontSize: "14px", lineHeight: "1.45", color: "oklch(0.76 0.14 35)", padding: "10px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid oklch(0.76 0.14 35)" }}>{v.gErr}</span>) : null}
                    </div>

                    <div style={{ display: v.d.pass, flexDirection: "column", gap: "16px", width: "100%", alignItems: "center" }}>
                      {(v.passQr || v.isDev) ? <EntryPassCard key={v.passUserId || 'dev'} previewPass={v.previewPass} onContinue={v.exploreFromPass} onRegisterAgain={v.registerAgain} /> : null}
                      {v.previewPending && <button type="button" className={styles.previewApprove} onClick={v.devApproveRegistration}>Simulate team approval</button>}

                      {/* Clean minimal footer underneath the ticket */}
                      <div data-s-in="" className="no-print flex flex-col items-center justify-center gap-2 mt-2">
                        {v.refCode ? (
                          <div className="flex items-center gap-3 text-xs font-mono text-[#ECE8DF]/70">
                            <span className="text-[#ECE8DF]/40 uppercase tracking-widest text-[10px]">{v.refCodeLabel}</span>
                            <span className="font-bold text-[#c8b17a] tracking-wider text-sm">{v.refCode}</span>
                            <button type="button" onClick={v.copyRefCode} className="underline hover:text-[#c8b17a] text-[11px] uppercase tracking-wider">
                              {v.refCodeLbl}
                            </button>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={v.closeAuthH}
                          className="mt-3 text-xs font-mono uppercase tracking-wider text-[#ECE8DF]/60 hover:text-[#ECE8DF] transition-colors flex items-center gap-1.5"
                        >
                          <span>← Back to Fest Worlds</span>
                        </button>
                      </div>
                    </div>

                    {v.err.form ? (<p role="alert" style={{ margin: "24px 0 0", fontSize: "14px", lineHeight: "1.4", color: "oklch(0.76 0.14 35)" }}>{v.err.form}</p>) : null}
                    <div data-auth-act="" style={{ display: v.d.act, alignItems: "stretch", gap: "12px", marginTop: "32px" }}>
                      {v.canBack ? (
                        <button type="button" onClick={v.stepBack} onMouseEnter={v.hover} style={{ position: "relative", isolation: "isolate", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "58px", padding: "0 26px", border: "0", cursor: "pointer", fontWeight: "700", fontSize: "14px", letterSpacing: ".08em", color: "#ECE8DF", background: "rgba(236,232,223,.7)", clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }} style-active="transform:scale(.98)"><span style={{ position: "absolute", inset: "1.5px", zIndex: "-1", background: "#100f0e", clipPath: "polygon(11.4px 0,100% 0,100% calc(100% - 11.4px),calc(100% - 11.4px) 100%,0 100%,0 11.4px)" }}></span><span data-scr="">BACK</span></button>
                      ) : null}
<button
                        type="submit"
                        disabled={v.busy}
                        onMouseEnter={v.beep}
                        style={{
                          flex: "1",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "12px",
                          minHeight: "58px",
                          padding: "0 28px",
                          border: "0",
                          cursor: "pointer",
                          fontWeight: "700",
                          fontSize: "15px",
                          letterSpacing: ".08em",
                          whiteSpace: "nowrap",
                          color: "#141312",
                          background: "#ECE8DF",
                          opacity: v.busyO,
                          clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)",
                          transition: "background-color .4s,opacity .3s,color .3s",
                        }}
                        style-hover="background:oklch(0.78 0.075 85)"
                        style-active="transform:scale(.98)"
                      >
                        <span>{v.submitLbl}</span>
                        <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
                          <path d="M11 1l4 4-4 4M15 5H0" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
                        </svg>
                      </button>
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

  {/* Payment QR Lightbox */}
  {payQrOpen && (
    <div
      onClick={() => setPayQrOpen(false)}
      style={{
        position: "fixed", inset: "0", zIndex: "200",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(7,6,5,0.88)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        cursor: "pointer",
        animation: "fadeInLb .15s ease",
      }}
      role="dialog" aria-modal="true" aria-label="Payment QR code enlarged"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", padding: "16px", background: "#ECE8DF",
          borderRadius: "10px", cursor: "default",
          boxShadow: "0 0 0 2px oklch(0.78 0.075 85), 0 40px 100px rgba(0,0,0,0.7)",
          animation: "popInLb .22s cubic-bezier(.34,1.56,.64,1)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
        }}
      >
        <img src={v.upiQr} alt={`UPI QR — pay ₹${v.fee} to ${v.upi}`} style={{ display: "block", width: "min(72vw,300px)", height: "auto" }} />
        <p style={{ margin: "0", fontSize: "11px", fontWeight: "700", letterSpacing: ".14em", color: "rgba(20,19,18,.5)", textTransform: "uppercase" }}>Tap outside to close</p>
      </div>
      <style>{`
        @keyframes fadeInLb { from { opacity:0 } to { opacity:1 } }
        @keyframes popInLb  { from { transform:scale(.78);opacity:0 } to { transform:scale(1);opacity:1 } }
      `}</style>
    </div>
  )}
    </>
  );
}

