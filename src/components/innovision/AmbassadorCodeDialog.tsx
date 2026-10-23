'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SITE_URL } from '@/config/site';
import { formatReferralCode } from '@/lib/validation';
import { useDialogFocus } from './useDialogFocus';

/** What GET MY CODE found (Innovision#checkAmbassadorCode); null while the dialog is closed. */
export type AmbassadorDialogState =
  | { kind: 'loading' }
  | { kind: 'code'; code: string; name: string; email: string }
  /** No code yet: asks for their college, then creates it. */
  | { kind: 'join'; email: string; name: string; college: string; busy?: boolean; error?: string }
  | { kind: 'revoked'; email: string }
  | { kind: 'error'; message: string };

interface AmbassadorCodeDialogProps {
  state: AmbassadorDialogState | null;
  /** The Google Form to apply with ('' while the link is a placeholder: src/config/ambassador.ts). */
  formUrl: string;
  onClose: () => void;
  onRetry: () => void;
  /** Creates the signed-in student's code (the 'join' state). */
  onCreate: (college: string) => void;
  onLogout: () => void;
}

const GOLD = 'oklch(0.8 0.12 85)';
const BAD = 'oklch(0.85 0.12 35)';
const muted: React.CSSProperties = { margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'rgba(236,232,223,0.72)', textWrap: 'pretty' };
const clip10 = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)';
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '50px', padding: '0 22px', border: 0,
  cursor: 'pointer', fontWeight: 700, fontSize: '13px', letterSpacing: '.12em', color: '#141312', background: '#ECE8DF',
  textDecoration: 'none', clipPath: clip10,
};
const ghostBtn: React.CSSProperties = {
  ...primaryBtn, color: '#ECE8DF', background: 'transparent', border: '1.5px solid rgba(236,232,223,0.35)', clipPath: 'none',
};

/** Copies text, falling back to selecting it for a manual copy where the clipboard API is unavailable or refused. */
async function copyText(text: string, fallback: HTMLElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch {}
  if (fallback) {
    const range = document.createRange();
    range.selectNodeContents(fallback);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  return false;
}

/**
 * GET MY CODE, opened from the home page's Campus Ambassador section. Any signed-in student can get a code: the first
 * time, they confirm their college and the code is created. Then it shows their permanent CA code with a share link
 * (/?ref=CODE pre-fills the registration form) and a WhatsApp share. Ambassadors see only their code: counts live in
 * the admin dashboard's AMBASSADORS tab.
 */
export default function AmbassadorCodeDialog({ state, formUrl, onClose, onRetry, onCreate, onLogout }: AmbassadorCodeDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLSpanElement>(null);
  const linkRef = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState<'' | 'code' | 'link' | 'manual'>('');
  const open = !!state;
  useDialogFocus(open, ref, onClose);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(''), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  if (!state) return null;

  const shown = state.kind === 'code' ? formatReferralCode(state.code) : '';
  const link = state.kind === 'code' ? `${SITE_URL}/?ref=${encodeURIComponent(state.code)}` : '';
  const shareText = `Register for INNOVISION 2026 at NIT Rourkela with my campus ambassador code ${shown}: ${link}`;
  const copy = async (what: 'code' | 'link') => {
    const ok = await copyText(what === 'code' ? shown : link, (what === 'code' ? codeRef : linkRef).current);
    setCopied(ok ? what : 'manual');
  };

  const title =
    state.kind === 'code' ? 'Your ambassador code'
    : state.kind === 'join' ? 'Become a campus ambassador'
    : state.kind === 'revoked' ? 'Code no longer active'
    : state.kind === 'error' ? 'Something went wrong'
    : 'Checking…';

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget && state.kind !== 'loading' && !(state.kind === 'join' && state.busy)) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', placeItems: 'center',
        overflowY: 'auto', background: 'rgba(7, 6, 5, 0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        padding: 'clamp(12px, 4vw, 20px)',
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ambassador-dialog-title"
        aria-busy={state.kind === 'loading'}
        tabIndex={-1}
        style={{
          position: 'relative', width: '100%', maxWidth: '460px', padding: '1px', outline: 'none',
          background: 'rgba(236,232,223,0.22)',
          clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)',
        }}
      >
        <div
          style={{
            position: 'relative', display: 'flex', flexDirection: 'column', gap: '18px',
            padding: 'clamp(26px, 7vw, 32px) clamp(18px, 6vw, 28px)', background: 'rgba(16, 15, 14, 0.97)', color: '#ECE8DF',
            clipPath: 'polygon(15.5px 0, 100% 0, 100% calc(100% - 15.5px), calc(100% - 15.5px) 100%, 0 100%, 0 15.5px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '36px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: GOLD, boxShadow: `0 0 10px ${GOLD}` }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.2em', color: GOLD }}>CAMPUS AMBASSADOR</span>
          </div>
          <h3 id="ambassador-dialog-title" style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '26px', letterSpacing: '.02em' }}>
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ position: 'absolute', top: '8px', right: '8px', display: 'grid', placeItems: 'center', width: '44px', height: '44px', padding: 0, background: 'transparent', border: 0, color: 'rgba(236,232,223,0.6)', cursor: 'pointer' }}
          >
            ✕
          </button>

          {state.kind === 'loading' && <p style={muted} role="status">Checking your ambassador status…</p>}

          {state.kind === 'code' && (
            <>
              <p style={muted}>
                Share this code with students from your campus. Anyone can enter it in the referral field when they
                register, as many times as needed. It never changes.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '18px 20px', border: `1.5px solid ${GOLD}`, background: 'rgba(236,232,223,0.04)' }}>
                <span ref={codeRef} style={{ fontFamily: 'monospace', fontSize: 'clamp(24px, 7vw, 30px)', fontWeight: 700, letterSpacing: '.14em', color: GOLD, userSelect: 'all' }}>{shown}</span>
                <button type="button" onClick={() => void copy('code')} style={{ ...ghostBtn, minHeight: '40px', padding: '0 16px' }}>
                  {copied === 'code' ? 'COPIED' : 'COPY CODE'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.16em', color: 'rgba(236,232,223,0.86)' }}>SHARE LINK</span>
                <span ref={linkRef} style={{ fontSize: '13px', fontFamily: 'monospace', overflowWrap: 'anywhere', color: 'rgba(236,232,223,0.8)', userSelect: 'all' }}>{link}</span>
                <span style={{ fontSize: '12px', color: 'rgba(236,232,223,0.55)' }}>Opening it fills your code in for them when they register.</span>
              </div>
              {copied === 'manual' && <p role="status" style={{ ...muted, color: GOLD }}>Copying isn&apos;t allowed here: it&apos;s selected, so copy it by hand.</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, flex: '1 1 180px' }}>
                  SHARE ON WHATSAPP
                </a>
                <button type="button" onClick={() => void copy('link')} style={{ ...ghostBtn, flex: '1 1 140px' }}>
                  {copied === 'link' ? 'LINK COPIED' : 'COPY LINK'}
                </button>
              </div>
              <p style={{ ...muted, fontSize: '12px', overflowWrap: 'anywhere' }}>Signed in as {state.email}.</p>
            </>
          )}

          {state.kind === 'join' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (state.busy) return;
                onCreate(String(new FormData(e.currentTarget).get('college') ?? ''));
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <p style={muted}>
                Get your own code to share with students from your campus. Anyone can enter it when they register, and you
                don&apos;t need to register yourself.
              </p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.16em', color: 'rgba(236,232,223,0.86)' }}>YOUR COLLEGE</span>
                <input
                  name="college"
                  defaultValue={state.college}
                  required
                  minLength={3}
                  maxLength={200}
                  autoComplete="organization"
                  placeholder="Your college or university"
                  aria-invalid={!!state.error}
                  disabled={state.busy}
                  style={{ height: '52px', padding: '0 16px', borderRadius: 0, background: 'rgba(236,232,223,0.04)', border: `1.5px solid ${state.error ? 'oklch(0.74 0.15 35)' : 'rgba(236,232,223,0.28)'}`, color: '#ECE8DF', fontSize: '16px', outline: 'none' }}
                />
                {state.error && <span role="alert" style={{ fontSize: '13px', color: BAD }}>{state.error}</span>}
              </label>
              <button type="submit" disabled={state.busy} style={{ ...primaryBtn, cursor: state.busy ? 'progress' : 'pointer' }}>
                {state.busy ? 'CREATING YOUR CODE…' : 'GET MY CODE'}
              </button>
              {formUrl ? (
                <p style={{ ...muted, fontSize: '13px' }}>
                  Haven&apos;t filled in the ambassador form yet?{' '}
                  <a href={formUrl} target="_blank" rel="noopener noreferrer" style={{ color: GOLD }}>Apply via Google Form ↗</a>
                </p>
              ) : null}
              <p style={{ ...muted, fontSize: '12px', overflowWrap: 'anywhere' }}>
                {state.name ? `${state.name} · ` : ''}{state.email}.{' '}
                <button type="button" onClick={onLogout} style={{ padding: 0, border: 0, background: 'none', color: '#ECE8DF', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
                  Not you? Log out
                </button>
              </p>
            </form>
          )}

          {state.kind === 'revoked' && (
            <p style={muted}>
              The campus ambassador code for <b style={{ color: '#ECE8DF', overflowWrap: 'anywhere' }}>{state.email}</b> has
              been deactivated by the organisers and isn&apos;t accepted for new registrations. If you think this is a
              mistake, please contact the registration team.
            </p>
          )}

          {state.kind === 'error' && (
            <>
              <p role="alert" style={{ ...muted, color: BAD }}>{state.message}</p>
              <button type="button" onClick={onRetry} style={primaryBtn}>TRY AGAIN</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
