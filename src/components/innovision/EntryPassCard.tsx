'use client';

import { useEffect, useState } from 'react';
import { isApprovedPass, passStatusMessage, type ParticipantPass } from '@/lib/pass-experience';
import { passRequest } from './pass-client';
import PassIssued from './PassIssued';
import IdCardUpload from './IdCardUpload';
import styles from './PassIssued.module.css';
import { REGISTRATION_PREVIEW_ENABLED } from '@/config/launch';
import { rejectionMessage } from '@/lib/rejections';

interface EntryPassCardProps {
  onContinue?: () => void;
  previewPass?: ParticipantPass;
  /** REGISTER AGAIN on a rejected pass with attempts left; left out while registrations are closed. */
  onRegisterAgain?: () => void | Promise<void>;
  /** The college ID card was just uploaded from the pass (the rest of the site refreshes its registration). */
  onIdCardUploaded?: () => void | Promise<void>;
}

export default function EntryPassCard({ onContinue, previewPass, onRegisterAgain, onIdCardUploaded }: EntryPassCardProps) {
  if (REGISTRATION_PREVIEW_ENABLED && previewPass) {
    return <PassState pass={previewPass} onContinue={onContinue} preview />;
  }
  return (
    <AuthenticatedEntryPassCard onContinue={onContinue} onRegisterAgain={onRegisterAgain} onIdCardUploaded={onIdCardUploaded} />
  );
}

function AuthenticatedEntryPassCard({ onContinue, onRegisterAgain, onIdCardUploaded }: EntryPassCardProps) {
  const [pass, setPass] = useState<ParticipantPass | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let busy = false;

    const load = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;

      try {
        const data = await passRequest('/api/pass');
        if (!data.pass) throw new Error('Could not load your registration details.');
        if (!cancelled) {
          setPass(data.pass);
          setError('');
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not connect to verify your pass.');
          setPass(null);
          setLoading(false);
        }
      } finally {
        busy = false;
      }
    };

    void load();
    const interval = setInterval(() => void load(), 15_000);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [attempt]);

  // Loading state: never flash approved ticket while status is unknown
  if (loading && !pass && !error) {
    return (
      <div className={styles.statusBox} role="status" aria-live="polite">
        <span className={styles.statusBadgePending}>● Checking registration</span>
        <p className={styles.statusDesc} style={{ marginTop: '8px' }}>
          Checking your registration status with the backend…
        </p>
      </div>
    );
  }

  // Network / Connection Error state
  if (error && !pass) {
    return (
      <div className={styles.statusBox} role="alert">
        <p className={styles.statusTitle}>Connection Error</p>
        <p className={styles.statusDesc}>{error}</p>
        <button
          type="button"
          className={styles.primaryBtn}
          style={{ marginTop: '12px' }}
          onClick={() => {
            setLoading(true);
            setError('');
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!pass) return null;
  return (
    <PassState
      pass={pass}
      onContinue={onContinue}
      onRegisterAgain={onRegisterAgain}
      onIdCardUploaded={async () => {
        // Reload the pass (the effect above runs again), and let the rest of the site know.
        setAttempt((n) => n + 1);
        await onIdCardUploaded?.();
      }}
    />
  );
}

function PassState({
  pass,
  onContinue,
  onRegisterAgain,
  onIdCardUploaded,
  preview = false,
}: {
  pass: ParticipantPass;
  onContinue?: () => void;
  onRegisterAgain?: () => void | Promise<void>;
  onIdCardUploaded?: () => void | Promise<void>;
  preview?: boolean;
}) {
  const [opening, setOpening] = useState(false);
  // In the preview there is no server to reload from: the banner just goes away.
  const [previewUploaded, setPreviewUploaded] = useState(false);
  const idCardPending = pass.idCard === 'pending' && !(preview && previewUploaded);
  const idCard = idCardPending ? (
    <IdCardUpload
      confirmed={pass.registrationStatus === 'confirmed'}
      reuploadReason={pass.idCardReuploadReason}
      preview={preview}
      onUploaded={preview ? () => setPreviewUploaded(true) : onIdCardUploaded ?? (() => {})}
    />
  ) : null;

  // Unapproved states: Pending review or Rejected
  if (!isApprovedPass(pass)) {
    const isPending = pass.registrationStatus === 'pending';
    const isRejected = pass.registrationStatus === 'rejected';
    const reason = isRejected ? rejectionMessage(pass.rejectionReason) : '';
    const left = isRejected ? pass.attemptsLeft ?? 0 : 0;
    const canRetry = left > 0 && !!onRegisterAgain;

    const statusBox = (
      <div className={styles.statusBox} role="status" aria-live="polite">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <span className={isPending ? styles.statusBadgePending : styles.statusBadgeDeclined}>
            {isPending ? '● Payment under review' : isRejected ? '✕ Registration declined' : '◌ Registration incomplete'}
          </span>
          {pass.registrationId && (
            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'rgba(236,232,223,0.6)' }}>
              ID: {pass.registrationId}
            </span>
          )}
        </div>

        <p className={styles.statusTitle} style={{ marginTop: '10px' }}>
          {isPending
            ? 'Payment Under Review'
            : isRejected
            ? 'Registration Not Approved'
            : 'Pass Not Yet Issued'}
        </p>

        <p className={styles.statusDesc}>
          {isRejected && canRetry
            ? 'Your payment was not approved, but you can register again with the right details.'
            : isPending && idCardPending
            ? 'Your payment is under review. The registration team can approve it only after your college ID card is uploaded (above).'
            : passStatusMessage(pass)}
        </p>

        {isPending && pass.idCard === 'uploaded' ? (
          <p className={styles.statusDesc} style={{ color: '#c8b17a' }}>✓ College ID card uploaded</p>
        ) : null}

        {reason ? (
          <p className={styles.statusReason}>
            <span className={styles.statusReasonLabel}>WHY</span>
            {reason}
          </p>
        ) : null}

        {canRetry ? (
          <>
            <button
              type="button"
              className={styles.statusAction}
              disabled={opening}
              onClick={async () => {
                setOpening(true);
                try { await onRegisterAgain?.(); } finally { setOpening(false); }
              }}
            >
              {opening ? 'OPENING…' : 'REGISTER AGAIN'}
            </button>
            <span className={styles.statusHint}>
              {left === 1 ? 'This is your last attempt.' : `${left} attempts left.`} A new payment screenshot and UTR are
              needed; the same UTR is fine if that payment was real.
            </span>
          </>
        ) : null}

        {isPending && (
          <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '4px', background: 'rgba(236,232,223,0.04)', border: '1px solid rgba(236,232,223,0.1)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.12em', color: '#c9a24a', display: 'block' }}>
              VENUE
            </span>
            <span style={{ fontSize: '13px', color: '#ECE8DF', marginTop: '2px', display: 'block' }}>
              National Institute of Technology, Rourkela
            </span>
          </div>
        )}
      </div>
    );
    return idCard ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
        {idCard}
        {statusBox}
      </div>
    ) : statusBox;
  }

  // Approved state: the QR stays usable while the ID card is pending.
  const issued = (
    <PassIssued
      key={pass.registrationId}
      pass={pass}
      qr={null}
      onContinue={onContinue}
      preview={preview}
    />
  );
  return idCard ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
      {idCard}
      {issued}
    </div>
  ) : issued;
}
