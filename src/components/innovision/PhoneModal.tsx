'use client';

import React, { useState } from 'react';

interface PhoneModalProps {
  isOpen: boolean;
  onSave: (phone: string) => Promise<void>;
  onClose?: () => void;
  userEmail?: string;
}

export default function PhoneModal({ isOpen, onSave, onClose, userEmail }: PhoneModalProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await onSave(cleanPhone);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save phone number.';
      setError(message);
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(7, 6, 5, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '20px',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          padding: '1px',
          background: 'rgba(236,232,223,0.22)',
          clipPath:
            'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)',
        }}
      >
        <div
          style={{
            position: 'relative',
            padding: '32px 28px',
            background: 'rgba(16, 15, 14, 0.96)',
            color: '#ECE8DF',
            clipPath:
              'polygon(15.5px 0, 100% 0, 100% calc(100% - 15.5px), calc(100% - 15.5px) 100%, 0 100%, 0 15.5px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'oklch(0.8 0.12 85)',
                boxShadow: '0 0 10px oklch(0.8 0.12 85)',
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '.2em',
                color: 'oklch(0.8 0.12 85)',
                textTransform: 'uppercase',
              }}
            >
              Contact Verification
            </span>
          </div>

          <h3
            id="phone-modal-title"
            style={{
              margin: '0 0 8px',
              fontFamily: 'var(--font-cinzel), serif',
              fontWeight: 900,
              fontSize: '24px',
              letterSpacing: '.02em',
            }}
          >
            Provide Phone Number
          </h3>

          <p
            style={{
              margin: '0 0 24px',
              fontSize: '14px',
              lineHeight: 1.5,
              color: 'rgba(236,232,223,0.72)',
            }}
          >
            We need your contact number to reach you during Innovision 2026 events and send
            gate entry passes.
          </p>

          {userEmail && (
            <p style={{ margin: '-16px 0 20px', fontSize: '12px', color: 'oklch(0.8 0.12 85)' }}>
              Logged in as: {userEmail}
            </p>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 0,
                color: 'rgba(236,232,223,0.6)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.16em', color: 'rgba(236,232,223,0.86)' }}>
                MOBILE NUMBER
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 14px',
                    border: '1.5px solid rgba(236,232,223,0.28)',
                    fontSize: '15px',
                    fontWeight: 600,
                    background: 'rgba(236,232,223,0.04)',
                  }}
                >
                  +91
                </span>
                <input
                  id="user-phone-input"
                  name="phone"
                  type="tel"
                  autoFocus
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (error) setError('');
                  }}
                  style={{
                    flex: 1,
                    height: '52px',
                    padding: '0 16px',
                    borderRadius: 0,
                    background: 'rgba(236,232,223,0.04)',
                    border: error ? '1.5px solid oklch(0.74 0.15 35)' : '1.5px solid rgba(236,232,223,0.28)',
                    color: '#ECE8DF',
                    fontSize: '16px',
                    outline: 'none',
                  }}
                />
              </div>
              {error && (
                <span role="alert" style={{ fontSize: '13px', color: 'oklch(0.74 0.15 35)' }}>
                  {error}
                </span>
              )}
            </label>

            <button
              id="save-phone-btn"
              type="submit"
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '52px',
                padding: '0 24px',
                border: 0,
                cursor: busy ? 'progress' : 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '.1em',
                color: '#141312',
                background: '#ECE8DF',
                clipPath:
                  'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                transition: 'background-color .3s',
              }}
            >
              {busy ? 'SAVING NUMBER...' : 'CONFIRM & CONTINUE'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
