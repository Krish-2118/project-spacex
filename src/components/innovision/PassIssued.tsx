'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ParticipantPass } from '@/lib/pass-experience';
import { WHATSAPP_COMMUNITY_URL } from '@/config/site';
import { REGISTRATION_PREVIEW_ENABLED } from '@/config/launch';
import PassTicket from './PassTicket';
import { passRequest } from './pass-client';
import styles from './PassIssued.module.css';

// Share pending claims across Strict Mode mounts and ordinary route remounts.
const presented = new Map<string, { claim: string; acknowledged: boolean; displayed: boolean }>();
const claims = new Map<string, { claim: string; request: Promise<{ result: string }> }>();

interface PassIssuedProps {
  pass: ParticipantPass;
  qr: string | null;
  onContinue?: () => void;
  preview?: boolean;
}

export default function PassIssued({ pass, qr, preview = false }: PassIssuedProps) {
  const id = pass.registrationId || 'unknown';
  const isPreview = REGISTRATION_PREVIEW_ENABLED && preview;
  const [phase, setPhase] = useState<'waiting' | 'revealing' | 'settled' | 'unavailable'>('waiting');
  const root = useRef<HTMLElement>(null);
  const ackBusy = useRef(false);

  const acknowledge = useCallback(async () => {
    if (isPreview) return;
    const entry = presented.get(id);
    if (!entry?.displayed || entry.acknowledged || ackBusy.current) return;
    ackBusy.current = true;
    try {
      const data = await passRequest('/api/pass/experience', { action: 'acknowledge', claim: entry.claim });
      if (data.result === true) {
        entry.acknowledged = true;
        claims.delete(id);
      }
    } catch {
      // Preserve the claim and retry on focus/connection recovery or a later visit.
    } finally {
      ackBusy.current = false;
    }
  }, [id, isPreview]);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let firstFrame = 0;
    let secondFrame = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');

    const show = (animate: boolean) => {
      const moving = animate && !reduced.matches;
      setPhase(moving ? 'revealing' : 'settled');
      // Acknowledge only after the actual pass has painted, never during loading.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (cancelled) return;
          const entry = presented.get(id);
          if (entry) entry.displayed = true;
          if (!moving) void acknowledge();
        });
      });
      if (moving) timer = setTimeout(() => {
        if (!cancelled) { setPhase('settled'); void acknowledge(); }
      }, 2400);
    };

    const check = async () => {
      if (cancelled || started || document.visibilityState !== 'visible') return;
      started = true;
      if (isPreview) { show(true); return; }
      const existing = presented.get(id);
      if (existing?.acknowledged || existing?.displayed) { show(false); return; }
      let pending = claims.get(id);
      if (!pending) {
        const claim = crypto.randomUUID();
        pending = { claim, request: passRequest('/api/pass/experience', { action: 'claim', claim }) };
        claims.set(id, pending);
      }
      try {
        const data = await pending.request;
        if (cancelled) return;
        if (data.result === 'ineligible') {
          claims.delete(id);
          setPhase('unavailable');
        } else if (data.result === 'claimed') {
          if (!presented.has(id)) presented.set(id, { claim: pending.claim, acknowledged: false, displayed: false });
          show(true);
        } else {
          claims.delete(id);
          show(false); // Server says seen, or another tab owns presentation.
        }
      } catch {
        claims.delete(id);
        if (!cancelled) show(false); // Access to the approved pass survives an acknowledgement outage.
      }
    };
    void check();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { void check(); void acknowledge(); }
      else if (presented.get(id)?.displayed) { setPhase('settled'); void acknowledge(); }
    };
    const onReduced = () => {
      if (reduced.matches) { setPhase('settled'); void acknowledge(); }
    };
    const onOnline = () => { void acknowledge(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onOnline);
    reduced.addEventListener('change', onReduced);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onOnline);
      reduced.removeEventListener('change', onReduced);
      void acknowledge();
    };
  }, [id, acknowledge, isPreview]);
  if (phase === 'unavailable') {
    return (
      <section ref={root} className={styles.statusBox} role="status">
        <p className={styles.statusTitle}>Registration Status Updated</p>
        <p className={styles.statusDesc}>
          Your registration status has been updated. Please refresh your dashboard to view the latest status.
        </p>
      </section>
    );
  }

  return (
    <section
      ref={root}
      tabIndex={-1}
      aria-label="Your Innovision Pass"
      className={`${styles.experience} ${styles[phase] ?? ''}`}
      data-pass-phase={phase}
      style={{ position: 'relative' }}
    >
      <div className={styles.issueHeader} role="status" aria-live="polite">
        <p className={styles.issueEyebrow}>YOUR INNO PASS, ISSUED.</p>
        <h2>You’re in, {pass.name?.trim().split(/\s+/)[0]}.</h2>
        <p>Your payment has been verified by the registration team.</p>
      </div>
      {/* Skip reveal button — only during eject animation */}
      {phase === 'revealing' && (
        <button
          type="button"
          className={styles.skipBtn}
          onClick={() => {
            setPhase('settled');
            const entry = presented.get(id);
            if (entry) entry.displayed = true;
            void acknowledge();
          }}
        >
          SKIP
        </button>
      )}

      {phase === 'waiting' ? (
        <p className={styles.hint} role="status">Preparing your pass…</p>
      ) : (
        <>
          <div className={styles.feed}>
            <div className={styles.paper}>
              <PassTicket pass={pass} qr={qr} animate={phase === 'revealing'} />
            </div>
          </div>

          {/* WhatsApp Community Card */}
          <div className={`${styles.whatsappCard} no-print`}>
            <div className={styles.whatsappHeader}>
              <span className={styles.whatsappBadge}>
                <span className={styles.whatsappBadgeDot} />
                OFFICIAL ATTENDEES GROUP
              </span>
              <span className={styles.whatsappVenue}>NIT ROURKELA</span>
            </div>
            <div>
              <h4 className={styles.whatsappTitle}>Stay in the loop.</h4>
              <p className={styles.whatsappDesc}>
                Event updates, schedule changes, and help from the team — all in the official community.
              </p>
            </div>
            <a
              href={WHATSAPP_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappBtn}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.59 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.67 12.05 3.67ZM8.94 7.22C8.78 7.22 8.52 7.28 8.29 7.53C8.07 7.78 7.44 8.37 7.44 9.58C7.44 10.79 8.32 11.96 8.44 12.12C8.57 12.28 10.15 14.72 12.59 15.77C13.17 16.02 13.62 16.17 13.98 16.28C14.56 16.47 15.09 16.44 15.51 16.38C15.98 16.31 16.95 15.79 17.15 15.22C17.36 14.65 17.36 14.17 17.3 14.07C17.24 13.97 17.07 13.91 16.82 13.79C16.57 13.66 15.34 13.06 15.11 12.98C14.88 12.89 14.72 12.85 14.55 13.1C14.39 13.35 13.92 13.91 13.78 14.07C13.64 14.24 13.5 14.26 13.25 14.13C13 14.01 11.96 13.67 10.73 12.57C9.77 11.72 9.12 10.66 8.99 10.45C8.87 10.24 8.98 10.13 9.1 10.01C9.21 9.9 9.35 9.72 9.48 9.58C9.6 9.43 9.64 9.33 9.72 9.16C9.8 9 9.76 8.85 9.7 8.73C9.64 8.6 9.17 7.45 8.97 6.98C8.78 6.52 8.59 6.58 8.44 6.57L8.03 6.57C7.86 6.57 7.61 6.64 7.44 6.82L8.94 7.22Z"/>
              </svg>
              <span>Join the community</span>
            </a>
          </div>
        </>
      )}

    </section>
  );
}
