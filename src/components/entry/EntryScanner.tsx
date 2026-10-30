'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fetchSessionFromDatabase, getCookie, getSupabase } from '@/lib/supabase';
import { DESK_RE, REJECT_REASONS, REJECT_REASON_LABELS, type RejectReason } from '@/lib/entry-shared';
import styles from './EntryScanner.module.css';

/*
 * Check-in scanner for the registration team. Every decision is the server's: this page only shows what
 * /api/admin/entry/* answered. It never shows green without a server-confirmed answer: no answer, a timeout or a
 * server error is UNVERIFIED (grey, with Retry), and an expired session is its own screen.
 * UI says "Approve"; in the code and the database this is a check-in (registration approval is something else).
 */

interface Details {
  registration: string;
  registration_id: string;
  name: string;
  enrollment_no: string | null;
  college: string;
  phone: string;
  utr: string | null;
}
interface CheckInInfo {
  registration_id?: string;
  name?: string;
  checked_in_at: string;
  checked_in_by?: string;
  desk: string;
  method?: string;
}
type EntryResult =
  | ({ state: 'VALID' } & Details)
  | ({ state: 'CHECKED_IN' } & CheckInInfo)
  | ({ state: 'ALREADY_CHECKED_IN' } & CheckInInfo)
  | { state: 'INVALID'; reason: string }
  | { state: 'REJECTED'; registration_id: string; reason: string }
  | { state: 'AMBIGUOUS'; count: number };

type Source = { token: string } | { registration: string };

type View =
  | { kind: 'scanning' }
  | { kind: 'busy'; label: string }
  | { kind: 'valid'; details: Details; source: Source; scanId: string }
  | { kind: 'reject'; details: Details; source: Source; scanId: string }
  | { kind: 'checked_in'; info: CheckInInfo }
  | { kind: 'already'; info: CheckInInfo }
  | { kind: 'invalid'; reason: string }
  | { kind: 'rejected'; registrationId: string; reason: string }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'refused'; message: string }
  | { kind: 'unverified'; message: string; retry: () => void }
  | { kind: 'session' }
  | { kind: 'manual' };

type CallResult =
  | { kind: 'ok'; result: EntryResult }
  | { kind: 'refused'; message: string }
  | { kind: 'unverified'; message: string }
  | { kind: 'session' };

type CameraState =
  | { status: 'starting' }
  | { status: 'on' }
  | { status: 'denied' }
  | { status: 'missing' }
  | { status: 'insecure' }
  | { status: 'error'; message: string };

const DESK_KEY = 'inv_entry_desk';
const REQUEST_TIMEOUT_MS = 8000;
const SAME_CODE_IGNORE_MS = 3000;
const DESK_SUGGESTIONS = ['Gate 1', 'Gate 2', 'Main Gate', 'Help Desk'];
const LOGIN_URL = '/?auth=login&required=scan'; // the home page returns to /admin/scan after login

const INVALID_REASONS: Record<string, string> = {
  unknown: 'This QR is not an Innovision entry pass.',
  revoked: 'This pass was replaced or cancelled.',
  not_confirmed: 'This registration is not confirmed.',
  not_found: 'No confirmed registration matches.',
};

// ---- session and requests ------------------------------------------------------------------------------------

/** A current access token. supabase-js refreshes an expired one before returning it. */
async function currentToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  } catch {}
  await fetchSessionFromDatabase();
  return getCookie('inn_access_token');
}

/** After a 401: force a refresh (the auto-refresh timer is throttled on phones), else the server-side refresh. */
async function refreshedToken(): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().auth.refreshSession();
    if (!error && data.session?.access_token) return data.session.access_token;
  } catch {}
  await fetchSessionFromDatabase();
  return getCookie('inn_access_token');
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

async function send(path: string, body: unknown, token: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function post(path: string, body: unknown): Promise<CallResult> {
  const noAnswer = (message: string): CallResult => ({ kind: 'unverified', message });
  try {
    let token = await currentToken();
    if (!token) return offline() ? noAnswer('This phone is offline.') : { kind: 'session' };
    let res = await send(path, body, token);
    if (res.status === 401) {
      token = await refreshedToken();
      if (!token) return offline() ? noAnswer('This phone is offline.') : { kind: 'session' };
      res = await send(path, body, token);
      if (res.status === 401) return { kind: 'session' };
    }
    const data = await res.json().catch(() => null);
    if (res.ok && data?.result) return { kind: 'ok', result: data.result as EntryResult };
    if (res.status === 429) return noAnswer(data?.error || 'Too many requests. Wait a few seconds, then retry.');
    if (res.status >= 500 || !data) return noAnswer(`The server did not confirm (HTTP ${res.status}).`);
    return { kind: 'refused', message: data.error || `Request refused (HTTP ${res.status}).` };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError';
    return noAnswer(timedOut ? 'No answer from the server within 8 seconds.' : 'Network error. Check the connection.');
  }
}

function newScanId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit' });
};

const noSubscription = () => () => {};

function readDesk(): string {
  try {
    const d = localStorage.getItem(DESK_KEY) || '';
    return DESK_RE.test(d) ? d : '';
  } catch {
    return '';
  }
}

// ---- feedback ----------------------------------------------------------------------------------------------------

type Tone = 'ok' | 'warn' | 'bad';

// Native BarcodeDetector is not in TypeScript's DOM lib yet.
interface DetectedCode { rawValue: string }
interface NativeBarcodeDetector { detect(source: HTMLVideoElement): Promise<DetectedCode[]> }
interface NativeBarcodeDetectorClass {
  new (opts: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

export default function EntryScanner({ staffLabel }: { staffLabel: string }) {
  // The desk chosen earlier on this phone (localStorage; per device, never shared). null while server rendering.
  const storedDesk = useSyncExternalStore(noSubscription, readDesk, () => null);
  const [chosenDesk, setChosenDesk] = useState<string | null>(null);
  const desk = chosenDesk ?? storedDesk ?? '';
  const deskReady = storedDesk !== null;
  const [editingDesk, setEditingDesk] = useState(false);
  const showDeskForm = editingDesk || !desk;
  const [deskDraft, setDeskDraft] = useState('');
  const [view, setView] = useState<View>({ kind: 'scanning' });
  const [camera, setCamera] = useState<CameraState>({ status: 'starting' });
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [manualQuery, setManualQuery] = useState('');
  const [rejectReason, setRejectReason] = useState<RejectReason | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [formError, setFormError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const viewRef = useRef<View>(view);
  const lastCodeRef = useRef<{ value: string; at: number } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const onCodeRef = useRef<(value: string) => void>(() => {});

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // The page loaded with a valid session: allow SessionRestore to try again some other time.
  useEffect(() => {
    try { sessionStorage.removeItem('inv_scan_restore'); } catch {}
  }, []);

  // Audio must be unlocked by a tap; every button calls this.
  const unlockAudio = () => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      }
      void audioRef.current?.resume();
    } catch {}
  };

  const feedback = useCallback((tone: Tone) => {
    try {
      navigator.vibrate?.(tone === 'ok' ? [90] : tone === 'warn' ? [70, 60, 70] : [300]);
    } catch {}
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== 'running') return;
    try {
      const notes = tone === 'ok' ? [880, 1320] : tone === 'warn' ? [520, 520] : [220];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.16;
        osc.frequency.value = freq;
        osc.type = tone === 'bad' ? 'square' : 'sine';
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (tone === 'bad' ? 0.45 : 0.14));
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    } catch {}
  }, []);

  const showResult = useCallback((result: EntryResult, source: Source | null, scanId: string) => {
    switch (result.state) {
      case 'VALID':
        if (!source) source = { registration: result.registration };
        feedback('ok');
        setRejectReason(null);
        setRejectNote('');
        setFormError('');
        setView({ kind: 'valid', details: result, source, scanId });
        return;
      case 'CHECKED_IN':
        feedback('ok');
        setView({ kind: 'checked_in', info: result });
        return;
      case 'ALREADY_CHECKED_IN':
        feedback('warn');
        setView({ kind: 'already', info: result });
        return;
      case 'REJECTED':
        feedback('warn');
        setView({ kind: 'rejected', registrationId: result.registration_id, reason: result.reason });
        return;
      case 'AMBIGUOUS':
        feedback('warn');
        setView({ kind: 'ambiguous', count: result.count });
        return;
      default:
        feedback('bad');
        setView({ kind: 'invalid', reason: result.state === 'INVALID' ? result.reason : 'unknown' });
    }
  }, [feedback]);

  const handle = useCallback((r: CallResult, source: Source | null, scanId: string, retry: () => void) => {
    if (r.kind === 'ok') return showResult(r.result, source, scanId);
    if (r.kind === 'session') return setView({ kind: 'session' });
    feedback('bad');
    if (r.kind === 'refused') return setView({ kind: 'refused', message: r.message });
    setView({ kind: 'unverified', message: r.message, retry });
  }, [feedback, showResult]);

  const lookupToken = useCallback(async (token: string) => {
    const scanId = newScanId();
    const run = async () => {
      setView({ kind: 'busy', label: 'Checking pass…' });
      handle(await post('/api/admin/entry/lookup', { token }), { token }, scanId, run);
    };
    await run();
  }, [handle]);

  const lookupManual = async (query: string) => {
    const scanId = newScanId();
    const run = async () => {
      setView({ kind: 'busy', label: 'Looking up…' });
      handle(await post('/api/admin/entry/manual-lookup', { query }), null, scanId, run);
    };
    await run();
  };

  // Approve = check-in. The same scanId on every retry, so a retry after a lost answer is recognised as the same tap.
  const approve = async (source: Source, scanId: string) => {
    unlockAudio();
    const run = async () => {
      setView({ kind: 'busy', label: 'Checking in…' });
      handle(await post('/api/admin/entry/check-in', { ...source, scanId, desk }), source, scanId, run);
    };
    await run();
  };

  const submitReject = async (details: Details, source: Source, scanId: string) => {
    unlockAudio();
    if (!rejectReason) return setFormError('Choose a reason.');
    const note = rejectNote.replace(/\s+/g, ' ').trim();
    if (rejectReason === 'other' && !note) return setFormError('Describe the reason.');
    const body = { ...source, reason: rejectReason, note: note || undefined };
    const run = async () => {
      setView({ kind: 'busy', label: 'Logging rejection…' });
      const r = await post('/api/admin/entry/reject', body);
      if (r.kind === 'refused') {
        // A validation message: stay on the form.
        feedback('bad');
        setFormError(r.message);
        setView({ kind: 'reject', details, source, scanId });
        return;
      }
      handle(r, source, scanId, run);
    };
    await run();
  };

  // Every sighting of a code refreshes its timestamp, so a QR held in front of the camera is looked up once, and
  // again only after it has been out of view for SAME_CODE_IGNORE_MS.
  useEffect(() => {
    onCodeRef.current = (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      const now = Date.now();
      const last = lastCodeRef.current;
      const repeat = last && last.value === value && now - last.at < SAME_CODE_IGNORE_MS;
      lastCodeRef.current = { value, at: now };
      if (repeat || viewRef.current.kind !== 'scanning') return;
      viewRef.current = { kind: 'busy', label: '' }; // before the re-render, so the next frame can't start a second lookup
      void lookupToken(value);
    };
  }, [lookupToken]);

  // Camera: native BarcodeDetector where available, else ZXing (iOS Safari). Restarted when the page comes back to
  // the foreground (mobile browsers suspend the camera in the background).
  useEffect(() => {
    if (!deskReady || showDeskForm) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let zxing: { stop(): void } | null = null;

    (async () => {
      setCamera({ status: 'starting' });
      if (!window.isSecureContext) return setCamera({ status: 'insecure' });
      if (!navigator.mediaDevices?.getUserMedia) return setCamera({ status: 'error', message: 'This browser cannot open the camera.' });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') return setCamera({ status: 'denied' });
        if (name === 'NotFoundError' || name === 'OverconstrainedError') return setCamera({ status: 'missing' });
        return setCamera({ status: 'error', message: 'The camera could not be started. Close other apps using it and retry.' });
      }
      if (stopped || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setCamera({ status: 'on' });

      const Native = (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorClass }).BarcodeDetector;
      let native = false;
      if (Native) {
        try {
          const formats = await Native.getSupportedFormats?.();
          native = !formats || formats.includes('qr_code');
        } catch {}
      }
      if (native && Native) {
        const detector = new Native({ formats: ['qr_code'] });
        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) onCodeRef.current(codes[0].rawValue);
            } catch {}
          }
          timer = setTimeout(tick, 150);
        };
        void tick();
      } else {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (stopped) return;
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
        zxing = await reader.decodeFromStream(stream, video, (result) => {
          if (result) onCodeRef.current(result.getText());
        });
        if (stopped) zxing.stop();
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      zxing?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [desk, deskReady, showDeskForm, cameraAttempt]);

  // Back in the foreground: refresh the session early and restart the camera.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void getSupabase().auth.getSession().catch(() => {});
      setCameraAttempt((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const saveDesk = () => {
    unlockAudio();
    const value = deskDraft.replace(/\s+/g, ' ').trim();
    if (!DESK_RE.test(value)) return setFormError('Use letters and digits, up to 40 characters (e.g. Gate 1).');
    try { localStorage.setItem(DESK_KEY, value); } catch {}
    setFormError('');
    setChosenDesk(value);
    setEditingDesk(false);
  };

  const backToScanning = () => {
    unlockAudio();
    setFormError('');
    setView({ kind: 'scanning' });
  };

  // ---- render ------------------------------------------------------------------------------------------------------

  if (!deskReady) return <div className={styles.root} />;

  if (showDeskForm) {
    return (
      <div className={styles.root}>
        <main className={styles.main}>
          <div className={styles.panel}>
            <h1 className={styles.title}>Which desk is this?</h1>
            <p className={styles.muted}>Every check-in records the desk. This phone remembers it until you change it.</p>
            <div className={styles.chips}>
              {DESK_SUGGESTIONS.map((d) => (
                <button key={d} type="button" className={styles.chip} onClick={() => setDeskDraft(d)}>{d}</button>
              ))}
            </div>
            <label className={styles.field}>
              DESK / GATE
              <input
                className={styles.input}
                value={deskDraft}
                maxLength={40}
                autoComplete="off"
                onChange={(e) => setDeskDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveDesk(); }}
              />
            </label>
            {formError && <p className={styles.error} role="alert">{formError}</p>}
            <button type="button" className={`${styles.btn} ${styles.btnNeutral}`} onClick={saveDesk}>Start scanning</button>
            {desk && (
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { setDeskDraft(desk); setFormError(''); setEditingDesk(false); }}>
                Cancel
              </button>
            )}
            <p className={styles.muted}>Signed in as {staffLabel}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <p className={styles.brand}>Innovision check-in</p>
        <div className={styles.desk}>
          <span>{desk}</span>
          <button type="button" className={styles.linkBtn} onClick={() => { setDeskDraft(desk); setEditingDesk(true); }}>Change</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.cameraWrap}>
          <video ref={videoRef} className={styles.video} playsInline muted autoPlay aria-label="Camera preview" />
          <div className={styles.frame} aria-hidden="true" />
          {camera.status !== 'on' && <CameraMessage camera={camera} onRetry={() => setCameraAttempt((n) => n + 1)} />}
        </div>
        <p className={styles.hint}>Point the camera at the participant&apos;s QR pass. Keep it inside the frame.</p>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { unlockAudio(); setManualQuery(''); setFormError(''); setView({ kind: 'manual' }); }}>
          Damaged or missing QR? Manual lookup
        </button>
        <p className={styles.muted}>Signed in as {staffLabel}</p>
      </main>

      {view.kind !== 'scanning' && (
        <ResultScreen
          view={view}
          desk={desk}
          manualQuery={manualQuery}
          setManualQuery={setManualQuery}
          rejectReason={rejectReason}
          setRejectReason={(r) => { setRejectReason(r); setFormError(''); }}
          rejectNote={rejectNote}
          setRejectNote={setRejectNote}
          formError={formError}
          setFormError={setFormError}
          onApprove={approve}
          onStartReject={(v) => { unlockAudio(); setFormError(''); setView({ kind: 'reject', details: v.details, source: v.source, scanId: v.scanId }); }}
          onSubmitReject={submitReject}
          onManualLookup={(q) => { unlockAudio(); void lookupManual(q); }}
          onDone={backToScanning}
        />
      )}
    </div>
  );
}

function CameraMessage({ camera, onRetry }: { camera: CameraState; onRetry: () => void }) {
  if (camera.status === 'starting') return <div className={styles.cameraMsg}>Starting camera…</div>;
  if (camera.status === 'denied') {
    return (
      <div className={styles.cameraMsg} role="alert">
        <strong>Camera access is blocked</strong>
        <ol>
          <li>Tap the lock or &quot;aA&quot; icon next to the address bar.</li>
          <li>Set <b>Camera</b> to <b>Allow</b> for this site.</li>
          <li>On iPhone: Settings → Safari → Camera → Allow.</li>
          <li>Then tap Retry (or reload the page).</li>
        </ol>
        <button type="button" className={`${styles.btn} ${styles.btnNeutral}`} onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (camera.status === 'insecure') {
    return <div className={styles.cameraMsg} role="alert">The camera only works over HTTPS. Open the site&apos;s https:// address.</div>;
  }
  const message = camera.status === 'missing' ? 'No camera was found on this device.' : camera.status === 'error' ? camera.message : '';
  return (
    <div className={styles.cameraMsg} role="alert">
      {message}
      <button type="button" className={`${styles.btn} ${styles.btnNeutral}`} onClick={onRetry}>Retry</button>
    </div>
  );
}

interface ResultScreenProps {
  view: Exclude<View, { kind: 'scanning' }>;
  desk: string;
  manualQuery: string;
  setManualQuery: (q: string) => void;
  rejectReason: RejectReason | null;
  setRejectReason: (r: RejectReason) => void;
  rejectNote: string;
  setRejectNote: (n: string) => void;
  formError: string;
  setFormError: (e: string) => void;
  onApprove: (source: Source, scanId: string) => void;
  onStartReject: (v: { details: Details; source: Source; scanId: string }) => void;
  onSubmitReject: (details: Details, source: Source, scanId: string) => void;
  onManualLookup: (query: string) => void;
  onDone: () => void;
}

function ResultScreen(p: ResultScreenProps) {
  const { view } = p;
  const done = (label = 'Scan next') => (
    <div className={styles.actions}>
      <button type="button" className={`${styles.btn} ${styles.btnNeutral}`} onClick={p.onDone}>{label}</button>
    </div>
  );

  switch (view.kind) {
    case 'busy':
      return (
        <div className={`${styles.screen} ${styles.dark}`} aria-live="polite">
          <div className={styles.center}>
            <div className={styles.spinner} aria-hidden="true" />
            <p className={styles.sub}>{view.label}</p>
          </div>
        </div>
      );

    case 'valid':
      return (
        <div className={`${styles.screen} ${styles.green}`} role="status">
          <p className={styles.state}>VALID PASS</p>
          <p className={styles.sub}>Compare with the college ID card.</p>
          <UploadedIdCard registration={view.details.registration} />
          <DetailsList details={view.details} />
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnApprove}`} onClick={() => p.onApprove(view.source, view.scanId)}>
              APPROVE
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnReject}`} onClick={() => p.onStartReject(view)}>
              REJECT
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={p.onDone}>Cancel</button>
          </div>
        </div>
      );

    case 'reject':
      return (
        <div className={`${styles.screen} ${styles.red}`}>
          <p className={styles.state}>REJECT</p>
          <p className={styles.sub}>{view.details.name} · {view.details.registration_id}</p>
          <p className={styles.sub}>Nothing changes on the pass; only this attempt is logged.</p>
          <div className={styles.reasons} role="radiogroup" aria-label="Reason">
            {REJECT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={p.rejectReason === r.value}
                className={`${styles.reason} ${p.rejectReason === r.value ? styles.reasonOn : ''}`}
                onClick={() => p.setRejectReason(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className={styles.field}>
            {p.rejectReason === 'other' ? 'DESCRIBE THE REASON (REQUIRED)' : 'NOTE (OPTIONAL)'}
            <input className={styles.input} value={p.rejectNote} maxLength={200} onChange={(e) => p.setRejectNote(e.target.value)} />
          </label>
          {p.formError && <p className={styles.sub} role="alert">{p.formError}</p>}
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnNeutral}`} onClick={() => p.onSubmitReject(view.details, view.source, view.scanId)}>
              Log rejection
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={p.onDone}>Cancel</button>
          </div>
        </div>
      );

    case 'checked_in':
      return (
        <div className={`${styles.screen} ${styles.green}`} role="status">
          <p className={styles.state}>CHECKED IN</p>
          {view.info.name && <p className={`${styles.sub} ${styles.big}`}>{view.info.name}</p>}
          <p className={styles.sub}>{view.info.registration_id} · {timeOf(view.info.checked_in_at)} · {view.info.desk}</p>
          <p className={styles.sub}>Hand over the Innovision ID card.</p>
          {done()}
        </div>
      );

    case 'already':
      return (
        <div className={`${styles.screen} ${styles.amber}`} role="alert">
          <p className={styles.state}>ALREADY CHECKED IN</p>
          {view.info.name && <p className={`${styles.sub} ${styles.big}`}>{view.info.name} · {view.info.registration_id}</p>}
          <p className={styles.sub}>
            Already checked in at {timeOf(view.info.checked_in_at)} by {view.info.checked_in_by || 'staff'}, {view.info.desk}.
          </p>
          {done()}
        </div>
      );

    case 'invalid':
      return (
        <div className={`${styles.screen} ${styles.red}`} role="alert">
          <p className={styles.state}>INVALID PASS</p>
          <p className={styles.sub}>{INVALID_REASONS[view.reason] ?? 'This pass cannot be used.'}</p>
          <p className={styles.sub}>Send the person to the help desk.</p>
          {done()}
        </div>
      );

    case 'rejected':
      return (
        <div className={`${styles.screen} ${styles.dark}`} role="status">
          <p className={styles.state}>REJECTION LOGGED</p>
          <p className={styles.sub}>{view.registrationId} · {REJECT_REASON_LABELS[view.reason] ?? view.reason}</p>
          <p className={styles.sub}>The pass is unchanged and can be checked in later.</p>
          {done()}
        </div>
      );

    case 'ambiguous':
      return (
        <div className={`${styles.screen} ${styles.amber}`} role="alert">
          <p className={styles.state}>SEVERAL MATCHES</p>
          <p className={styles.sub}>{view.count} registrations share this roll number. Search by registration ID (IV26-…) instead.</p>
          {done('Back')}
        </div>
      );

    case 'refused':
      return (
        <div className={`${styles.screen} ${styles.red}`} role="alert">
          <p className={styles.state}>NOT ALLOWED</p>
          <p className={styles.sub}>{view.message}</p>
          {done('Back')}
        </div>
      );

    case 'unverified':
      return (
        <div className={`${styles.screen} ${styles.grey}`} role="alert">
          <p className={styles.state}>UNVERIFIED</p>
          <p className={styles.sub}>{view.message}</p>
          <p className={styles.sub}>Nothing is confirmed. Do not let the person in on this screen.</p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnNeutral}`} onClick={view.retry}>Retry</button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={p.onDone}>Back to scanning</button>
          </div>
        </div>
      );

    case 'session':
      return (
        <div className={`${styles.screen} ${styles.dark}`} role="alert">
          <p className={styles.state}>SESSION EXPIRED</p>
          <p className={styles.sub}>Log in again to keep scanning. Nothing from the last scan was confirmed.</p>
          <div className={styles.actions}>
            <a className={`${styles.btn} ${styles.btnNeutral}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} href={LOGIN_URL}>
              Log in again
            </a>
          </div>
        </div>
      );

    case 'manual':
      return (
        <div className={`${styles.screen} ${styles.dark}`}>
          <p className={styles.title}>Manual lookup</p>
          <p className={styles.muted}>For a damaged or missing QR. Enter the exact registration ID or roll number.</p>
          <form
            className={styles.panel}
            onSubmit={(e) => {
              e.preventDefault();
              const q = p.manualQuery.trim();
              if (!/^[A-Za-z0-9/_ -]{1,50}$/.test(q)) return p.setFormError('Enter a registration ID (IV26-1234) or a roll number.');
              p.setFormError('');
              p.onManualLookup(q);
            }}
          >
            <label className={styles.field}>
              REGISTRATION ID OR ROLL NUMBER
              <input
                className={styles.input}
                value={p.manualQuery}
                maxLength={50}
                autoCapitalize="characters"
                autoComplete="off"
                autoFocus
                onChange={(e) => p.setManualQuery(e.target.value)}
              />
            </label>
            {p.formError && <p className={styles.error} role="alert">{p.formError}</p>}
            <button type="submit" className={`${styles.btn} ${styles.btnNeutral}`}>Find</button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={p.onDone}>Back to scanning</button>
          </form>
        </div>
      );
  }
}

/**
 * The college ID card photo the student uploaded (GET /api/admin/registrations/id-card, a short-lived signed URL), to
 * compare with the card they show. Only a help: it never decides anything, and a failure just says so.
 */
function UploadedIdCard({ registration }: { registration: string }) {
  const [state, setState] = useState<{ for: string; url?: string; note?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    (async () => {
      let next: { url?: string; note?: string };
      try {
        const token = await currentToken();
        const res = await fetch(`/api/admin/registrations/id-card?id=${encodeURIComponent(registration)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        next = res.ok && typeof data.url === 'string'
          ? { url: data.url }
          : { note: res.status === 404 ? 'No ID card uploaded. Check the physical card carefully.' : 'Could not load the uploaded ID card.' };
      } catch {
        next = { note: 'Could not load the uploaded ID card.' };
      }
      if (!cancelled) setState({ for: registration, ...next });
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [registration]);

  const current = state?.for === registration ? state : null;
  if (!current) return <p className={styles.idCardNote}>Loading the uploaded ID card…</p>;
  if (!current.url) return <p className={styles.idCardNote}>{current.note}</p>;
  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private upload
  return <img className={styles.idCard} src={current.url} alt="College ID card uploaded by the student" />;
}

function DetailsList({ details }: { details: Details }) {
  return (
    <dl className={styles.details}>
      <dt>Name</dt>
      <dd className={styles.big}>{details.name}</dd>
      <dt>Roll no.</dt>
      <dd>{details.enrollment_no || '—'}</dd>
      <dt>College</dt>
      <dd>{details.college}</dd>
      <dt>Phone</dt>
      <dd>{details.phone}</dd>
      <dt>UTR</dt>
      <dd>{details.utr || '—'}</dd>
      <dt>Reg. ID</dt>
      <dd>{details.registration_id}</dd>
    </dl>
  );
}
