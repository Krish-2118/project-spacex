import { QRCodeSVG } from 'qrcode.react';
import type { ParticipantPass } from '@/lib/pass-experience';
import { EVENT_DATE, VENUE_CITY } from '@/config/site';
import DecryptText from '@/components/ui/decrypt-text';
import styles from './PassKeepsake.module.css';

/** The readable, flat version of the pass, shared by phones and paper. */
export default function PassKeepsake({ pass, animate = false }: { pass: ParticipantPass; animate?: boolean }) {
  return (
    <article className={styles.card} data-animate={animate ? 'true' : undefined} aria-label={`Innovision pass for ${pass.name}`}>
      <header className={styles.brand}>
        <div><span className={styles.overline}>NIT ROURKELA PRESENTS</span><strong>INNOVISION <span>2026</span></strong></div>
        <span className={styles.seal}>PAYMENT<br />VERIFIED</span>
      </header>
      <div className={styles.dateRow}><span>EVENT DATE</span><strong>{EVENT_DATE.label}</strong></div>
      <div className={styles.main}>
        <span className={styles.overline}>ISSUED TO</span>
        <h3 className={styles.name}><DecryptText text={pass.name ?? ''} animate={animate} /></h3>
        <dl className={styles.details}>
          <div><dt>From · College</dt><dd>{pass.college}</dd></div>
          <div className={styles.destination}><dt>To · Venue</dt><dd><strong>NIT</strong><span>NIT Rourkela</span></dd></div>
        </dl>
      </div>
      <div className={styles.perforation} aria-hidden="true" />
      <div className={styles.stub}>
        <div className={styles.registration}>
          <span className={styles.overline}>REGISTRATION ID</span>
          <strong>{pass.registrationId}</strong>
          <p>Verified by the registration team.</p>
        </div>
        {pass.token && <div className={styles.qr}>
          <QRCodeSVG value={pass.token} size={176} level="M" marginSize={3} />
          <span>YOUR ENTRY QR</span>
        </div>}
      </div>
      <footer className={styles.footer}>See you at NIT Rourkela.<small>ROURKELA · {VENUE_CITY.imprint}</small></footer>
    </article>
  );
}
