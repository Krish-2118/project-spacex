'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile, Registration } from '@/lib/supabase';
import { getSupabase, fetchSessionFromDatabase } from '@/lib/supabase';
import EventsManager from './admin/EventsManager';
import GalleryManager from './admin/GalleryManager';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

export default function AdminDashboard({
  isOpen,
  onClose,
  currentUser,
}: AdminDashboardProps) {
  const isAdmin = currentUser.role === 'admin';
  const isStaff = isAdmin || currentUser.role === 'it-team';

  const [tab, setTab] = useState<'registrations' | 'events' | 'gallery' | 'users'>('registrations');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // In-app Confirmation Modal State (replaces native browser confirm/alert)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionText: string;
    actionType: 'approve' | 'reject' | 'role' | 'default';
    onConfirm: () => void;
  } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchReg, setSearchReg] = useState<string>('');
  const [searchUser, setSearchUser] = useState<string>('');

  // Pagination states (30 items per page)
  const [regPage, setRegPage] = useState<number>(1);
  const [userPage, setUserPage] = useState<number>(1);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Status updating state
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;

      // Fallback 1: Read inn_access_token from document cookies
      if (typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|;\s*)inn_access_token=([^;]+)/);
        if (match && match[1]) {
          const decoded = decodeURIComponent(match[1]);
          if (decoded && decoded !== 'null' && decoded !== 'undefined') {
            return decoded;
          }
        }

        // Fallback 2: Read any Supabase auth token cookie
        const sbMatch = document.cookie.match(/(?:^|;\s*)sb-[^=]+-auth-token=([^;]+)/);
        if (sbMatch && sbMatch[1]) {
          try {
            const parsed = JSON.parse(decodeURIComponent(sbMatch[1]));
            if (parsed?.access_token) return parsed.access_token;
          } catch {}
        }
      }

      // Fallback 3: Query server session (auto-refreshes tokens if expired)
      const dbAuth = await fetchSessionFromDatabase();
      if (dbAuth.tokens?.access_token) {
        return dbAuth.tokens.access_token;
      }
    } catch (e) {
      console.warn('getAuthToken error:', e);
    }
    return null;
  };

  // Fetch registrations
  const fetchRegistrations = useCallback(async () => {
    try {
      setLoadingRegs(true);
      setErrorMsg('');
      const token = await getAuthToken();

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('student_type', typeFilter);
      if (searchReg.trim()) params.set('q', searchReg.trim());

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/admin/registrations?${params.toString()}`, {
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch registrations');
      setRegistrations(data.registrations || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error loading registrations';
      setErrorMsg(message);
    } finally {
      setLoadingRegs(false);
    }
  }, [statusFilter, typeFilter, searchReg]);

  // Fetch users (Admin only: IT-Team cannot access users)
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingUsers(true);
      setErrorMsg('');
      const token = await getAuthToken();

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/admin/users', {
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      setUsers(data.users || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error loading users';
      setErrorMsg(message);
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchRegistrations();
      if (isAdmin) fetchUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, fetchRegistrations, fetchUsers, isAdmin]);

  // Active tab: 'users' is strictly admin-only; staff (admin & it-team) can access registrations, events, gallery
  const activeTab = tab === 'users' && !isAdmin ? 'registrations' : tab;

  if (!isOpen || !isStaff) return null;

  // Handle Approve or Reject using Modal / Toast
  const handleUpdateStatus = (reg: Registration, newStatus: 'confirmed' | 'rejected') => {
    if (reg.status !== 'pending') {
      showToast(`Registration ${reg.registration_id} has already been ${reg.status.toUpperCase()} and cannot be altered.`, 'info');
      return;
    }

    const isApprove = newStatus === 'confirmed';
    setConfirmModal({
      isOpen: true,
      title: isApprove ? 'Approve Registration' : 'Reject Registration',
      message: isApprove
        ? `Are you sure you want to APPROVE registration for ${reg.name} (${reg.registration_id})? This will generate their confirmed boarding pass.`
        : `Are you sure you want to REJECT registration for ${reg.name} (${reg.registration_id})? This action cannot be altered once confirmed.`,
      actionText: isApprove ? 'APPROVE REGISTRATION' : 'REJECT REGISTRATION',
      actionType: isApprove ? 'approve' : 'reject',
      onConfirm: () => executeUpdateStatus(reg, newStatus),
    });
  };

  const executeUpdateStatus = async (reg: Registration, newStatus: 'confirmed' | 'rejected') => {
    try {
      setActionBusyId(reg.id || reg.registration_id);
      const token = await getAuthToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/admin/registrations', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          registrationId: reg.id,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update registration status');

      showToast(`Registration ${reg.registration_id} marked as ${newStatus.toUpperCase()}`, 'success');
      // Update local state
      setRegistrations((prev) =>
        prev.map((r) => (r.id === reg.id ? { ...r, status: newStatus } : r))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      showToast(message, 'error');
    } finally {
      setActionBusyId(null);
    }
  };

  // Handle Role Change using Modal / Toast (Only 'user' and 'it-team'; Admin role is DB only)
  const handleChangeRole = (userId: string, newRole: 'user' | 'it-team', userEmail: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Update User Role',
      message: `Are you sure you want to change the role of ${userEmail} to "${newRole === 'it-team' ? 'IT-TEAM' : 'USER'}"?`,
      actionText: 'CONFIRM ROLE CHANGE',
      actionType: 'role',
      onConfirm: () => executeChangeRole(userId, newRole, userEmail),
    });
  };

  const executeChangeRole = async (userId: string, newRole: 'user' | 'it-team', userEmail: string) => {
    try {
      setRoleBusyId(userId);
      const token = await getAuthToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change role');

      showToast(`Updated role for ${userEmail} to ${newRole === 'it-team' ? 'IT-TEAM' : 'USER'}`, 'success');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change role';
      showToast(message, 'error');
    } finally {
      setRoleBusyId(null);
    }
  };

  // Export Registrations CSV
  const exportRegistrationsCSV = () => {
    if (!registrations.length) {
      showToast('No registrations available to export.', 'info');
      return;
    }

    const headers = [
      'Registration ID',
      'Name',
      'Email',
      'Phone',
      'College',
      'Enrollment No',
      'Student Type',
      'Status',
      'Amount (INR)',
      'UPI UTR',
      'ID Card URL',
      'Payment Screenshot URL',
      'Registered At',
    ];

    const rows = registrations.map((r) => [
      `"${r.registration_id}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.email}"`,
      `"${r.phone}"`,
      `"${r.college.replace(/"/g, '""')}"`,
      `"${(r.enrollment_no || '').replace(/"/g, '""')}"`,
      `"${r.student_type}"`,
      `"${r.status}"`,
      `"${r.amount}"`,
      `"${r.utr || ''}"`,
      `"${r.id_card_url}"`,
      `"${r.payment_screenshot_url || ''}"`,
      `"${r.created_at || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `innovision_registrations_${statusFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered users for search
  const filteredUsers = users.filter((u) => {
    if (!searchUser.trim()) return true;
    const q = searchUser.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  });

  // Export Users CSV (exports ALL filtered records, without pagination)
  const exportUsersCSV = () => {
    if (!filteredUsers.length) {
      showToast('No users available to export.', 'info');
      return;
    }

    const headers = ['User ID', 'Full Name', 'Email', 'Phone', 'Student Type', 'Role', 'Registered At'];
    const rows = filteredUsers.map((u) => [
      `"${u.id}"`,
      `"${(u.full_name || '').replace(/"/g, '""')}"`,
      `"${u.email}"`,
      `"${u.phone || ''}"`,
      `"${u.student_type}"`,
      `"${u.role}"`,
      `"${u.created_at || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `innovision_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Pagination Config
  const ITEMS_PER_PAGE = 30;

  // Registrations pagination (strictly UI-only; CSV exports all filtered registrations)
  const totalRegPages = Math.max(1, Math.ceil(registrations.length / ITEMS_PER_PAGE));
  const currentRegPage = Math.min(regPage, totalRegPages);
  const paginatedRegistrations = registrations.slice(
    (currentRegPage - 1) * ITEMS_PER_PAGE,
    currentRegPage * ITEMS_PER_PAGE
  );
  const regStart = registrations.length === 0 ? 0 : (currentRegPage - 1) * ITEMS_PER_PAGE + 1;
  const regEnd = Math.min(currentRegPage * ITEMS_PER_PAGE, registrations.length);

  // Users pagination (strictly UI-only; CSV exports all filtered users)
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const currentUserPage = Math.min(userPage, totalUserPages);
  const paginatedUsers = filteredUsers.slice(
    (currentUserPage - 1) * ITEMS_PER_PAGE,
    currentUserPage * ITEMS_PER_PAGE
  );
  const userStart = filteredUsers.length === 0 ? 0 : (currentUserPage - 1) * ITEMS_PER_PAGE + 1;
  const userEnd = Math.min(currentUserPage * ITEMS_PER_PAGE, filteredUsers.length);

  const getPageNumbers = (current: number, total: number): (number | 'ellipsis')[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [];
    pages.push(1);
    if (current > 3) pages.push('ellipsis');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('ellipsis');
    pages.push(total);
    return pages;
  };

  const renderPaginationBar = (
    currentPage: number,
    totalPages: number,
    startIndex: number,
    endIndex: number,
    totalItems: number,
    itemLabel: string,
    onPageChange: (page: number) => void
  ) => {
    if (totalItems === 0) return null;
    const pageNumbers = getPageNumbers(currentPage, totalPages);

    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          padding: '14px 18px',
          background: 'rgba(236,232,223,0.03)',
          border: '1px solid rgba(236,232,223,0.12)',
          borderTop: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(236,232,223,0.65)' }}>
          <span>SHOWING</span>
          <span style={{ color: 'oklch(0.8 0.12 85)', fontWeight: 800, fontFamily: 'monospace' }}>
            {startIndex}–{endIndex}
          </span>
          <span>OF</span>
          <span style={{ color: '#ECE8DF', fontWeight: 800, fontFamily: 'monospace' }}>
            {totalItems}
          </span>
          <span>{itemLabel.toUpperCase()}</span>
          {totalItems > ITEMS_PER_PAGE && (
            <span style={{ color: 'rgba(236,232,223,0.4)', fontSize: '11px', marginLeft: '2px' }}>
              (30 / page)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            aria-label="Previous page"
            style={{
              height: '32px',
              padding: '0 12px',
              background: currentPage <= 1 ? 'rgba(236,232,223,0.03)' : 'rgba(236,232,223,0.08)',
              border: '1px solid rgba(236,232,223,0.2)',
              color: currentPage <= 1 ? 'rgba(236,232,223,0.25)' : '#ECE8DF',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '.08em',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>PREV</span>
          </button>

          {pageNumbers.map((p, idx) =>
            p === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  width: '28px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'rgba(236,232,223,0.4)',
                  fontSize: '12px',
                }}
              >
                …
              </span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '32px',
                  height: '32px',
                  padding: '0 8px',
                  background: p === currentPage ? 'oklch(0.8 0.12 85)' : 'rgba(236,232,223,0.06)',
                  color: p === currentPage ? '#141312' : '#ECE8DF',
                  border: p === currentPage ? 'none' : '1px solid rgba(236,232,223,0.15)',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                }}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            aria-label="Next page"
            style={{
              height: '32px',
              padding: '0 12px',
              background: currentPage >= totalPages ? 'rgba(236,232,223,0.03)' : 'rgba(236,232,223,0.08)',
              border: '1px solid rgba(236,232,223,0.2)',
              color: currentPage >= totalPages ? 'rgba(236,232,223,0.25)' : '#ECE8DF',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '.08em',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>NEXT</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Metrics
  const totalRegs = registrations.length;
  const pendingRegs = registrations.filter((r) => r.status === 'pending').length;
  const confirmedRegs = registrations.filter((r) => r.status === 'confirmed').length;
  const rejectedRegs = registrations.filter((r) => r.status === 'rejected').length;
  const internalRegs = registrations.filter((r) => r.student_type === 'internal').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: '#0a0908',
        color: '#ECE8DF',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 120,
            padding: '12px 20px',
            background:
              toast.type === 'error'
                ? '#dc2626'
                : toast.type === 'info'
                ? '#2563eb'
                : 'oklch(0.8 0.12 85)',
            color: toast.type === 'error' || toast.type === 'info' ? '#ffffff' : '#141312',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '.06em',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          }}
        >
          {toast.type === 'error' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : toast.type === 'info' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.485 3.515a1 1 0 0 1 0 1.414l-7 7a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L6 10.086l6.293-6.293a1 1 0 0 1 1.414 0z" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Confirmation Modal (Replaces browser confirm/alert for Approve/Reject & Roles) */}
      {confirmModal && confirmModal.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            background: 'rgba(7, 6, 5, 0.88)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              background: '#141312',
              border: `1.5px solid ${confirmModal.actionType === 'reject' ? '#ef4444' : 'oklch(0.8 0.12 85)'}`,
              clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
              color: '#ECE8DF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <span
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: confirmModal.actionType === 'reject' ? 'rgba(239,68,68,0.2)' : 'rgba(220,183,106,0.2)',
                  color: confirmModal.actionType === 'reject' ? '#ef4444' : 'oklch(0.8 0.12 85)',
                  fontWeight: 900,
                  fontSize: '14px',
                }}
              >
                {confirmModal.actionType === 'reject' ? '✕' : '✓'}
              </span>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-cinzel), serif', fontWeight: 900, fontSize: '19px', letterSpacing: '.04em' }}>
                {confirmModal.title}
              </h4>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: '14px', lineHeight: 1.6, color: 'rgba(236,232,223,0.85)' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '10px 18px',
                  border: '1px solid rgba(236,232,223,0.3)',
                  background: 'transparent',
                  color: '#ECE8DF',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  cursor: 'pointer',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                }}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  const onConfirm = confirmModal.onConfirm;
                  setConfirmModal(null);
                  onConfirm();
                }}
                style={{
                  padding: '10px 22px',
                  border: 'none',
                  background: confirmModal.actionType === 'reject' ? '#dc2626' : 'oklch(0.8 0.12 85)',
                  color: confirmModal.actionType === 'reject' ? '#ffffff' : '#141312',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '.08em',
                  cursor: 'pointer',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                }}
              >
                {confirmModal.actionText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px clamp(16px, 3vw, 40px)',
          borderBottom: '1px solid rgba(236,232,223,0.12)',
          background: 'rgba(16,15,14,0.95)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'oklch(0.8 0.12 85)',
                boxShadow: '0 0 12px oklch(0.8 0.12 85)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-cinzel), serif',
                fontWeight: 900,
                fontSize: 'clamp(18px, 1.8vw, 22px)',
                letterSpacing: '.06em',
              }}
            >
              COMMAND CENTER · {currentUser.role.toUpperCase()}
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '8px', marginLeft: '24px' }}>
            <button
              id="tab-registrations"
              type="button"
              onClick={() => setTab('registrations')}
              style={{
                padding: '8px 18px',
                border: 0,
                borderBottom: activeTab === 'registrations' ? '2px solid oklch(0.8 0.12 85)' : '2px solid transparent',
                background: activeTab === 'registrations' ? 'rgba(236,232,223,0.06)' : 'transparent',
                color: activeTab === 'registrations' ? '#ECE8DF' : 'rgba(236,232,223,0.5)',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '.14em',
                cursor: 'pointer',
              }}
            >
              REGISTRATIONS ({totalRegs})
            </button>

            <button
              id="tab-events"
              type="button"
              onClick={() => setTab('events')}
              style={{
                padding: '8px 18px',
                border: 0,
                borderBottom: activeTab === 'events' ? '2px solid oklch(0.8 0.12 85)' : '2px solid transparent',
                background: activeTab === 'events' ? 'rgba(236,232,223,0.06)' : 'transparent',
                color: activeTab === 'events' ? '#ECE8DF' : 'rgba(236,232,223,0.5)',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '.14em',
                cursor: 'pointer',
              }}
            >
              EVENTS
            </button>

            <button
              id="tab-gallery"
              type="button"
              onClick={() => setTab('gallery')}
              style={{
                padding: '8px 18px',
                border: 0,
                borderBottom: activeTab === 'gallery' ? '2px solid oklch(0.8 0.12 85)' : '2px solid transparent',
                background: activeTab === 'gallery' ? 'rgba(236,232,223,0.06)' : 'transparent',
                color: activeTab === 'gallery' ? '#ECE8DF' : 'rgba(236,232,223,0.5)',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '.14em',
                cursor: 'pointer',
              }}
            >
              GALLERY
            </button>

            {isAdmin && (
              <button
                id="tab-users"
                type="button"
                onClick={() => setTab('users')}
                style={{
                  padding: '8px 18px',
                  border: 0,
                  borderBottom: activeTab === 'users' ? '2px solid oklch(0.8 0.12 85)' : '2px solid transparent',
                  background: activeTab === 'users' ? 'rgba(236,232,223,0.06)' : 'transparent',
                  color: activeTab === 'users' ? '#ECE8DF' : 'rgba(236,232,223,0.5)',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '.14em',
                  cursor: 'pointer',
                }}
              >
                USERS & ROLES ({users.length})
              </button>
            )}
          </nav>
        </div>

        <button
          id="close-admin-btn"
          type="button"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            border: '1px solid rgba(236,232,223,0.24)',
            background: 'transparent',
            color: '#ECE8DF',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '.14em',
            cursor: 'pointer',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          }}
        >
          <span>EXIT TO FEST</span>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1l10 10M11 1 1 11" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 'clamp(20px, 3vw, 40px)' }}>
        {errorMsg && (
          <div
            style={{
              padding: '14px 20px',
              marginBottom: '24px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid oklch(0.74 0.15 35)',
              color: 'oklch(0.85 0.12 35)',
              fontSize: '14px',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* TAB 1: REGISTRATIONS */}
        {activeTab === 'registrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Stat Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {[
                { label: 'TOTAL REGISTRATIONS', value: totalRegs, color: '#ECE8DF' },
                { label: 'PENDING APPROVAL', value: pendingRegs, color: 'oklch(0.8 0.15 80)' },
                { label: 'CONFIRMED PASSES', value: confirmedRegs, color: 'oklch(0.75 0.16 145)' },
                { label: 'REJECTED', value: rejectedRegs, color: 'oklch(0.74 0.15 35)' },
                { label: 'NIT RKL (INTERNAL)', value: internalRegs, color: 'oklch(0.8 0.12 85)' },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: '20px',
                    background: 'rgba(236,232,223,0.03)',
                    border: '1px solid rgba(236,232,223,0.1)',
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>
                    {stat.label}
                  </span>
                  <div
                    style={{
                      marginTop: '8px',
                      fontFamily: 'var(--font-cinzel), serif',
                      fontWeight: 900,
                      fontSize: '32px',
                      lineHeight: 1,
                      color: stat.color,
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Filter & Export Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '16px 20px',
                background: 'rgba(236,232,223,0.02)',
                border: '1px solid rgba(236,232,223,0.08)',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                {/* Search */}
                <input
                  id="search-registrations-input"
                  type="text"
                  placeholder="Search name, ID, college, UTR..."
                  value={searchReg}
                  onChange={(e) => {
                    setSearchReg(e.target.value);
                    setRegPage(1);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && fetchRegistrations()}
                  style={{
                    width: '260px',
                    height: '40px',
                    padding: '0 14px',
                    background: 'rgba(236,232,223,0.05)',
                    border: '1px solid rgba(236,232,223,0.2)',
                    color: '#ECE8DF',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />

                {/* Status Filter */}
                <select
                  id="filter-reg-status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setRegPage(1);
                  }}
                  style={{
                    height: '40px',
                    padding: '0 14px',
                    background: '#141312',
                    border: '1px solid rgba(236,232,223,0.2)',
                    color: '#ECE8DF',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Only</option>
                  <option value="confirmed">Confirmed Only</option>
                  <option value="rejected">Rejected Only</option>
                </select>

                {/* Student Type Filter */}
                <select
                  id="filter-reg-type"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setRegPage(1);
                  }}
                  style={{
                    height: '40px',
                    padding: '0 14px',
                    background: '#141312',
                    border: '1px solid rgba(236,232,223,0.2)',
                    color: '#ECE8DF',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="all">All Student Types</option>
                  <option value="internal">NIT Rourkela (Internal)</option>
                  <option value="external">External Students</option>
                </select>

                <button
                  type="button"
                  onClick={fetchRegistrations}
                  style={{
                    height: '40px',
                    padding: '0 16px',
                    background: 'rgba(236,232,223,0.1)',
                    border: '1px solid rgba(236,232,223,0.2)',
                    color: '#ECE8DF',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.1em',
                    cursor: 'pointer',
                  }}
                >
                  REFRESH
                </button>
              </div>

              {/* CSV Export Button */}
              <button
                id="export-registrations-csv-btn"
                type="button"
                onClick={exportRegistrationsCSV}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '40px',
                  padding: '0 20px',
                  background: 'oklch(0.8 0.12 85)',
                  color: '#141312',
                  border: 0,
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  cursor: 'pointer',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>EXPORT REGISTRATIONS (CSV)</span>
              </button>
            </div>

            {/* Registrations Table */}
            <div
              style={{
                overflowX: 'auto',
                border: '1px solid rgba(236,232,223,0.12)',
                background: 'rgba(16,15,14,0.6)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '980px' }}>
                <thead>
                  <tr style={{ background: 'rgba(236,232,223,0.06)', borderBottom: '1px solid rgba(236,232,223,0.12)' }}>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>REG ID</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>PARTICIPANT</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>COLLEGE & ENROLLMENT</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>TYPE</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>PROOFS</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>FEE / UTR</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>STATUS</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRegs ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(236,232,223,0.6)' }}>
                        Loading registrations from database...
                      </td>
                    </tr>
                  ) : registrations.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center' }}>
                        <div style={{ color: '#ECE8DF', fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>
                          No event registrations submitted yet.
                        </div>
                        <div style={{ color: 'rgba(236,232,223,0.55)', fontSize: '13px', maxWidth: '540px', margin: '0 auto 18px', lineHeight: 1.5 }}>
                          Event registrations appear here once an attendee submits the Fest Registration form. To view all Google-authenticated user profiles and accounts, switch to the Users Directory tab.
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setTab('users')}
                            style={{
                              padding: '8px 18px',
                              background: 'oklch(0.8 0.12 85)',
                              color: '#141312',
                              border: 0,
                              fontWeight: 700,
                              fontSize: '12px',
                              letterSpacing: '.12em',
                              cursor: 'pointer',
                            }}
                          >
                            VIEW USERS DIRECTORY ({users.length})
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedRegistrations.map((reg) => {
                      const isPending = reg.status === 'pending';
                      const isBusy = actionBusyId === (reg.id || reg.registration_id);

                      return (
                        <tr
                          key={reg.id || reg.registration_id}
                          style={{
                            borderBottom: '1px solid rgba(236,232,223,0.06)',
                            transition: 'background-color .2s',
                          }}
                        >
                          {/* Reg ID */}
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{ fontFamily: 'var(--font-cinzel), serif', fontWeight: 900, fontSize: '15px', color: 'oklch(0.8 0.12 85)' }}>
                              {reg.registration_id}
                            </span>
                          </td>

                          {/* Participant */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{reg.name}</div>
                            <div style={{ fontSize: '12px', color: 'rgba(236,232,223,0.65)' }}>{reg.email}</div>
                            <div style={{ fontSize: '12px', color: 'rgba(236,232,223,0.5)' }}>+91 {reg.phone}</div>
                          </td>

                          {/* College & Enrollment */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{reg.college}</div>
                            {reg.enrollment_no && (
                              <div style={{ fontSize: '11px', color: 'oklch(0.8 0.12 85)', marginTop: '2px' }}>
                                Roll: {reg.enrollment_no}
                              </div>
                            )}
                          </td>

                          {/* Student Type */}
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '.1em',
                                background: reg.student_type === 'internal' ? 'rgba(220,183,106,0.15)' : 'rgba(236,232,223,0.08)',
                                color: reg.student_type === 'internal' ? 'oklch(0.8 0.12 85)' : '#ECE8DF',
                                border: '1px solid rgba(236,232,223,0.15)',
                              }}
                            >
                              {reg.student_type === 'internal' ? 'NIT RKL' : 'EXTERNAL'}
                            </span>
                          </td>

                          {/* Proofs */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {reg.id_card_url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage({ url: reg.id_card_url, title: `College ID · ${reg.name}` })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'transparent',
                                    border: '1px solid rgba(236,232,223,0.2)',
                                    color: '#ECE8DF',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>View ID Card</span>
                                </button>
                              )}
                              {reg.payment_screenshot_url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage({ url: reg.payment_screenshot_url!, title: `Payment Screenshot · ${reg.name}` })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'transparent',
                                    border: '1px solid rgba(236,232,223,0.2)',
                                    color: 'oklch(0.8 0.12 85)',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>View Payment</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Fee / UTR */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>
                              {reg.amount === 0 ? 'FREE' : `₹${reg.amount}`}
                            </div>
                            {reg.utr && (
                              <div style={{ fontSize: '11px', color: 'rgba(236,232,223,0.6)', letterSpacing: '.04em' }}>
                                UTR: {reg.utr}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '.12em',
                                textTransform: 'uppercase',
                                border: '1px solid currentColor',
                                color:
                                  reg.status === 'confirmed'
                                    ? 'oklch(0.75 0.16 145)'
                                    : reg.status === 'pending'
                                    ? 'oklch(0.8 0.15 80)'
                                    : 'oklch(0.74 0.15 35)',
                                background:
                                  reg.status === 'confirmed'
                                    ? 'rgba(74,222,128,0.1)'
                                    : reg.status === 'pending'
                                    ? 'rgba(250,204,21,0.1)'
                                    : 'rgba(239,68,68,0.1)',
                              }}
                            >
                              {reg.status}
                            </span>
                          </td>

                          {/* Action (Approve / Reject) */}
                          <td style={{ padding: '14px 18px' }}>
                            {isPending ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleUpdateStatus(reg, 'confirmed')}
                                  title="Approve pass"
                                  style={{
                                    padding: '6px 12px',
                                    background: 'oklch(0.75 0.16 145)',
                                    color: '#07150c',
                                    border: 0,
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    letterSpacing: '.08em',
                                    cursor: isBusy ? 'wait' : 'pointer',
                                  }}
                                >
                                  APPROVE
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleUpdateStatus(reg, 'rejected')}
                                  title="Reject registration"
                                  style={{
                                    padding: '6px 12px',
                                    background: 'oklch(0.74 0.15 35)',
                                    color: '#fff',
                                    border: 0,
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    letterSpacing: '.08em',
                                    cursor: isBusy ? 'wait' : 'pointer',
                                  }}
                                >
                                  REJECT
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(236,232,223,0.4)', fontSize: '11px', fontWeight: 600 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <span>LOCKED</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Registrations Pagination */}
            {renderPaginationBar(
              currentRegPage,
              totalRegPages,
              regStart,
              regEnd,
              registrations.length,
              'registrations',
              setRegPage
            )}
          </div>
        )}

        {/* TAB 2: EVENTS (Authorized IT Team & Admin) */}
        {activeTab === 'events' && (
          <EventsManager
            currentUser={currentUser}
            getAuthToken={getAuthToken}
            showToast={showToast}
            setConfirmModal={setConfirmModal}
            setPreviewImage={setPreviewImage}
          />
        )}

        {/* TAB 3: GALLERY (Authorized IT Team & Admin) */}
        {activeTab === 'gallery' && (
          <GalleryManager
            currentUser={currentUser}
            getAuthToken={getAuthToken}
            showToast={showToast}
            setConfirmModal={setConfirmModal}
            setPreviewImage={setPreviewImage}
          />
        )}

        {/* TAB 4: USERS DIRECTORY & ROLE MANAGEMENT (Admin Only) */}
        {activeTab === 'users' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Stat Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              {[
                { label: 'TOTAL LOGGED-IN USERS', value: users.length, color: '#ECE8DF' },
                { label: 'NIT RKL STUDENTS', value: users.filter((u) => u.student_type === 'internal').length, color: 'oklch(0.8 0.12 85)' },
                { label: 'EXTERNAL STUDENTS', value: users.filter((u) => u.student_type === 'external').length, color: '#ECE8DF' },
                { label: 'STAFF (ADMIN / IT-TEAM)', value: users.filter((u) => u.role !== 'user').length, color: 'oklch(0.65 0.18 30)' },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: '20px',
                    background: 'rgba(236,232,223,0.03)',
                    border: '1px solid rgba(236,232,223,0.1)',
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>
                    {stat.label}
                  </span>
                  <div
                    style={{
                      marginTop: '8px',
                      fontFamily: 'var(--font-cinzel), serif',
                      fontWeight: 900,
                      fontSize: '32px',
                      lineHeight: 1,
                      color: stat.color,
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Filter & Export Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '16px 20px',
                background: 'rgba(236,232,223,0.02)',
                border: '1px solid rgba(236,232,223,0.08)',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  id="search-users-input"
                  type="text"
                  placeholder="Search user by name, email, phone..."
                  value={searchUser}
                  onChange={(e) => {
                    setSearchUser(e.target.value);
                    setUserPage(1);
                  }}
                  style={{
                    width: '300px',
                    height: '40px',
                    padding: '0 14px',
                    background: 'rgba(236,232,223,0.05)',
                    border: '1px solid rgba(236,232,223,0.2)',
                    color: '#ECE8DF',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={fetchUsers}
                  style={{
                    height: '40px',
                    padding: '0 16px',
                    background: 'rgba(236,232,223,0.1)',
                    border: '1px solid rgba(236,232,223,0.2)',
                    color: '#ECE8DF',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.1em',
                    cursor: 'pointer',
                  }}
                >
                  REFRESH
                </button>
              </div>

              {/* Export Users CSV Button */}
              <button
                id="export-users-csv-btn"
                type="button"
                onClick={exportUsersCSV}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '40px',
                  padding: '0 20px',
                  background: 'oklch(0.8 0.12 85)',
                  color: '#141312',
                  border: 0,
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  cursor: 'pointer',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>EXPORT USERS (CSV)</span>
              </button>
            </div>

            {/* Users Table */}
            <div
              style={{
                overflowX: 'auto',
                border: '1px solid rgba(236,232,223,0.12)',
                background: 'rgba(16,15,14,0.6)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                <thead>
                  <tr style={{ background: 'rgba(236,232,223,0.06)', borderBottom: '1px solid rgba(236,232,223,0.12)' }}>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>USER</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>EMAIL</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>PHONE</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>STUDENT TYPE</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>ASSIGNED ROLE</th>
                    <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>JOINED</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'rgba(236,232,223,0.6)' }}>
                        Loading user directory...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'rgba(236,232,223,0.6)' }}>
                        No users match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => {
                      const isRoleBusy = roleBusyId === u.id;

                      return (
                        <tr
                          key={u.id}
                          style={{
                            borderBottom: '1px solid rgba(236,232,223,0.06)',
                            transition: 'background-color .2s',
                          }}
                        >
                          {/* User Avatar & Name */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {u.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={u.avatar_url}
                                  alt={u.full_name}
                                  referrerPolicy="no-referrer"
                                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: 'rgba(236,232,223,0.1)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontWeight: 700,
                                    fontSize: '14px',
                                    color: 'oklch(0.8 0.12 85)',
                                  }}
                                >
                                  {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                              )}
                              <span style={{ fontWeight: 700, fontSize: '14px' }}>{u.full_name}</span>
                            </div>
                          </td>

                          {/* Email */}
                          <td style={{ padding: '14px 18px', fontSize: '13px', color: 'rgba(236,232,223,0.8)' }}>
                            {u.email}
                          </td>

                          {/* Phone */}
                          <td style={{ padding: '14px 18px', fontSize: '13px' }}>
                            {u.phone ? `+91 ${u.phone}` : <span style={{ color: 'rgba(236,232,223,0.4)' }}>Not provided</span>}
                          </td>

                          {/* Student Type */}
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '.1em',
                                background: u.student_type === 'internal' ? 'rgba(220,183,106,0.15)' : 'rgba(236,232,223,0.08)',
                                color: u.student_type === 'internal' ? 'oklch(0.8 0.12 85)' : '#ECE8DF',
                                border: '1px solid rgba(236,232,223,0.15)',
                              }}
                            >
                              {u.student_type === 'internal' ? 'NIT ROURKELA' : 'EXTERNAL'}
                            </span>
                          </td>

                          {/* Role Selector */}
                          <td style={{ padding: '14px 18px' }}>
                            {u.role === 'admin' ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    letterSpacing: '.1em',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: 'oklch(0.8 0.15 35)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                  }}
                                  title="Admin role is protected and can only be modified directly in the database."
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                  </svg>
                                  ADMIN
                                </span>
                                <span style={{ fontSize: '10px', color: 'rgba(236,232,223,0.4)', fontStyle: 'italic' }}>
                                  (DB only)
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <select
                                  value={u.role}
                                  disabled={isRoleBusy}
                                  onChange={(e) =>
                                    handleChangeRole(u.id, e.target.value as 'user' | 'it-team', u.email)
                                  }
                                  style={{
                                    padding: '6px 10px',
                                    background: '#141312',
                                    border: '1px solid rgba(236,232,223,0.3)',
                                    color:
                                      u.role === 'it-team'
                                        ? 'oklch(0.8 0.15 240)'
                                        : '#ECE8DF',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: isRoleBusy ? 'wait' : 'pointer',
                                    outline: 'none',
                                  }}
                                >
                                  <option value="user">User (Normal)</option>
                                  <option value="it-team">IT-Team</option>
                                </select>
                                {isRoleBusy && <span style={{ fontSize: '11px', color: 'oklch(0.8 0.12 85)' }}>Updating...</span>}
                              </div>
                            )}
                          </td>

                          {/* Joined */}
                          <td style={{ padding: '14px 18px', fontSize: '12px', color: 'rgba(236,232,223,0.5)' }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Users Directory Pagination */}
            {renderPaginationBar(
              currentUserPage,
              totalUserPages,
              userStart,
              userEnd,
              filteredUsers.length,
              'users',
              setUserPage
            )}
          </div>
        )}
      </main>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 95,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '85vw',
              maxHeight: '85vh',
              background: '#100f0e',
              border: '1px solid rgba(236,232,223,0.25)',
              clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '.08em', color: 'oklch(0.8 0.12 85)' }}>
                {previewImage.title}
              </span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: 'rgba(236,232,223,0.06)',
                    border: '1px solid rgba(236,232,223,0.2)',
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                    color: '#ECE8DF',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '.06em',
                    textDecoration: 'none',
                  }}
                >
                  <span>Open Original ↗</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: '32px',
                    height: '32px',
                    background: 'rgba(236,232,223,0.08)',
                    border: '1px solid rgba(236,232,223,0.2)',
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                    color: '#ECE8DF',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage.url}
              alt={previewImage.title}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                border: '1px solid rgba(236,232,223,0.15)',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
