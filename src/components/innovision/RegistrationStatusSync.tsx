'use client';
import { useEffect } from 'react';
import { getSupabase, type Registration } from '@/lib/supabase';
import { REGISTRATION_PREVIEW_ENABLED } from '@/config/launch';

/** Publish fresh server status to React; the previous background cache refresh did not. */
export default function RegistrationStatusSync({ userId, onChange }: { userId: string; onChange: (registration: Registration | null) => void }) {
  useEffect(() => {
    if (REGISTRATION_PREVIEW_ENABLED && userId === 'dev-preview-user') return;
    let cancelled = false;
    let busy = false;
    const refresh = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const token = (await getSupabase().auth.getSession()).data.session?.access_token;
        const response = await fetch('/api/register', { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data.success && (!data.registration || data.registration.user_id === userId)) onChange(data.registration ?? null);
      } catch { /* Preserve the last status during an outage; the pass independently revalidates. */ }
      finally { busy = false; }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 15_000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [userId, onChange]);
  return null;
}
