'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { httpErrorMessage } from '@/lib/api-errors';
import { csvCell, formatReferralCode } from '@/lib/validation';

/*
 * Admin "Ambassadors" tab (admins and the registration team): the Campus Ambassador programme's only portal.
 * Students become ambassadors themselves with GET MY CODE on the home page; here staff see every ambassador, how to
 * reach them, and the registrations their permanent CA code brought in. Confirmed counts registrations whose payment
 * was approved and decides the rank; pending ones are still under review; rejected ones never count. There is no
 * target or limit. Revoking stops the code for new registrations and keeps the ones already made.
 * Read and written through /api/admin/ambassadors; an ambassador's registrations through /api/admin/registrations.
 */

interface AmbassadorsManagerProps {
  getAuthToken: () => Promise<string | null>;
}

interface Ambassador {
  rank: number | null;
  id: string;
  code: string;
  name: string;
  email: string;
  /** From the ambassador's profile (the site asks every signed-in user for one). */
  phone: string | null;
  college: string | null;
  status: 'active' | 'revoked';
  /** When they first tapped GET MY CODE. */
  created_at: string;
  confirmed_registrations: number;
  pending_registrations: number;
}

interface ReferredRegistration {
  id: string;
  registration_id: string;
  name: string;
  college: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}

const GOLD = 'oklch(0.8 0.12 85)';
const BAD = 'oklch(0.85 0.12 35)';
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)', borderBottom: '1px solid rgba(236,232,223,0.14)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid rgba(236,232,223,0.08)', verticalAlign: 'top' };
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 };
const smallBtn: React.CSSProperties = { padding: '6px 12px', border: '1px solid rgba(236,232,223,0.35)', background: 'transparent', color: '#ECE8DF', fontSize: '11px', fontWeight: 700, letterSpacing: '.12em', cursor: 'pointer', whiteSpace: 'nowrap' };
const dangerBtn: React.CSSProperties = { ...smallBtn, borderColor: 'oklch(0.74 0.15 35)', color: BAD };
const input: React.CSSProperties = { minHeight: '40px', padding: '0 12px', background: 'rgba(236,232,223,0.06)', border: '1px solid rgba(236,232,223,0.2)', color: '#ECE8DF', fontSize: '14px' };
const note: React.CSSProperties = { margin: 0, maxWidth: '760px', fontSize: '13px', lineHeight: 1.5, color: 'rgba(236,232,223,0.6)' };
const contactLink: React.CSSProperties = { color: 'rgba(236,232,223,0.7)', textDecoration: 'none', wordBreak: 'break-all' };

/*
 * Phones (up to 760px): the table becomes one card per ambassador. Name and contacts on top, then the counts, rank and
 * code, college and join date in two columns, and the actions as full-size buttons; an opened row (edit, registrations)
 * attaches below its card. The data-label of each cell titles it on a card.
 */
const RESPONSIVE_CSS = `
  .amb-tile { flex: 1 1 160px; min-width: 0; }
  @media (max-width: 760px) {
    .amb-note { font-size: 12px !important; }
    .amb-tiles { gap: 8px !important; }
    .amb-tile { flex: 1 1 calc(50% - 4px); padding: 10px 12px !important; }
    .amb-tile-label { font-size: 10px !important; letter-spacing: .1em !important; }
    .amb-tile-value { margin-top: 4px !important; font-size: 18px !important; }
    .amb-head { flex-direction: column; align-items: stretch !important; }
    .amb-head-actions { justify-content: stretch; }
    .amb-head-actions > button { flex: 1 1 0; min-height: 44px; }
    .amb-scroll { overflow: visible !important; border: 0 !important; }
    .amb-table { min-width: 0 !important; display: block; }
    .amb-table > thead { display: none; }
    .amb-table > tbody { display: flex; flex-direction: column; gap: 12px; }
    .amb-table > tbody > tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 14px; padding: 14px; border: 1px solid rgba(236,232,223,0.14); background: rgba(236,232,223,0.03); }
    .amb-table > tbody > tr.amb-sub { margin-top: -13px; border-top: 0; background: rgba(236,232,223,0.05); }
    .amb-table > tbody > tr > td { display: block; padding: 6px 0 !important; border: 0 !important; text-align: left !important; min-width: 0; }
    .amb-table > tbody > tr > td[data-label]::before { content: attr(data-label); display: block; margin-bottom: 2px; font-size: 10px; font-weight: 700; letter-spacing: .14em; color: rgba(236,232,223,0.5); }
    .amb-c-name { grid-column: 1 / -1; order: 1; font-size: 15px !important; }
    .amb-c-confirmed { order: 2; font-size: 20px !important; }
    .amb-c-pending { order: 3; font-size: 20px !important; }
    .amb-c-rank { order: 4; }
    .amb-c-code { order: 5; }
    .amb-c-college { order: 6; }
    .amb-c-joined { order: 7; }
    .amb-c-actions { grid-column: 1 / -1; order: 8; padding-top: 10px !important; }
    .amb-c-wide { grid-column: 1 / -1; }
    .amb-actions > button { flex: 1 1 calc(50% - 6px); min-height: 44px; }
    .amb-contact { display: inline-block; padding: 6px 0; font-size: 14px !important; }
    .amb-edit > input { flex: 1 1 100% !important; min-height: 44px; }
    .amb-edit > button { flex: 1 1 0; min-height: 44px; }
    .amb-regs > thead { display: none; }
    .amb-regs, .amb-regs > tbody { display: block; }
    .amb-regs > tbody > tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; padding: 10px 0; border-bottom: 1px solid rgba(236,232,223,0.1); }
    .amb-regs > tbody > tr > td { display: block; padding: 0 !important; border: 0 !important; }
    .amb-regs > tbody > tr > td:nth-child(1) { grid-column: 1; grid-row: 2; font-size: 12px; color: rgba(236,232,223,0.6); }
    .amb-regs > tbody > tr > td:nth-child(2) { grid-column: 1; grid-row: 1; font-weight: 600; }
    .amb-regs > tbody > tr > td:nth-child(3) { grid-column: 1 / -1; grid-row: 3; font-size: 12px; color: rgba(236,232,223,0.6); }
    .amb-regs > tbody > tr > td:nth-child(4) { grid-column: 2; grid-row: 1; text-align: right; }
    .amb-regs > tbody > tr > td:nth-child(5) { grid-column: 2; grid-row: 2; text-align: right; font-size: 12px; color: rgba(236,232,223,0.6); }
  }
`;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const statusColor = (s: string) => (s === 'confirmed' ? 'oklch(0.8 0.14 150)' : s === 'rejected' ? BAD : GOLD);

export default function AmbassadorsManager({ getAuthToken }: AmbassadorsManagerProps) {
  const [rows, setRows] = useState<Ambassador[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Destructive actions ask once inline ("CONFIRM?") instead of a browser dialog.
  const [confirming, setConfirming] = useState<{ id: string; action: 'revoke' | 'delete' } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [referred, setReferred] = useState<{ id: string; list: ReferredRegistration[]; loading: boolean; error: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; college: string } | null>(null);
  const requestSeq = useRef(0);
  // AdminDashboard recreates getAuthToken on every render; read it through a ref so loading isn't restarted each time.
  const tokenRef = useRef(getAuthToken);
  useEffect(() => {
    tokenRef.current = getAuthToken;
  }, [getAuthToken]);

  const call = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await tokenRef.current();
    const res = await fetch(path, {
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(httpErrorMessage(res) || body.error || 'Request failed.');
    return body;
  }, []);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const body = await call('/api/admin/ambassadors');
      if (seq !== requestSeq.current) return; // a newer request superseded this one
      setRows(Array.isArray(body.ambassadors) ? body.ambassadors : []);
      setTruncated(!!body.truncated);
      setError('');
    } catch (err) {
      if (seq === requestSeq.current) setError(err instanceof Error ? err.message : 'Failed to load ambassadors.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(null), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  const patch = async (id: string, payload: Record<string, unknown>, done: string) => {
    setBusyId(id);
    setConfirming(null);
    setError('');
    setNotice('');
    try {
      await call('/api/admin/ambassadors', { method: 'PATCH', body: JSON.stringify({ id, ...payload }) });
      setNotice(done);
      setEditing(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the ambassador.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a: Ambassador) => {
    setBusyId(a.id);
    setConfirming(null);
    setError('');
    setNotice('');
    try {
      await call(`/api/admin/ambassadors?id=${encodeURIComponent(a.id)}`, { method: 'DELETE' });
      setNotice(`${a.name} was removed.`);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the ambassador.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleOpen = async (a: Ambassador) => {
    if (openId === a.id) { setOpenId(null); return; }
    setOpenId(a.id);
    setReferred({ id: a.id, list: [], loading: true, error: '' });
    try {
      const body = await call(`/api/admin/registrations?ambassador=${encodeURIComponent(a.id)}`);
      setReferred({ id: a.id, list: Array.isArray(body.registrations) ? body.registrations : [], loading: false, error: '' });
    } catch (err) {
      setReferred({ id: a.id, list: [], loading: false, error: err instanceof Error ? err.message : 'Failed to load registrations.' });
    }
  };

  const ask = (id: string, action: 'revoke' | 'delete') => setConfirming({ id, action });
  const isAsking = (id: string, action: string) => confirming?.id === id && confirming.action === action;

  const q = search.trim().toLowerCase();
  const shown = rows
    .filter((r) => !onlyActive || r.confirmed_registrations + r.pending_registrations > 0)
    .filter((r) => !q || [r.name, r.email, r.phone ?? '', r.college ?? '', r.code, formatReferralCode(r.code)].some((f) => f.toLowerCase().includes(q)));
  const totals = rows.reduce(
    (t, r) => ({
      active: t.active + (r.status === 'active' ? 1 : 0),
      bringing: t.bringing + (r.confirmed_registrations > 0 ? 1 : 0),
      confirmed: t.confirmed + r.confirmed_registrations,
      pending: t.pending + r.pending_registrations,
    }),
    { active: 0, bringing: 0, confirmed: 0, pending: 0 }
  );

  const exportCsv = () => {
    const headers = ['Rank', 'Name', 'Email', 'Phone', 'College', 'Code', 'Status', 'Confirmed', 'Pending', 'Joined At'];
    const lines = rows.map((r) => [
      r.rank ?? '', r.name, r.email, r.phone ?? '', r.college ?? '', formatReferralCode(r.code), r.status,
      r.confirmed_registrations, r.pending_registrations, r.created_at,
    ].map(csvCell).join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `innovision_campus_ambassadors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{RESPONSIVE_CSS}</style>
      <div className="amb-head" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <p className="amb-note" style={note}>
          Students who took a campus ambassador code with GET MY CODE, and the registrations it brought in.{' '}
          <strong style={{ color: '#ECE8DF' }}>Confirmed</strong> counts registrations whose payment was approved and
          decides the rank; <strong style={{ color: '#ECE8DF' }}>Pending</strong> are still under review. Rejected ones
          never count. There is no target or limit.
        </p>
        <div className="amb-head-actions" style={{ display: 'flex', gap: '8px' }}>
          <button type="button" style={smallBtn} onClick={exportCsv} disabled={!rows.length}>EXPORT CSV</button>
          <button type="button" style={smallBtn} onClick={() => void load()} disabled={loading}>{loading ? 'LOADING…' : 'REFRESH'}</button>
        </div>
      </div>

      <div className="amb-tiles" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {([
          ['AMBASSADORS', totals.active, '#ECE8DF'],
          ['WITH A CONFIRMED REGISTRATION', totals.bringing, '#ECE8DF'],
          ['CONFIRMED REGISTRATIONS', totals.confirmed, GOLD],
          ['PENDING REVIEW', totals.pending, '#ECE8DF'],
        ] as const).map(([label, value, color]) => (
          <div key={label} className="amb-tile" style={{ padding: '14px 16px', border: '1px solid rgba(236,232,223,0.12)', background: 'rgba(236,232,223,0.03)' }}>
            <div className="amb-tile-label" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.55)' }}>{label}</div>
            <div className="amb-tile-value" style={{ marginTop: '6px', fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, college or code"
          aria-label="Search ambassadors"
          style={{ ...input, flex: '1 1 280px', boxSizing: 'border-box' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', fontSize: '13px', color: 'rgba(236,232,223,0.75)', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Only ambassadors with registrations
        </label>
      </div>

      {error && (
        <div role="alert" style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid oklch(0.74 0.15 35)', color: BAD, fontSize: '14px' }}>
          {error}
        </div>
      )}
      {notice && !error && <div role="status" style={{ fontSize: '13px', color: GOLD }}>{notice}</div>}
      {truncated && <div role="alert" style={{ fontSize: '13px', color: BAD }}>Only the first 1000 ambassadors are listed.</div>}

      <div className="amb-scroll" style={{ overflowX: 'auto', border: '1px solid rgba(236,232,223,0.12)' }}>
        <table className="amb-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
          <thead>
            <tr>
              <th style={th}>RANK</th>
              <th style={th}>AMBASSADOR</th>
              <th style={th}>COLLEGE</th>
              <th style={th}>CODE</th>
              <th style={th}>JOINED</th>
              <th style={{ ...th, textAlign: 'right' }}>CONFIRMED</th>
              <th style={{ ...th, textAlign: 'right' }}>PENDING</th>
              <th style={th}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => {
              const busy = busyId === a.id;
              const revoked = a.status === 'revoked';
              return (
                <React.Fragment key={a.id}>
                  <tr style={{ opacity: revoked ? 0.6 : 1 }}>
                    <td className="amb-c-rank" data-label="RANK" style={{ ...num, textAlign: 'left', color: !revoked && a.confirmed_registrations > 0 && (a.rank ?? 99) <= 3 ? GOLD : '#ECE8DF' }}>
                      {revoked ? '—' : a.confirmed_registrations > 0 ? `#${a.rank}` : '—'}
                    </td>
                    <td className="amb-c-name" style={td}>
                      <div style={{ fontWeight: 600 }}>{a.name}{revoked && <span style={{ marginLeft: '8px', fontSize: '10px', letterSpacing: '.14em', color: BAD }}>REVOKED</span>}</div>
                      <div style={{ fontSize: '12px' }}><a href={`mailto:${a.email}`} className="amb-contact" style={contactLink}>{a.email}</a></div>
                      <div style={{ fontSize: '12px' }}>
                        {a.phone ? <a href={`tel:+91${a.phone}`} className="amb-contact" style={contactLink}>+91 {a.phone}</a> : <span style={{ color: 'rgba(236,232,223,0.45)' }}>No phone yet</span>}
                      </div>
                    </td>
                    <td className="amb-c-college" data-label="COLLEGE" style={td}>{a.college || '—'}</td>
                    <td className="amb-c-code" data-label="CODE" style={{ ...td, fontFamily: 'monospace', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>{formatReferralCode(a.code)}</td>
                    <td className="amb-c-joined" data-label="JOINED" style={{ ...td, whiteSpace: 'nowrap' }}>{shortDate(a.created_at)}</td>
                    <td className="amb-c-confirmed" data-label="CONFIRMED" style={{ ...num, color: GOLD, fontSize: '15px' }}>{a.confirmed_registrations}</td>
                    <td className="amb-c-pending" data-label="PENDING" style={{ ...num, color: 'rgba(236,232,223,0.7)' }}>{a.pending_registrations}</td>
                    <td className="amb-c-actions" style={td}>
                      <div className="amb-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <button type="button" style={smallBtn} onClick={() => void toggleOpen(a)} aria-expanded={openId === a.id}>
                          {openId === a.id ? 'HIDE' : 'REGISTRATIONS'}
                        </button>
                        <button type="button" style={smallBtn} disabled={busy} onClick={() => setEditing({ id: a.id, name: a.name, college: a.college ?? '' })}>EDIT</button>
                        {revoked ? (
                          <button type="button" style={smallBtn} disabled={busy} onClick={() => void patch(a.id, { action: 'restore' }, `${a.name}'s code works again.`)}>RESTORE</button>
                        ) : (
                          <button type="button" style={dangerBtn} disabled={busy} onClick={() => (isAsking(a.id, 'revoke') ? void patch(a.id, { action: 'revoke' }, `${a.name}'s code was revoked.`) : ask(a.id, 'revoke'))}>
                            {isAsking(a.id, 'revoke') ? 'CONFIRM REVOKE?' : 'REVOKE'}
                          </button>
                        )}
                        {a.confirmed_registrations + a.pending_registrations === 0 && (
                          <button type="button" style={dangerBtn} disabled={busy} onClick={() => (isAsking(a.id, 'delete') ? void remove(a) : ask(a.id, 'delete'))}>
                            {isAsking(a.id, 'delete') ? 'CONFIRM DELETE?' : 'DELETE'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editing?.id === a.id && (
                    <tr className="amb-sub">
                      <td className="amb-c-wide" style={td} colSpan={8}>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const changes: Record<string, string | null> = {};
                            if (editing.name.trim() !== a.name) changes.name = editing.name;
                            if (editing.college.trim() !== (a.college ?? '')) changes.college = editing.college.trim() || null;
                            if (!Object.keys(changes).length) { setEditing(null); return; }
                            void patch(a.id, changes, `${editing.name.trim() || a.name} was updated.`);
                          }}
                          className="amb-edit"
                          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}
                        >
                          <input aria-label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={{ ...input, flex: '1 1 180px' }} />
                          <input aria-label="College" value={editing.college} onChange={(e) => setEditing({ ...editing, college: e.target.value })} placeholder="College" style={{ ...input, flex: '2 1 240px' }} />
                          <button type="submit" style={{ ...smallBtn, background: '#ECE8DF', color: '#141312' }} disabled={busy}>SAVE</button>
                          <button type="button" style={smallBtn} onClick={() => setEditing(null)}>CANCEL</button>
                        </form>
                      </td>
                    </tr>
                  )}
                  {openId === a.id && referred?.id === a.id && (
                    <tr className="amb-sub">
                      <td className="amb-c-wide" style={{ ...td, background: 'rgba(236,232,223,0.03)' }} colSpan={8}>
                        {referred.loading ? 'Loading registrations…' : referred.error ? <span style={{ color: BAD }}>{referred.error}</span> : !referred.list.length ? 'Nobody has registered with this code yet.' : (
                          <table className="amb-regs" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr><th style={th}>REGISTRATION</th><th style={th}>NAME</th><th style={th}>COLLEGE</th><th style={th}>STATUS</th><th style={th}>REGISTERED</th></tr>
                            </thead>
                            <tbody>
                              {referred.list.map((r) => (
                                <tr key={r.id}>
                                  <td style={{ ...td, fontFamily: 'monospace' }}>{r.registration_id}</td>
                                  <td style={td}>{r.name}</td>
                                  <td style={td}>{r.college}</td>
                                  <td style={{ ...td, color: statusColor(r.status), fontWeight: 700, fontSize: '11px', letterSpacing: '.12em' }}>{r.status.toUpperCase()}</td>
                                  <td style={td}>{shortDate(r.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!shown.length && (
              <tr>
                <td className="amb-c-wide" style={{ ...td, textAlign: 'center', color: 'rgba(236,232,223,0.6)' }} colSpan={8}>
                  {loading ? 'Loading…' : q || onlyActive ? 'No ambassadors match.' : 'No campus ambassadors yet. Students appear here once they tap GET MY CODE.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
