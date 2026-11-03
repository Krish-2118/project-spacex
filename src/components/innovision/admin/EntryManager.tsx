'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { httpErrorMessage } from '@/lib/api-errors';
import { REJECT_REASON_LABELS } from '@/lib/entry-shared';

/*
 * Admin "Entry" tab: venue check-in numbers and records. Read from GET /api/admin/entry/overview (admin only); voiding a
 * wrong check-in and reissuing a QR go through POST /api/admin/entry/{void,reissue}. Refreshes every 30 s by polling
 * (no realtime subscription). Counts are per registration: active passes and non-voided check-ins only.
 */

interface EntryManagerProps {
  getAuthToken: () => Promise<string | null>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setConfirmModal: (modal: {
    isOpen: boolean;
    title: string;
    message: string;
    actionText: string;
    actionType: 'approve' | 'reject' | 'role' | 'default';
    onConfirm: () => void;
  } | null) => void;
}

type List = 'registrations' | 'checkins' | 'rejections' | 'audit';
interface Counts { confirmed: number; checked_in: number; not_checked_in: number }
type Row = Record<string, unknown>;

const LISTS: { key: List; label: string }[] = [
  { key: 'registrations', label: 'REGISTRATIONS' },
  { key: 'checkins', label: 'RECENT CHECK-INS' },
  { key: 'rejections', label: 'REJECTED ATTEMPTS' },
  { key: 'audit', label: 'AUDIT LOG' },
];
const AUDIT_ACTIONS = ['', 'lookup', 'manual_lookup', 'check_in', 'reject', 'void', 'reissue'];
const POLL_MS = 30_000;
const GOLD = 'oklch(0.8 0.12 85)';

const s = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
const time = (v: unknown) => {
  if (typeof v !== 'string') return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit' });
};
const detailOf = (row: Row) => (row.detail && typeof row.detail === 'object' ? (row.detail as Record<string, unknown>) : {});

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)', borderBottom: '1px solid rgba(236,232,223,0.14)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid rgba(236,232,223,0.08)', verticalAlign: 'top' };
const smallBtn: React.CSSProperties = { padding: '6px 12px', border: '1px solid rgba(236,232,223,0.35)', background: 'transparent', color: '#ECE8DF', fontSize: '11px', fontWeight: 700, letterSpacing: '.12em', cursor: 'pointer', whiteSpace: 'nowrap' };
const input: React.CSSProperties = { minHeight: '40px', padding: '0 12px', background: 'rgba(236,232,223,0.06)', border: '1px solid rgba(236,232,223,0.2)', color: '#ECE8DF', fontSize: '14px' };

export default function EntryManager({ getAuthToken, showToast, setConfirmModal }: EntryManagerProps) {
  const [list, setList] = useState<List>('registrations');
  const [filter, setFilter] = useState<'all' | 'checked_in' | 'waiting'>('all');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [voiding, setVoiding] = useState<{ id: string; label: string } | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [busy, setBusy] = useState(false);
  const requestSeq = useRef(0);
  // AdminDashboard recreates getAuthToken on every render; read it through a ref so polling isn't restarted each time.
  const tokenRef = useRef(getAuthToken);
  useEffect(() => {
    tokenRef.current = getAuthToken;
  }, [getAuthToken]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const token = await tokenRef.current();
      const params = new URLSearchParams({ list, page: String(page) });
      if (query) params.set('q', query);
      if (list === 'registrations' && filter !== 'all') params.set('filter', filter);
      if (list === 'audit' && action) params.set('action', action);
      const res = await fetch(`/api/admin/entry/overview?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (seq !== requestSeq.current) return; // a newer request superseded this one
      if (!res.ok) throw new Error(httpErrorMessage(res) || body.error || 'Failed to load entry data.');
      setCounts(body.counts);
      setRows(Array.isArray(body.rows) ? body.rows : []);
      setHasMore(!!body.hasMore);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      if (seq === requestSeq.current) setError(err instanceof Error ? err.message : 'Failed to load entry data.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [list, page, query, filter, action]);

  // Initial load, then poll while the tab is visible.
  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const post = async (path: string, payload: unknown) => {
    const token = await tokenRef.current();
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(httpErrorMessage(res) || body.error || 'Request failed.');
    return body;
  };

  const submitVoid = async () => {
    if (!voiding) return;
    const reason = voidReason.replace(/\s+/g, ' ').trim();
    if (!reason) return showToast('A reason is required to void a check-in.', 'error');
    setBusy(true);
    try {
      await post('/api/admin/entry/void', { checkinId: voiding.id, reason });
      showToast(`Check-in for ${voiding.label} voided. They can be checked in again.`, 'success');
      setVoiding(null);
      setVoidReason('');
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not void the check-in.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const askReissue = (registration: string, label: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reissue entry QR?',
      message: `${label} gets a new QR on their profile and the current QR stops working immediately. Only possible before check-in.`,
      actionText: 'REISSUE QR',
      actionType: 'default',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await post('/api/admin/entry/reissue', { registration });
          showToast(`New QR issued for ${label}. Ask them to reopen their profile.`, 'success');
          void load();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not reissue the pass.', 'error');
        }
      },
    });
  };

  const switchList = (next: List) => {
    setList(next);
    setPage(1);
    setRows([]);
    setLoading(true);
  };

  const tiles: { label: string; value: number | undefined; color: string }[] = [
    { label: 'CONFIRMED', value: counts?.confirmed, color: '#ECE8DF' },
    { label: 'CHECKED IN', value: counts?.checked_in, color: 'oklch(0.75 0.16 145)' },
    { label: 'NOT YET CHECKED IN', value: counts?.not_checked_in, color: GOLD },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(236,232,223,0.6)' }}>
          Venue check-in · refreshes every 30 s{updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}` : ''}
        </p>
        <a href="/admin/scan" target="_blank" rel="noopener" style={{ ...smallBtn, textDecoration: 'none', color: GOLD, borderColor: GOLD }}>
          OPEN SCANNER ↗
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ padding: '18px 20px', background: 'rgba(236,232,223,0.04)', border: '1px solid rgba(236,232,223,0.12)' }}>
            <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '.16em', color: 'rgba(236,232,223,0.6)' }}>{t.label}</p>
            <p style={{ margin: 0, fontSize: '34px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: t.color }}>{t.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {LISTS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => switchList(l.key)}
            style={{ ...smallBtn, padding: '8px 14px', background: list === l.key ? 'rgba(236,232,223,0.1)' : 'transparent', borderColor: list === l.key ? GOLD : 'rgba(236,232,223,0.2)' }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={list === 'audit' || list === 'rejections' ? 'Search registration ID, name or staff' : 'Search registration ID, roll number or name'}
          aria-label="Search"
          style={{ ...input, flex: '1 1 260px' }}
        />
        {list === 'registrations' && (
          <select aria-label="Filter" value={filter} onChange={(e) => { setFilter(e.target.value as typeof filter); setPage(1); }} style={input}>
            <option value="all">All confirmed</option>
            <option value="checked_in">Checked in</option>
            <option value="waiting">Not yet checked in</option>
          </select>
        )}
        {list === 'audit' && (
          <select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} style={input}>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a ? a.replace('_', ' ') : 'All actions'}</option>)}
          </select>
        )}
      </div>

      {error && (
        <div role="alert" style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid oklch(0.74 0.15 35)', color: 'oklch(0.85 0.12 35)', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid rgba(236,232,223,0.12)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
          <thead>{headerFor(list)}</thead>
          <tbody>
            {rows.map((row) => (
              <EntryRow
                key={String(list === 'registrations' ? row.registration : row.id)}
                list={list}
                row={row}
                onVoid={(id, label) => { setVoidReason(''); setVoiding({ id, label }); }}
                onReissue={askReissue}
              />
            ))}
            {!rows.length && (
              <tr>
                <td style={{ ...td, textAlign: 'center', color: 'rgba(236,232,223,0.6)' }} colSpan={8}>
                  {loading ? 'Loading…' : 'Nothing here yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" style={smallBtn} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>PREV</button>
        <span style={{ fontSize: '13px', color: 'rgba(236,232,223,0.7)' }}>Page {page}</span>
        <button type="button" style={smallBtn} disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>NEXT</button>
      </div>

      {voiding && (
        <div role="dialog" aria-modal="true" aria-labelledby="void-title" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ width: 'min(440px, 100%)', padding: '24px', background: '#1a1917', border: '1.5px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 id="void-title" style={{ margin: 0, fontSize: '18px' }}>Void check-in for {voiding.label}?</h3>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'rgba(236,232,223,0.75)' }}>
              The record is kept and marked voided; the registration can then be checked in again. A reason is required.
            </p>
            <input
              autoFocus
              value={voidReason}
              maxLength={200}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Scanned the wrong person"
              aria-label="Reason"
              style={input}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" style={smallBtn} onClick={() => setVoiding(null)} disabled={busy}>CANCEL</button>
              <button type="button" style={{ ...smallBtn, background: '#dc2626', borderColor: '#dc2626', color: '#fff' }} onClick={submitVoid} disabled={busy}>
                {busy ? 'VOIDING…' : 'VOID CHECK-IN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function headerFor(list: List) {
  const cols =
    list === 'registrations' ? ['REG. ID', 'NAME', 'ROLL NO.', 'COLLEGE', 'CHECKED IN', 'BY / DESK', '']
    : list === 'checkins' ? ['TIME', 'REG. ID', 'NAME', 'ROLL NO.', 'BY', 'DESK', 'STATUS', '']
    : list === 'rejections' ? ['TIME', 'REG. ID', 'NAME', 'REASON', 'NOTE', 'BY']
    : ['TIME', 'ACTION', 'REG. ID', 'NAME', 'BY', 'DETAIL'];
  return <tr>{cols.map((c, i) => <th key={i} style={th}>{c}</th>)}</tr>;
}

function EntryRow({ list, row, ...actions }: {
  list: List;
  row: Row;
  onVoid: (id: string, label: string) => void;
  onReissue: (registration: string, label: string) => void;
}) {
  const label = `${s(row.registration_id)} (${s(row.name)})`;
  if (list === 'registrations') {
    const checked = typeof row.checkin_id === 'string';
    return (
      <tr>
        <td style={{ ...td, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s(row.registration_id)}</td>
        <td style={td}>{s(row.name)}</td>
        <td style={td}>{s(row.enrollment_no)}</td>
        <td style={td}>{s(row.college)}</td>
        <td style={{ ...td, color: checked ? 'oklch(0.75 0.16 145)' : 'rgba(236,232,223,0.6)' }}>{checked ? time(row.checked_in_at) : 'Not yet'}</td>
        <td style={td}>{checked ? `${s(row.checked_in_by)} · ${s(row.desk)}${row.method === 'manual' ? ' (manual)' : ''}` : '—'}</td>
        <td style={{ ...td, textAlign: 'right' }}>
          {checked ? (
            <button type="button" style={smallBtn} onClick={() => actions.onVoid(String(row.checkin_id), label)}>VOID</button>
          ) : row.pass_id ? (
            <button type="button" style={smallBtn} onClick={() => actions.onReissue(String(row.registration), label)}>REISSUE QR</button>
          ) : null}
        </td>
      </tr>
    );
  }
  if (list === 'checkins') {
    const voided = typeof row.voided_at === 'string';
    return (
      <tr style={{ opacity: voided ? 0.6 : 1 }}>
        <td style={td}>{time(row.created_at)}</td>
        <td style={{ ...td, fontWeight: 700 }}>{s(row.registration_id)}</td>
        <td style={td}>{s(row.name)}</td>
        <td style={td}>{s(row.enrollment_no)}</td>
        <td style={td}>{s(row.checked_in_by)}</td>
        <td style={td}>{s(row.desk)}{row.method === 'manual' ? ' (manual)' : ''}</td>
        <td style={td}>{voided ? `Voided by ${s(row.voided_by)}: ${s(row.void_reason)}` : 'Valid'}</td>
        <td style={{ ...td, textAlign: 'right' }}>
          {!voided && <button type="button" style={smallBtn} onClick={() => actions.onVoid(String(row.id), label)}>VOID</button>}
        </td>
      </tr>
    );
  }
  const d = detailOf(row);
  if (list === 'rejections') {
    return (
      <tr>
        <td style={td}>{time(row.created_at)}</td>
        <td style={{ ...td, fontWeight: 700 }}>{s(row.registration_id)}</td>
        <td style={td}>{s(row.name)}</td>
        <td style={td}>{REJECT_REASON_LABELS[String(d.reason)] ?? s(d.reason)}</td>
        <td style={td}>{s(d.note)}</td>
        <td style={td}>{s(row.actor_name ?? row.actor_email)}</td>
      </tr>
    );
  }
  const detail = [
    d.result ? `result: ${d.result}` : '',
    d.desk ? `desk: ${d.desk}` : '',
    d.method ? `via ${d.method}` : '',
    d.query ? `query: ${d.query}` : '',
    d.reason ? `reason: ${REJECT_REASON_LABELS[String(d.reason)] ?? d.reason}` : '',
    d.note ? `note: ${d.note}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <tr>
      <td style={td}>{time(row.created_at)}</td>
      <td style={td}>{s(row.action).replace('_', ' ')}</td>
      <td style={{ ...td, fontWeight: 700 }}>{s(row.registration_id)}</td>
      <td style={td}>{s(row.name)}</td>
      <td style={td}>{s(row.actor_name ?? row.actor_email)}</td>
      <td style={{ ...td, color: 'rgba(236,232,223,0.75)' }}>{detail || '—'}</td>
    </tr>
  );
}
