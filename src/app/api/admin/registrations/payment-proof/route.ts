import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth-server';
import { isImageKitUrlInFolder, isUuid } from '@/lib/security';
import { PAYMENT_PROOF_URL_TTL_SECONDS, signedImageKitUrl } from '@/lib/imagekit';

export const runtime = 'nodejs';

/**
 * GET /api/admin/registrations/payment-proof?id=<registration uuid>
 * IT-Team/Admin only. Returns a short-lived signed URL for the registration's private payment screenshot.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid registration id' }, { status: 400 });
    }

    const { data: registration, error } = await auth.supabase
      .from('registrations')
      .select('payment_screenshot_url')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('/api/admin/registrations/payment-proof database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (!registration?.payment_screenshot_url) {
      return NextResponse.json({ error: 'No payment screenshot for this registration' }, { status: 404 });
    }

    // Only ever sign our own payment uploads, never an arbitrary URL stored in the row.
    const endpoint = process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '';
    const stored = registration.payment_screenshot_url;
    if (!isImageKitUrlInFolder(stored, endpoint, '/innovision/payments')) {
      return NextResponse.json({ error: 'Stored payment screenshot is not a recognised upload' }, { status: 422 });
    }
    const { origin, pathname } = new URL(stored);

    return NextResponse.json({
      success: true,
      url: signedImageKitUrl(`${origin}${pathname}`, PAYMENT_PROOF_URL_TTL_SECONDS),
      expiresAt: new Date(Date.now() + PAYMENT_PROOF_URL_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (err: unknown) {
    console.error('/api/admin/registrations/payment-proof error:', err);
    return NextResponse.json({ error: 'Failed to load payment screenshot' }, { status: 500 });
  }
}
