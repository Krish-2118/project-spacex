/** Shared contract. Only the authenticated pass endpoint may supply this data. */
export interface ParticipantPass {
  registrationStatus: 'none' | 'pending' | 'confirmed' | 'rejected';
  passStatus: 'none' | 'active' | 'revoked';
  registrationId: string | null;
  name: string | null;
  college: string | null;
  checkedIn: boolean;
  token: string | null;
  qrUnavailable?: string;
}

export function isApprovedPass(pass: ParticipantPass): boolean {
  return pass.registrationStatus === 'confirmed' && pass.passStatus === 'active'
    && !!pass.registrationId && !!pass.name && !!pass.college;
}

export function passStatusMessage(pass: ParticipantPass): string {
  if (pass.registrationStatus === 'pending') return 'Payment under review. The registration team will verify your payment before issuing your pass.';
  if (pass.registrationStatus === 'rejected') return 'Your payment was not approved. Please contact the registration helpdesk.';
  if (pass.passStatus === 'revoked') return 'Your pass has been cancelled. Please contact the registration helpdesk.';
  return 'Your pass is not available yet. Complete your registration and wait for the registration team to verify your payment.';
}

/** The canonical pass endpoint uses POST because it can mint the owner's QR token. */
export function passRequestInit(body?: object, token?: string): RequestInit {
  return {
    method: 'POST', cache: 'no-store',
    ...(body ? { keepalive: true, body: JSON.stringify(body) } : {}),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
}
