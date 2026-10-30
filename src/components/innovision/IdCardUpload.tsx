'use client';

import { useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { httpErrorMessage } from '@/lib/api-errors';
import { shrinkImage } from '@/lib/compress-image';
import { ID_CARD_UPLOAD_TARGET_BYTES, idCardReuploadMessage } from '@/lib/id-cards';
import styles from './PassIssued.module.css';

const MAX_BYTES = 2 * 1024 * 1024; // ID_CARD_MAX_BYTES in src/lib/security.ts (server-only file)

/**
 * "ID card pending" on MY PASS: a registration (pending or confirmed) without its college ID card. Registrations made
 * before ID cards were asked for, or ones staff asked a new card for. Uploads through POST /api/id-card, which attaches
 * the card to the registration; `onUploaded` then reloads the pass. In the registration preview nothing is sent.
 */
export default function IdCardUpload({
  confirmed,
  reuploadReason,
  onUploaded,
  preview = false,
}: {
  confirmed: boolean;
  reuploadReason?: string | null;
  onUploaded: () => void | Promise<void>;
  preview?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reason = idCardReuploadMessage(reuploadReason);

  const upload = async (picked: File) => {
    setError('');
    if (!/^image\//.test(picked.type)) {
      setError('Upload a photo of your ID card (JPG, PNG or WebP).');
      return;
    }
    setBusy(true);
    try {
      const file = await shrinkImage(picked, ID_CARD_UPLOAD_TARGET_BYTES);
      if (file.size > MAX_BYTES) {
        setError('That photo is larger than 2 MB. Please choose a smaller photo of your ID card.');
        return;
      }
      if (!preview) {
        const form = new FormData();
        form.append('file', file);
        const token = (await getSupabase().auth.getSession()).data.session?.access_token;
        const res = await fetch('/api/id-card', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        // A rate limit or crash at the platform edge may answer with HTML, not our JSON.
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          setError(httpErrorMessage(res) || data.error || 'Your ID card did not upload. Please try again.');
          return;
        }
      }
      await onUploaded();
    } catch {
      setError('Upload failed. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.statusBox} role="region" aria-label="College ID card">
      <span className={styles.statusBadgePending}>● ID card pending</span>
      <p className={styles.statusTitle} style={{ marginTop: '10px' }}>Upload your college ID card</p>
      <p className={styles.statusDesc}>
        {confirmed
          ? 'A clear photo of the front of your college ID card, with your name and college readable. Bring the same card to the gate.'
          : 'A clear photo of the front of your college ID card, with your name and college readable. The registration team can approve your payment only after it is uploaded.'}
      </p>
      {reason ? (
        <p className={styles.statusReason}>
          <span className={styles.statusReasonLabel}>NEW PHOTO NEEDED</span>
          {reason}
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void upload(f);
        }}
      />
      <button type="button" className={styles.statusAction} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'UPLOADING…' : error ? 'TRY ANOTHER PHOTO' : 'UPLOAD ID CARD'}
      </button>
      {error ? (
        <span role="alert" className={styles.statusHint} style={{ color: '#f87171' }}>{error}</span>
      ) : (
        <span className={styles.statusHint}>JPG or PNG. Large photos are shrunk before uploading. It can&apos;t be changed later.</span>
      )}
    </div>
  );
}
