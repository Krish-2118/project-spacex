import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadIdCard } from '@/lib/id-card-storage';
import { registrationsClosedResponse, registrationsOpen } from '@/lib/registration-gate';
import { ATTEMPTS_USED_UP_ERROR, attemptsLeft } from '@/lib/rejections';
import {
  buildOwnedUploadPath,
  createRateLimiter,
  detectFileType,
  formFile,
  ID_CARD_MAX_BYTES,
  ID_CARD_MIME_TYPES,
  isIdCardFileType,
  readFormLimited,
} from '@/lib/security';

export const runtime = 'nodejs';

const TOO_LARGE = 'That photo is larger than 2 MB. Please choose a smaller photo of your ID card.';
const ALREADY_UPLOADED = 'Your college ID card is already uploaded. Contact the registration helpdesk to change it.';

// Allow retries but stop bulk abuse of storage.
const idCardLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

/**
 * POST /api/id-card
 * Uploads a photo of the front of the caller's college ID card to the private `id-cards` bucket (supabase/schema.sql
 * section 19). The file type is decided by its magic bytes and the object path is chosen here from the verified user
 * id, exactly like /api/upload for payment screenshots. What happens next depends on the caller's registration:
 * - none yet (or only rejected ones, with attempts left): the student is filling in the registration form. Only while
 *   registrations are open. The path is returned and submitted with the registration (/api/register checks it).
 * - pending or confirmed without an ID card (registered before ID cards were asked for, or staff asked for a new
 *   one): the card is attached to it right away, even after registrations close. MY PASS uses this.
 * - pending or confirmed with an ID card: refused, a card can't be swapped by the student.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required: please sign in before uploading files.' },
        { status: 401 }
      );
    }
    const userId = auth.user.id;

    if (!idCardLimiter.hit(userId)) {
      return NextResponse.json(
        { error: 'Too many uploads. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(idCardLimiter.retryAfterSeconds(userId)) } }
      );
    }

    // Which case this is, before reading the body (a closed form or a locked card needs no upload).
    const client = getSupabaseAdmin(auth.token);
    const [active, rejected] = await Promise.all([
      client.from('registrations').select('id, id_card_path').eq('user_id', userId).neq('status', 'rejected').limit(1).maybeSingle(),
      client.from('registrations').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'rejected'),
    ]);
    if (active.error || rejected.error) {
      console.error('ID card upload: registration lookup failed:', active.error || rejected.error);
      return NextResponse.json({ error: 'Failed to upload your ID card. Please try again.' }, { status: 500 });
    }
    const registration = active.data as { id: string; id_card_path: string | null } | null;
    if (registration?.id_card_path) {
      return NextResponse.json({ error: ALREADY_UPLOADED }, { status: 409 });
    }
    if (!registration) {
      if (!registrationsOpen()) return registrationsClosedResponse();
      if (attemptsLeft(rejected.count ?? 0) === 0) {
        return NextResponse.json({ error: ATTEMPTS_USED_UP_ERROR }, { status: 409 });
      }
    }

    const form = await readFormLimited(req, ID_CARD_MAX_BYTES + 64 * 1024);
    if (!form.ok) {
      return NextResponse.json({ error: form.status === 413 ? TOO_LARGE : form.error }, { status: form.status });
    }
    const file = formFile(form.value, 'file');
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > ID_CARD_MAX_BYTES) {
      return NextResponse.json({ error: TOO_LARGE }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const type = detectFileType(buffer);
    if (!isIdCardFileType(type)) {
      return NextResponse.json({ error: 'Upload a photo of your ID card (JPG, PNG or WebP).' }, { status: 400 });
    }

    // Server-chosen path `<verified user id>/<random uuid>.<ext>`: the client's filename never reaches storage.
    const path = buildOwnedUploadPath(userId, type);
    const upload = await uploadIdCard(userId, path, buffer, ID_CARD_MIME_TYPES[type]);
    if (!upload.ok) {
      console.error('ID card upload rejected by storage:', upload.error);
      return NextResponse.json({ error: 'Failed to upload your ID card. Please try again.' }, { status: 500 });
    }

    if (!registration) {
      // Registering now: only the storage path is returned (the bucket is private: there is no public URL).
      return NextResponse.json({ success: true, attached: false, path, size: file.size });
    }

    // Only fills an empty slot, so two uploads at once can't both win and a card is never swapped.
    const { data: attached, error: attachError } = await client
      .from('registrations')
      .update({ id_card_path: path, id_card_uploaded_at: new Date().toISOString(), id_card_reupload_reason: null })
      .eq('id', registration.id)
      .eq('user_id', userId)
      .neq('status', 'rejected')
      .is('id_card_path', null)
      .select('id')
      .maybeSingle();
    if (attachError) {
      console.error('ID card upload: attaching to the registration failed:', attachError);
      return NextResponse.json({ error: 'Failed to upload your ID card. Please try again.' }, { status: 500 });
    }
    if (!attached) {
      return NextResponse.json({ error: ALREADY_UPLOADED }, { status: 409 });
    }
    return NextResponse.json({ success: true, attached: true });
  } catch (error: unknown) {
    console.error('ID card upload error:', error);
    return NextResponse.json({ error: 'Failed to upload your ID card. Please try again.' }, { status: 500 });
  }
}
