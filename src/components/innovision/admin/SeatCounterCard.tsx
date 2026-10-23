'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { httpErrorMessage } from '@/lib/api-errors';
import { formatSeats, MAX_SEATS, seatCountError } from '@/lib/seats';

/*
 * SEAT COUNTER card on the admin Registrations tab (GET/PATCH /api/admin/seats). Total seats and seats left are what
 * the registration form shows ("1,042 / 1,300 seats left"); after an edit the database keeps moving seats left by
 * itself (a registration takes a seat, a rejection gives it back). Admins edit; the registration team only sees it.
 */

interface SeatCounterCardProps {
  getAuthToken: () => Promise<string | null>;
  canEdit: boolean;
  /** Bumped by the dashboard after it reloads the list or reviews a registration: the count may have moved. */
  refreshKey: number;
}

interface Counter {
  total: number;
  left: number;
  updatedAt: string | null;
  updatedBy: string | null;
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

export default function SeatCounterCard({ getAuthToken, canEdit, refreshKey }: SeatCounterCardProps) {
  const [counter, setCounter] = useState<Counter | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [total, setTotal] = useState('');
  const [left, setLeft] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
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

  const taken = counter ? counter.total - counter.left : 0;
  const share = counter && counter.total > 0 ? counter.left / counter.total : 0;

  return (
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
              {formatSeats(taken)} taken. A new registration takes a seat, a rejection gives it back, approving changes nothing.
              {counter.left === 0 ? ' The form is stopping new registrations before payment.' : ''}
              {counter.updatedAt && counter.updatedBy
                ? ` Last set by ${counter.updatedBy} on ${new Date(counter.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`
                : ''}
            </span>
          </>
        )}
      </div>

      {canEdit && counter && !editing ? (
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
  );
}
