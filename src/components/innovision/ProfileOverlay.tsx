'use client';

import React, { useState } from 'react';
import type { UserProfile, Registration } from '@/lib/supabase';

interface ProfileOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  registration: Registration | null;
  onOpenPass: () => void;
  onOpenRegister: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onUpdatePhone: (newPhone: string) => Promise<void>;
}

export default function ProfileOverlay({
  isOpen,
  onClose,
  user,
  registration,
  onOpenPass,
  onOpenRegister,
  onOpenAdmin,
  onLogout,
  onUpdatePhone,
}: ProfileOverlayProps) {
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneVal, setPhoneVal] = useState(user?.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  if (!isOpen || !user) return null;

  const isStaff = user.role === 'admin' || user.role === 'it-team' || user.role === 'registration-team';
  const isInternal = user.student_type === 'internal' || user.email.toLowerCase().endsWith('@nitrkl.ac.in');

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneVal.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setPhoneError('Enter a valid 10-digit mobile number');
      return;
    }
    try {
      setSavingPhone(true);
      setPhoneError('');
      await onUpdatePhone(clean);
      setEditingPhone(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update phone';
      setPhoneError(message);
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User Profile"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 65,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(7, 6, 5, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'opacity .3s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          background: '#0c0b0a',
          borderLeft: '1px solid rgba(236,232,223,0.14)',
          color: '#ECE8DF',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-20px 0 50px rgba(0,0,0,0.8)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 28px',
            borderBottom: '1px solid rgba(236,232,223,0.12)',
            background: 'rgba(20, 19, 18, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: '18px',
                letterSpacing: '.06em',
              }}
            >
              MISSION PROFILE
            </span>
          </div>

          <button
            id="close-profile-btn"
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              border: '1px solid rgba(236,232,223,0.2)',
              background: 'transparent',
              color: '#ECE8DF',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '.14em',
              cursor: 'pointer',
              transition: 'background-color .2s',
            }}
          >
            <span>CLOSE</span>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1 1 11" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '28px', display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* User Card */}
          <div
            style={{
              position: 'relative',
              padding: '24px',
              background: 'rgba(236,232,223,0.03)',
              border: '1px solid rgba(236,232,223,0.12)',
              clipPath:
                'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '20px' }}>
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid oklch(0.8 0.12 85)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(236,232,223,0.1)',
                    border: '2px solid oklch(0.8 0.12 85)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 400,
                    fontSize: '24px',
                    color: 'oklch(0.8 0.12 85)',
                  }}
                >
                  {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 400,
                      fontSize: '20px',
                      lineHeight: 1.2,
                    }}
                  >
                    {user.full_name}
                  </h3>
                  <span
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '.12em',
                      background:
                        user.role === 'admin'
                          ? 'oklch(0.65 0.18 30)'
                          : user.role === 'it-team' || user.role === 'registration-team'
                          ? 'oklch(0.65 0.15 240)'
                          : 'rgba(236,232,223,0.1)',
                      color: '#ECE8DF',
                      border: '1px solid rgba(236,232,223,0.2)',
                    }}
                  >
                    {user.role.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: 'rgba(236,232,223,0.7)', overflowWrap: 'anywhere' }}>
                  {user.email}
                </p>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: isInternal ? 'oklch(0.8 0.12 85)' : 'rgba(236,232,223,0.6)',
                  }}
                >
                  {isInternal ? 'NIT ROURKELA STUDENT (INTERNAL)' : 'EXTERNAL VISITOR'}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(236,232,223,0.1)',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.5)' }}>
                  CONTACT PHONE
                </span>
                {editingPhone ? (
                  <form onSubmit={handleSavePhone} style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <input
                      type="tel"
                      value={phoneVal}
                      onChange={(e) => setPhoneVal(e.target.value)}
                      placeholder="9876543210"
                      style={{
                        width: '120px',
                        height: '32px',
                        padding: '0 8px',
                        background: 'rgba(236,232,223,0.06)',
                        border: '1px solid rgba(236,232,223,0.3)',
                        color: '#ECE8DF',
                        fontSize: '13px',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={savingPhone}
                      style={{
                        padding: '0 10px',
                        background: 'oklch(0.8 0.12 85)',
                        color: '#141312',
                        border: 0,
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {savingPhone ? '...' : 'SAVE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(false)}
                      style={{
                        padding: '0 8px',
                        background: 'transparent',
                        color: '#ECE8DF',
                        border: '1px solid rgba(236,232,223,0.2)',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>
                      {user.phone ? `+91 ${user.phone}` : 'Not provided'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneVal(user.phone || '');
                        setEditingPhone(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: 'oklch(0.8 0.12 85)',
                        fontSize: '11px',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Edit
                    </button>
                  </div>
                )}
                {phoneError && <span style={{ fontSize: '11px', color: 'oklch(0.74 0.15 35)' }}>{phoneError}</span>}
              </div>

              {registration?.enrollment_no && (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.5)' }}>
                    ENROLLMENT / ROLL NO
                  </span>
                  <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: 500 }}>
                    {registration.enrollment_no}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Registration Status Section */}
          <div
            style={{
              padding: '24px',
              background: 'rgba(236,232,223,0.03)',
              border: '1px solid rgba(236,232,223,0.12)',
              clipPath:
                'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.18em', color: 'oklch(0.8 0.12 85)' }}>
                FESTIVAL STATUS
              </span>
              {registration && (
                <span
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    border: '1px solid currentColor',
                    color:
                      registration.status === 'confirmed'
                        ? 'oklch(0.75 0.16 145)'
                        : registration.status === 'pending'
                        ? 'oklch(0.8 0.15 80)'
                        : 'oklch(0.74 0.15 35)',
                    background:
                      registration.status === 'confirmed'
                        ? 'rgba(74,222,128,0.1)'
                        : registration.status === 'pending'
                        ? 'rgba(250,204,21,0.1)'
                        : 'rgba(239,68,68,0.1)',
                  }}
                >
                  {registration.status === 'confirmed'
                    ? 'PASS CONFIRMED'
                    : registration.status === 'pending'
                    ? 'PENDING REVIEW'
                    : 'REGISTRATION DECLINED'}
                </span>
              )}
            </div>

            {registration ? (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: '14px', lineHeight: 1.5, color: 'rgba(236,232,223,0.8)' }}>
                  {registration.status === 'confirmed'
                    ? 'Your registration has been approved. Your boarding pass is verified for entry at the gate.'
                    : registration.status === 'pending'
                    ? 'Your registration details & payment proof are under review by the IT-Team. Your pass will unlock upon confirmation.'
                    : 'Your registration could not be verified. Please visit the helpdesk or contact the event administrators.'}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(236,232,223,0.06)',
                    marginBottom: '18px',
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'rgba(236,232,223,0.7)' }}>REGISTRATION ID</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '18px', letterSpacing: '.06em' }}>
                    {registration.registration_id}
                  </span>
                </div>

                <button
                  id="view-pass-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPass();
                  }}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    minHeight: '48px',
                    padding: '0 20px',
                    background: '#ECE8DF',
                    color: '#141312',
                    border: 0,
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '.12em',
                    cursor: 'pointer',
                    clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                  }}
                >
                  <span>VIEW FULL BOARDING PASS</span>
                  <svg width="14" height="10" viewBox="0 0 16 10" aria-hidden="true">
                    <path d="M11 1l4 4-4 4M15 5H0" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 18px', fontSize: '14px', lineHeight: 1.5, color: 'rgba(236,232,223,0.75)' }}>
                  You have not registered for Innovision 2026 events yet. {isInternal ? 'As an NIT Rourkela student, your registration is free!' : 'Complete registration to secure your delegate pass.'}
                </p>

                <button
                  id="start-reg-from-profile-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRegister();
                  }}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    minHeight: '48px',
                    padding: '0 20px',
                    background: 'oklch(0.8 0.12 85)',
                    color: '#141312',
                    border: 0,
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '.12em',
                    cursor: 'pointer',
                    clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                  }}
                >
                  <span>START REGISTRATION</span>
                  <svg width="14" height="10" viewBox="0 0 16 10" aria-hidden="true">
                    <path d="M11 1l4 4-4 4M15 5H0" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Admin & IT-Team Staff Portal Button */}
          {isStaff && (
            <div
              style={{
                position: 'relative',
                padding: '20px 24px',
                background: 'linear-gradient(135deg, rgba(220,183,106,0.12), rgba(20,19,18,0.8))',
                border: '1.5px solid oklch(0.8 0.12 85)',
                clipPath:
                  'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.8 0.12 85)" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '.18em', color: 'oklch(0.8 0.12 85)' }}>
                  STAFF CONTROL PORTAL
                </span>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'rgba(236,232,223,0.8)', lineHeight: 1.45 }}>
                You have {user.role === 'admin' ? 'Administrator' : user.role === 'it-team' ? 'IT-Team' : 'Registration-Team'} privileges to review registrations, verify payment proofs, and export records.
              </p>
              <button
                id="open-admin-dashboard-btn"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minHeight: '44px',
                  padding: '0 16px',
                  background: 'oklch(0.8 0.12 85)',
                  color: '#141312',
                  border: 0,
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '.1em',
                  cursor: 'pointer',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                }}
              >
                <span>OPEN STAFF DASHBOARD</span>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Footer Logout */}
        <div
          style={{
            padding: '20px 28px',
            borderTop: '1px solid rgba(236,232,223,0.1)',
            background: 'rgba(20, 19, 18, 0.4)',
          }}
        >
          <button
            id="profile-logout-btn"
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              minHeight: '48px',
              padding: '0 20px',
              background: 'transparent',
              color: 'rgba(236,232,223,0.85)',
              border: '1.5px solid rgba(236,232,223,0.22)',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '.14em',
              cursor: 'pointer',
              clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
              transition: 'border-color .3s, color .3s',
            }}
          >
            <span>LOG OUT OF ORBIT</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
