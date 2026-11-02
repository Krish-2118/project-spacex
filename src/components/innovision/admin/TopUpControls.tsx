'use client';

import React, { useState } from 'react';
import { httpErrorMessage } from '@/lib/api-errors';
import type { Registration } from '@/lib/supabase';

/*
 * For a pending registration that paid too little (POST /api/admin/registrations/top-up). There are no refunds, so instead
 * of rejecting it staff ask for the difference, which MY PASS shows the student and which blocks approval, then record
 * the UTR of the second payment once they have checked it arrived.
 */

interface TopUpControlsProps {
  reg: Registration;
  getAuthToken: () => Promise<string | null>;
  onChanged: (registration: Registration) => void;
}

const field: React.CSSProperties = {
  width: '120px', minHeight: '30px', padding: '0 8px', background: 'rgba(236,232,223,0.06)',
  border: '1px solid rgba(236,232,223,0.2)', color: '#ECE8DF', fontSize: '12px',
};
const action: React.CSSProperties = {
  padding: '6px 10px', background: 'transparent', border: '1px solid rgba(236,232,223,0.35)', color: '#ECE8DF',
  fontSize: '10px', fontWeight: 700, letterSpacing: '.08em', cursor: 'pointer', whiteSpace: 'nowrap',
};

export default function TopUpControls({ reg, getAuthToken, onChanged }: TopUpControlsProps) {
  const [asking, setAsking] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const due = reg.amount_due ?? 0;

  const send = async (body: Record<string, unknown>) => {
    try {
      setBusy(true);
      setError('');
      const token = await getAuthToken();
      const res = await fetch('/api/admin/registrations/top-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ registrationId: reg.id, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.registration) throw new Error(httpErrorMessage(res) || data.error || 'The request failed');
      onChanged(data.registration as Registration);
      setAsking(false);
      setValue('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The request failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(due > 0 ? { action: 'record', utr: value.trim() } : { action: 'ask', amountDue: Number(value) });
  };

  if (due <= 0 && !asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} title="They paid too little: ask for the difference instead of rejecting" style={{ ...action, marginTop: '8px' }}>
        ASK FOR DIFFERENCE
      </button>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
      <input
        aria-label={due > 0 ? 'UTR of the top-up payment' : 'Amount still due in rupees'}
        inputMode="numeric"
        placeholder={due > 0 ? 'Top-up UTR' : 'Amount due (₹)'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={field}
      />
      <button type="submit" disabled={busy} style={{ ...action, cursor: busy ? 'wait' : 'pointer' }}>
        {due > 0 ? 'RECORD TOP-UP' : 'ASK'}
      </button>
      {due <= 0 ? (
        <button type="button" disabled={busy} onClick={() => { setAsking(false); setValue(''); setError(''); }} style={action}>CANCEL</button>
      ) : null}
      {error ? <span role="alert" style={{ flexBasis: '100%', fontSize: '11px', color: 'oklch(0.74 0.15 35)' }}>{error}</span> : null}
    </form>
  );
}
