import { getSupabase } from '@/lib/supabase';
import { passRequestInit } from '@/lib/pass-experience';

export async function passRequest(path: string, body?: object) {
  const token = (await getSupabase().auth.getSession()).data.session?.access_token;
  const response = await fetch(path, passRequestInit(body, token));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load your pass. Please try again.');
  return data;
}
