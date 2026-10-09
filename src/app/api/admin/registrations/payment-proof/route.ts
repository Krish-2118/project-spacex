import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationStaff } from '@/lib/auth-server';
import { isPaymentProofPath, isUuid, PAYMENT_PROOF_URL_TTL_SECONDS } from '@/lib/security';
import { signPaymentProofUrl } from '@/lib/payment-proofs';

export const runtime = 'nodejs';

/**
 * GET /api/admin/registrations/payment-proof?id=<registration uuid>
 * IT-Team/Admin only. Returns a short-lived signed URL for the registration's private payment screenshot.
 * Staff have no Storage read access of their own: this route is the only way to view a proof.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid registration id' }, { status: 400 });
    }

    const { data: registration, error } = await auth.supabase
      .from('registrations')
      .select('user_id, payment_proof_path')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('/api/admin/registrations/payment-proof database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (!registration?.payment_proof_path) {
      return NextResponse.json({ error: 'No payment screenshot for this registration' }, { status: 404 });
    }

    // Only ever sign an object inside the registrant's own folder, never an arbitrary path stored in the row.
    if (!isPaymentProofPath(registration.payment_proof_path, registration.user_id)) {
      return NextResponse.json({ error: 'Stored payment screenshot is not a recognised upload' }, { status: 422 });
    }
    const url = await signPaymentProofUrl(registration.payment_proof_path);
    if (!url) {
      return NextResponse.json({ error: 'Failed to load payment screenshot' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url,
      expiresAt: new Date(Date.now() + PAYMENT_PROOF_URL_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (err: unknown) {
    console.error('/api/admin/registrations/payment-proof error:', err);
    return NextResponse.json({ error: 'Failed to load payment screenshot' }, { status: 500 });
  }
}
