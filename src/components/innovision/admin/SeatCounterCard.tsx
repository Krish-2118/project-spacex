'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { httpErrorMessage } from '@/lib/api-errors';
import { formatSeats, MAX_FEE, MAX_SEATS, nextPhaseError, seatCountError } from '@/lib/seats';

/*
 * SEAT COUNTER card on the admin Registrations tab (GET/PATCH /api/admin/seats). Total seats and seats left are what
 * the registration form shows ("1,042 / 1,300 seats left"); after an edit the database keeps moving seats left by
 * itself. At 0 the phase closes, and only START NEXT PHASE (admins) reopens registrations, with a new fee and numbers.
 * ALLOW A PAYMENT is the staff route for someone who paid while they couldn't submit. Admins edit; the registration
 * team can allow a payment; viewers only see it.
 */

interface SeatCounterCardProps {
  getAuthToken: () => Promise<string | null>;
  canEdit: boolean;
  /** The registration team and admins. */
  canAllowPayments: boolean;
  /** Bumped by the dashboard after it reloads the list or reviews a registration: the count may have moved. */
  refreshKey: number;
}

interface Counter {
  total: number;
  left: number;
  phase: number;
  fee: number;
  closedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** The female seat cap; null if it couldn't be read. `full` also counts students on the payment step. */
  female: { cap: number; registered: number; full: boolean } | null;
}

const GOLD = 'oklch(0.8 0.12 85)';
const label: React.CSSProperties = { fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' };
const input: React.CSSProperties = {
  width: '120px', minHeight: '40px', padding: '0 12px', background: 'rgba(236,232,223,0.06)',
  border: '1px solid rgba(236,232,223,0.2)', color: '#ECE8DF', fontSize: '16px', fontVariantNumeric: 'tabular-nums',
};
const btn: React.CSSProperties = {
  minHeight: '40px', padding: '0 16px', border: '1px solid rgba(236,232,223,0.35)', background: 'transparent',
  color: '#ECE8DF', fontSize: '11px', fontWeight: 700, letterSpacing: '.12em', cursor: 'pointer', whiteSpace: 'nowrap',
};

const textInput: React.CSSProperties = { ...input, width: '220px' };

export default function SeatCounterCard({ getAuthToken, canEdit, canAllowPayments, refreshKey }: SeatCounterCardProps) {
  const [counter, setCounter] = useState<Counter | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [total, setTotal] = useState('');
  const [left, setLeft] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ open: false, confirming: false, fee: '', total: '', left: '', error: '' });
  const [allowForm, setAllowForm] = useState({ open: false, email: '', amount: '', note: '', error: '', done: '' });
  // AdminDashboard recreates getAuthToken on every render; read it through a ref so loading isn't restarted each time.
  const tokenRef = useRef(getAuthToken);
  useEffect(() => {
    tokenRef.current = getAuthToken;
  }, [getAuthToken]);

  const request = useCallback(async (init?: RequestInit) => {
    const token = await tokenRef.current();
    const res = await fetch('/api/admin/seats', {
      ...init,
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.counter) throw new Error(httpErrorMessage(res) || data.error || 'Failed to load the seat counter');
    return data.counter as Counter;
  }, []);

  useEffect(() => {
    let cancelled = false;
    request()
      .then((c) => { if (!cancelled) { setCounter(c); setError(''); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the seat counter'); });
    return () => { cancelled = true; };
  }, [request, refreshKey]);

  const startEdit = () => {
    if (!counter) return;
    setTotal(String(counter.total));
    setLeft(String(counter.left));
    setFormError('');
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = total.trim() === '' ? NaN : Number(total);
    const l = left.trim() === '' ? NaN : Number(left);
    const invalid = seatCountError(t, l);
    if (invalid) { setFormError(invalid); return; }
    try {
      setSaving(true);
      setFormError('');
      setCounter(await request({ method: 'PATCH', body: JSON.stringify({ total: t, left: l }) }));
      setEditing(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save the seat counter');
    } finally {
      setSaving(false);
    }
  };

  const post = async (url: string, body: object) => {
    const token = await tokenRef.current();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(httpErrorMessage(res) || data.error || 'The request failed');
  };

  const phaseNumbers = () => ({
    fee: phaseForm.fee.trim() === '' ? NaN : Number(phaseForm.fee),
    total: phaseForm.total.trim() === '' ? NaN : Number(phaseForm.total),
    left: phaseForm.left.trim() === '' ? NaN : Number(phaseForm.left),
  });

  // Two steps: a new fee reaches students the moment it is saved, and can't be taken back without another phase.
  const submitPhase = async (e: React.FormEvent) => {
    e.preventDefault();
    const { fee, total, left: seatsLeft } = phaseNumbers();
    const invalid = nextPhaseError(fee, total, seatsLeft);
    if (invalid) { setPhaseForm((f) => ({ ...f, error: invalid, confirming: false })); return; }
    if (!phaseForm.confirming) { setPhaseForm((f) => ({ ...f, error: '', confirming: true })); return; }
    try {
      setSaving(true);
      await post('/api/admin/seats/phase', { fee, total, left: seatsLeft });
      setCounter(await request());
      setPhaseForm({ open: false, confirming: false, fee: '', total: '', left: '', error: '' });
    } catch (err: unknown) {
      setPhaseForm((f) => ({ ...f, confirming: false, error: err instanceof Error ? err.message : 'Failed to start the next phase' }));
    } finally {
      setSaving(false);
    }
  };

  const submitAllow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const email = allowForm.email.trim();
      await post('/api/admin/registrations/payment-pass', { email, amount: Number(allowForm.amount), note: allowForm.note });
      setAllowForm({ open: true, email: '', amount: '', note: '', error: '', done: `${email} can now sign in and submit their proof, for 7 days.` });
    } catch (err: unknown) {
      setAllowForm((f) => ({ ...f, done: '', error: err instanceof Error ? err.message : 'Failed to allow the payment' }));
    } finally {
      setSaving(false);
    }
  };

  const taken = counter ? counter.total - counter.left : 0;
  const share = counter && counter.total > 0 ? counter.left / counter.total : 0;
  const closed = !!counter?.closedAt;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <section
      aria-label="Seat counter"
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '18px 28px',
        padding: '20px 22px', background: 'rgba(220,183,106,0.05)', border: '1px solid rgba(220,183,106,0.25)',
        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px', flex: '1 1 260px' }}>
        <span style={{ ...label, color: GOLD }}>SEAT COUNTER · SHOWN ON THE REGISTRATION FORM</span>
        {error ? (
          <span role="alert" style={{ fontSize: '13px', lineHeight: 1.5, color: 'oklch(0.74 0.15 35)' }}>{error}</span>
        ) : !counter ? (
          <span style={{ fontSize: '13px', color: 'rgba(236,232,223,0.6)' }}>Loading…</span>
        ) : (
          <>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: '10px', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '36px', lineHeight: 1, color: counter.left === 0 ? 'oklch(0.74 0.15 35)' : '#ECE8DF' }}>
                {formatSeats(counter.left)}
              </span>
              <span style={{ fontSize: '15px', color: 'rgba(236,232,223,0.6)' }}>/ {formatSeats(counter.total)} seats left</span>
            </span>
            <span aria-hidden="true" style={{ position: 'relative', height: '3px', maxWidth: '360px', background: 'rgba(236,232,223,0.14)' }}>
              <span style={{ position: 'absolute', inset: 0, background: GOLD, transform: `scaleX(${share})`, transformOrigin: 'left' }} />
            </span>
            <span style={{ fontSize: '12px', lineHeight: 1.5, color: 'rgba(236,232,223,0.6)' }}>
              {formatSeats(taken)} taken. While open, a new registration takes a seat, a rejection gives it back, approving changes nothing. At 0 registrations close.
              {counter.updatedAt && counter.updatedBy
                ? ` Last set by ${counter.updatedBy} on ${new Date(counter.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`
                : ''}
            </span>
            <span style={{ fontSize: '12px', lineHeight: 1.5, color: closed ? 'oklch(0.74 0.15 35)' : 'rgba(236,232,223,0.8)', fontWeight: 700, letterSpacing: '.04em' }}>
              PHASE {counter.phase} · ₹{formatSeats(counter.fee)} · {closed ? 'CLOSED' : 'OPEN'}
            </span>
            {counter.female ? (
              <span style={{ fontSize: '12px', lineHeight: 1.5, color: counter.female.full ? 'oklch(0.74 0.15 35)' : 'rgba(236,232,223,0.8)', fontWeight: 700, letterSpacing: '.04em' }}>
                FEMALE {formatSeats(counter.female.registered)} / {formatSeats(counter.female.cap)} · {counter.female.full ? (counter.female.registered < counter.female.cap ? 'FULL (SEATS HELD WHILE PAYING)' : 'FULL') : 'OPEN'}
              </span>
            ) : null}
          </>
        )}
      </div>

      {/* While closed, the only thing to do with the numbers is START NEXT PHASE: an edit wouldn't reopen anything. */}
      {canEdit && counter && !editing && !closed ? (
        <button type="button" onClick={startEdit} style={btn}>EDIT NUMBERS</button>
      ) : null}

      {canEdit && editing ? (
        <form onSubmit={save} noValidate style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={label}>TOTAL SEATS</span>
            <input type="number" inputMode="numeric" min={0} max={MAX_SEATS} value={total} onChange={(e) => setTotal(e.target.value)} style={input} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={label}>SEATS LEFT (SHOWN)</span>
            <input type="number" inputMode="numeric" min={0} max={MAX_SEATS} value={left} onChange={(e) => setLeft(e.target.value)} style={input} />
          </label>
          <button type="submit" disabled={saving} style={{ ...btn, background: GOLD, color: '#141312', border: 0, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
          <button type="button" disabled={saving} onClick={() => setEditing(false)} style={btn}>CANCEL</button>
          {formError ? (
            <span role="alert" style={{ flexBasis: '100%', fontSize: '13px', color: 'oklch(0.74 0.15 35)' }}>{formError}</span>
          ) : null}
        </form>
      ) : null}
    </section>

    {canEdit && counter && closed ? (
      <section aria-label="Start the next phase" style={{ padding: '16px 22px', border: '1px solid rgba(220,183,106,0.25)' }}>
        {!phaseForm.open ? (
          <button type="button" onClick={() => setPhaseForm((f) => ({ ...f, open: true }))} style={btn}>START NEXT PHASE</button>
        ) : (
          <form onSubmit={submitPhase} noValidate style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={label}>FEE (₹)</span>
              <input type="number" inputMode="numeric" min={1} max={MAX_FEE} value={phaseForm.fee} onChange={(e) => setPhaseForm((f) => ({ ...f, fee: e.target.value, confirming: false }))} style={input} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={label}>TOTAL SEATS</span>
              <input type="number" inputMode="numeric" min={1} max={MAX_SEATS} value={phaseForm.total} onChange={(e) => setPhaseForm((f) => ({ ...f, total: e.target.value, confirming: false }))} style={input} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={label}>SEATS LEFT (SHOWN)</span>
              <input type="number" inputMode="numeric" min={1} max={MAX_SEATS} value={phaseForm.left} onChange={(e) => setPhaseForm((f) => ({ ...f, left: e.target.value, confirming: false }))} style={input} />
            </label>
            <button type="submit" disabled={saving} style={{ ...btn, background: GOLD, color: '#141312', border: 0, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'STARTING…' : phaseForm.confirming ? `CONFIRM: OPEN AT ₹${formatSeats(phaseNumbers().fee)}` : 'REVIEW'}
            </button>
            <button type="button" disabled={saving} onClick={() => setPhaseForm({ open: false, confirming: false, fee: '', total: '', left: '', error: '' })} style={btn}>CANCEL</button>
            {phaseForm.confirming ? (
              <span style={{ flexBasis: '100%', fontSize: '13px', lineHeight: 1.5, color: 'rgba(236,232,223,0.8)' }}>
                This reopens registrations for everyone straight away at the new fee. It can only be changed by closing this phase and starting another.
              </span>
            ) : null}
            {phaseForm.error ? (
              <span role="alert" style={{ flexBasis: '100%', fontSize: '13px', color: 'oklch(0.74 0.15 35)' }}>{phaseForm.error}</span>
            ) : null}
          </form>
        )}
      </section>
    ) : null}

    {canAllowPayments && counter ? (
      <section aria-label="Allow a payment" style={{ padding: '16px 22px', border: '1px solid rgba(236,232,223,0.12)' }}>
        {!allowForm.open ? (
          <button type="button" onClick={() => setAllowForm((f) => ({ ...f, open: true }))} style={btn}>ALLOW A PAYMENT</button>
        ) : (
          <form onSubmit={submitAllow} noValidate style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
            <span style={{ flexBasis: '100%', fontSize: '12px', lineHeight: 1.5, color: 'rgba(236,232,223,0.6)' }}>
              For someone who paid but can&apos;t submit. Check the UTR and amount on the bank statement first, because screenshots can be faked. They then sign in and submit their proof at this amount, and it is reviewed as usual.
            </span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={label}>STUDENT&apos;S SIGN-IN EMAIL</span>
              <input type="email" value={allowForm.email} onChange={(e) => setAllowForm((f) => ({ ...f, email: e.target.value }))} style={textInput} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={label}>AMOUNT PAID (₹)</span>
              <input type="number" inputMode="numeric" min={1} max={MAX_FEE} value={allowForm.amount} onChange={(e) => setAllowForm((f) => ({ ...f, amount: e.target.value }))} style={input} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={label}>NOTE (UTR CHECKED)</span>
              <input type="text" maxLength={300} value={allowForm.note} onChange={(e) => setAllowForm((f) => ({ ...f, note: e.target.value }))} style={textInput} />
            </label>
            <button type="submit" disabled={saving} style={{ ...btn, background: GOLD, color: '#141312', border: 0, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'SAVING…' : 'ALLOW'}
            </button>
            <button type="button" disabled={saving} onClick={() => setAllowForm({ open: false, email: '', amount: '', note: '', error: '', done: '' })} style={btn}>CLOSE</button>
            {allowForm.done ? <span role="status" style={{ flexBasis: '100%', fontSize: '13px', color: 'oklch(0.75 0.16 145)' }}>{allowForm.done}</span> : null}
            {allowForm.error ? <span role="alert" style={{ flexBasis: '100%', fontSize: '13px', color: 'oklch(0.74 0.15 35)' }}>{allowForm.error}</span> : null}
          </form>
        )}
      </section>
    ) : null}
    </div>
  );
}
