import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadPaymentProof } from '@/lib/payment-proofs';
import {
  buildPaymentProofPath,
  createRateLimiter,
  detectFileType,
  formFile,
  isPaymentProofFileType,
  PAYMENT_PROOF_MIME_TYPES,
  readFormLimited,
} from '@/lib/security';

export const runtime = 'nodejs';

// Enforce 1 MiB maximum limit (must match the payment-proofs bucket file_size_limit in supabase/schema.sql)
const MAX_SIZE = 1024 * 1024;

// Registrants upload a payment screenshot; allow retries but stop bulk abuse of storage.
const uploadLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

/**
 * POST /api/upload
 * Uploads a registration payment screenshot to the private `payment-proofs` Supabase Storage bucket.
 * Requires a signed-in user; the file type is decided by its magic bytes, never by the client's name or MIME type.
 * The object path is chosen here from the verified user id: any path, folder or user id the client sends is ignored.
 * This route is the ONLY way to add a proof: users have no Storage INSERT policy, and the write uses the service role
 * after every check below has passed.
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

    if (!uploadLimiter.hit(auth.user.id)) {
      return NextResponse.json(
        { error: 'Too many uploads. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    const form = await readFormLimited(req, MAX_SIZE + 64 * 1024);
    if (!form.ok) {
      const error = form.status === 413 ? 'File size exceeds maximum limit of 1MB. Please select a smaller file.' : form.error;
      return NextResponse.json({ error }, { status: form.status });
    }
    const file = formFile(form.value, 'file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size === 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum limit of 1MB. Please select a smaller file.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const type = detectFileType(buffer);
    if (!isPaymentProofFileType(type)) {
      return NextResponse.json(
        {
          error: 'Upload the screenshot as an image (JPG, PNG or WebP).',
        },
        { status: 400 }
      );
    }

    // No new proofs once registered (a submitted proof can't be swapped). Formerly part of the Storage INSERT policy.
    const { data: registration, error: regErr } = await getSupabaseAdmin(auth.token)
      .from('registrations')
      .select('id')
      .eq('user_id', auth.user.id)
      .limit(1)
      .maybeSingle();
    if (regErr) {
      console.error('Payment proof upload: registration lookup failed:', regErr);
      return NextResponse.json({ error: 'Failed to upload file. Please try again.' }, { status: 500 });
    }
    if (registration) {
      return NextResponse.json(
        { error: 'You have already registered. Your payment screenshot can no longer be changed.' },
        { status: 409 }
      );
    }

    // Server-chosen path `<verified user id>/<random uuid>.<ext>`: the client's filename never reaches storage.
    const path = buildPaymentProofPath(auth.user.id, type);
    const upload = await uploadPaymentProof(auth.user.id, path, buffer, PAYMENT_PROOF_MIME_TYPES[type]);
    if (!upload.ok) {
      console.error('Payment proof upload rejected by storage:', upload.error);
      return NextResponse.json(
        { error: 'Failed to upload file. Please try again.' },
        { status: 500 }
      );
    }

    // Only the storage path is returned (the bucket is private: there is no public URL).
    return NextResponse.json({
      success: true,
      path,
      size: file.size,
    });
  } catch (error: unknown) {
    console.error('Payment proof upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.' },
      { status: 500 }
    );
  }
}
