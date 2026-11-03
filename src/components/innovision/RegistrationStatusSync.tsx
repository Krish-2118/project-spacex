'use client';
import { useEffect } from 'react';
import { getSupabase, type Registration } from '@/lib/supabase';
import { REGISTRATION_PREVIEW_ENABLED } from '@/config/launch';

// Each refresh is several Supabase requests, and every one adds to the project's log quota. MY PASS polls the live
// status on its own (EntryPassCard), so this background sync can be slow. Coming back to the tab refreshes at once.
const POLL_MS = 60_000;
const MIN_GAP_MS = 10_000;

/** Publish fresh server status to React; the previous background cache refresh did not. */
export default function RegistrationStatusSync({ userId, onChange }: { userId: string; onChange: (registration: Registration | null) => void }) {
  useEffect(() => {
    if (REGISTRATION_PREVIEW_ENABLED && userId === 'dev-preview-user') return;
    let cancelled = false;
    let busy = false;
    let lastAt = 0;
    const refresh = async () => {
      if (busy || document.visibilityState !== 'visible' || Date.now() - lastAt < MIN_GAP_MS) return;
      busy = true;
      lastAt = Date.now();
      try {
        const token = (await getSupabase().auth.getSession()).data.session?.access_token;
        const response = await fetch('/api/register', { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data.success && (!data.registration || data.registration.user_id === userId)) onChange(data.registration ?? null);
      } catch { /* Preserve the last status during an outage; the pass independently revalidates. */ }
      finally { busy = false; }
    };
    void refresh(); const timer = setInterval(() => void refresh(), POLL_MS);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [userId, onChange]);
  return null;
}
