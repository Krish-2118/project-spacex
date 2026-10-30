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
  /** Rejected registrations only: the reason staff gave (src/lib/rejections.ts), if any. */
  rejectionReason?: string | null;
  /** Rejected registrations only: how many more times the student may register. */
  attemptsLeft?: number;
  /**
   * Pending and confirmed registrations only: whether the college ID card is uploaded. 'pending' shows the upload
   * banner on MY PASS (and holds up approval of a pending registration).
   */
  idCard?: 'uploaded' | 'pending';
  /** With idCard 'pending': why staff asked for a new ID card (src/lib/id-cards.ts), if they did. */
  idCardReuploadReason?: string | null;
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
