'use client';
import { useEffect, useState } from 'react';
import { fetchSeatCount, formatSeats, type SeatCount } from '@/lib/seats';

const POLL_MS = 30_000;
const FEW_LEFT = 100;
const GOLD = 'oklch(0.78 0.075 85)';
const WARN = 'oklch(0.76 0.14 35)';

/**
 * "1,042 / 1,300 seats left" on the registration form (GET /api/seats), refreshed every 30 seconds while the tab is
 * visible, so students watch it go down. Renders nothing until the count is known, or when it can't be read.
 */
export default function SeatCounter() {
  const [seats, setSeats] = useState<SeatCount | null>(null);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const refresh = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      const next = await fetchSeatCount();
      busy = false;
      // A failed refresh keeps the last number on screen.
      if (!cancelled && next) setSeats(next);
    };
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  if (!seats) return null;
  const full = seats.left === 0;
  const few = !full && seats.left <= FEW_LEFT;
  const share = seats.total > 0 ? seats.left / seats.total : 0;

  return (
    // Centered, like the rest of the form's intro (AuthOverlay.module.css .intro).
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '320px', margin: '26px auto 0' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.16em', color: full || few ? WARN : 'rgba(236,232,223,.72)' }}>
        {full ? 'REGISTRATIONS FULL' : few ? 'FILLING FAST' : 'SEATS LEFT'}
      </span>
      <span
        role={full ? 'status' : undefined}
        aria-label={full ? 'Registrations are full' : `${formatSeats(seats.left)} of ${formatSeats(seats.total)} seats left`}
        style={{ display: 'flex', alignItems: 'baseline', gap: '10px', fontVariantNumeric: 'tabular-nums' }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(34px,3vw,44px)', lineHeight: 1, color: full ? WARN : '#ECE8DF' }}>
          {formatSeats(seats.left)}
        </span>
        <span style={{ fontSize: '15px', color: 'rgba(236,232,223,.6)' }}>/ {formatSeats(seats.total)}</span>
      </span>
      <span aria-hidden="true" style={{ position: 'relative', alignSelf: 'stretch', height: '3px', background: 'rgba(236,232,223,.16)', overflow: 'hidden' }}>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: full || few ? WARN : GOLD,
            transform: `scaleX(${share})`,
            transformOrigin: 'left',
            transition: 'transform .8s cubic-bezier(.25,1,.1,1)',
          }}
        />
      </span>
      {full ? (
        <span style={{ fontSize: '14px', lineHeight: 1.45, color: 'rgba(236,232,223,.72)' }}>
          Every seat has been taken. Keep checking: a seat opens up whenever a registration is not approved.
        </span>
      ) : null}
    </div>
  );
}
