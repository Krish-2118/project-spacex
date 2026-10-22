'use client';

import { isApprovedPass, type ParticipantPass } from '@/lib/pass-experience';
import ApprovedPassTicket from './ApprovedPassTicket';
import styles from './PassIssued.module.css';
import { EVENT_DATE } from '@/config/site';

export default function PassTicket({ pass, animate = false }: {
  pass: ParticipantPass;
  qr: string | null;
  onQrClick?: () => void;
  animate?: boolean;
}) {
  if (isApprovedPass(pass)) return <ApprovedPassTicket pass={pass} animate={animate} />;
  // Pending approval state
  return (
    <article className={styles.ticket} aria-label={`Innovision pass for ${pass.name || 'Participant'}`}>
      <div className={styles.ticketBg} aria-hidden="true" />
      <div className={styles.foilBar} aria-hidden="true" />

      <div className={styles.ticketHeader}>
        <div className={styles.brandGroup}>
          <span className={styles.brandFest}>INNOVISION 2026</span>
          <span className={styles.brandSub}>NIT ROURKELA · TECHNO-MANAGEMENT FEST</span>
        </div>
        <span className={styles.statusVerified}>
          ◌ PAYMENT UNDER REVIEW
        </span>
      </div>

      <div className={styles.face}>
        <div className={styles.nameSection}>
          <p className={styles.nameLabel}>PARTICIPANT</p>
          <h3 className={styles.name}>{pass.name || 'Awaiting Verification'}</h3>
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.metaCol}>
            <span className={styles.label}>COLLEGE</span>
            <span className={styles.value}>{pass.college || 'Not provided'}</span>
          </div>
          <div className={styles.metaRow2}>
            <div className={styles.metaCol}>
              <span className={styles.label}>DATE</span>
              <span className={styles.value}>{EVENT_DATE.display}</span>
            </div>
            <div className={styles.metaCol}>
              <span className={styles.label}>REG ID</span>
              <span className={styles.valueMono}>{pass.registrationId || 'PENDING'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.perforation} aria-hidden="true">
        <span className={styles.perforationLine} />
      </div>

      <div className={styles.stub}>
        <div className={styles.stubLeft}>
          <span className={styles.admitOne}>ADMIT ONE</span>
          <span className={styles.stubId}>{pass.registrationId || 'PENDING'}</span>
        </div>
        <span className={styles.qrPlaceholder} aria-label="QR pending payment verification">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            <rect x="5" y="5" width="3" height="3" fill="currentColor"/><rect x="16" y="5" width="3" height="3" fill="currentColor"/>
            <rect x="5" y="16" width="3" height="3" fill="currentColor"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/>
          </svg>
          <span style={{ fontSize: '9px', letterSpacing: '.1em', marginTop: '2px' }}>UNDER REVIEW</span>
        </span>
      </div>
    </article>
  );
}
