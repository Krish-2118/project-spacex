'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import EventTicket from '@/components/ui/event-ticket';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ParticipantPass } from '@/lib/pass-experience';
import { EVENT_DATE, VENUE_CITY } from '@/config/site';
import PassKeepsake from './PassKeepsake';
import styles from './ApprovedPassTicket.module.css';

export default function ApprovedPassTicket({ pass, animate = false }: { pass: ParticipantPass; animate?: boolean }) {
  const [compact, setCompact] = useState<boolean | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [infoOpened, setInfoOpened] = useState(false);
  const qrButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = matchMedia('(max-width: 900px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const savePdf = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const { downloadPassPdf } = await import('./download-pass');
      await downloadPassPdf(pass);
    } catch {
      setSaveError('Could not save your pass. Please try again. Your pass is still available here.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.root}>
      {/* Only mount the illustrated canvas ticket on larger screens. */}
      {compact === null ? <div className={styles.preparing} aria-hidden="true" /> : compact || (pass.name?.length ?? 0) > 70 || (pass.college?.length ?? 0) > 90 ? <PassKeepsake pass={pass} animate={animate} /> : (
        <EventTicket
          title="INNOVISION 2026"
          tier="OFFICIAL PASS"
          date={EVENT_DATE.label}
          welcome={'SEE YOU\nAT INNO.'}
          eyebrow={'PAYMENT VERIFIED\nYOUR PASS IS READY'}
          words={['Bound for Rourkela.', `${pass.name?.trim().split(/\s+/)[0] ?? ''}, you’re in.`]}
          notes={[`REGISTRATION ${pass.registrationId}`, 'ISSUED TO YOU']}
          passenger={pass.name ?? ''}
          from={pass.college ?? ''}
          to="NIT"
          craft="PSLV"
          dateCode="13 NOV 2026"
          gate="—"
          group="INNO"
          seat={pass.registrationId ?? ''}
          boardingTime=""
          site="NIT Rourkela"
          lat={VENUE_CITY.latitude}
          lon={VENUE_CITY.longitude}
          showCoordinates
          registrationPass
          animateInfo={infoOpened}
          seq={`REGISTRATION ${pass.registrationId}`}
          featuring="Your payment is verified."
          headline="See you at INNO."
          stamp="Verified"
          sideLabels={['Artwork', 'Your pass']}
          defaultSide="front"
          onSideChange={(side) => { if (side === 'back') setInfoOpened(true); }}
          fontDisplay="var(--font-display), Georgia, serif"
          fontCondensed="var(--font-sans), 'Segoe UI', sans-serif"
          fontMono="ui-monospace, 'Courier New', monospace"
          qr={pass.token ? <QRCodeSVG value={pass.token} size={256} level="M" marginSize={3} /> : undefined}
          qrLabel={pass.token ? 'Your entry QR' : 'Registration ID'}
          night="#08070d" starInk="#f6f2e8" paper="#eeede7" paperInk="#141312" stampColor="#786343"
          tilt={2.5} maxWidth="100%"
        />
      )}
      <div className={styles.actions}>
        <button type="button" onClick={savePdf} disabled={saving} aria-busy={saving} className={styles.print}>{saving ? 'Preparing PDF…' : 'Save PDF'}</button>
        {pass.token && <button ref={qrButton} type="button" onClick={() => setQrOpen(true)}>View entry QR</button>}
      </div>
      <p className={styles.note}>{pass.qrUnavailable || 'Keep your pass handy. Your registration ID is always available here.'}</p>
      {saveError && <p className={styles.note} role="alert">{saveError}</p>}

      {pass.token && <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className={styles.dialog} onCloseAutoFocus={(event) => { event.preventDefault(); qrButton.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Your entry QR</DialogTitle>
            <DialogDescription>Show this code to the registration team at NIT Rourkela.</DialogDescription>
          </DialogHeader>
          <div className={styles.largeQr}><QRCodeSVG value={pass.token} size={280} level="M" marginSize={4} /></div>
          <p className={styles.qrName}>{pass.name}<br /><span>{pass.registrationId}</span></p>
        </DialogContent>
      </Dialog>}

      {/* A direct child of body, outside the clipped/animated registration overlay. */}
      {compact !== null && createPortal(
        <div className={styles.printRoot} data-inno-print="" aria-hidden="true">
          <style>{`@media print {
            @page { size: A4 portrait; margin: 14mm; }
            html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: white !important; color: #141312 !important; }
            body::before, body::after { display: none !important; }
            body > :not([data-inno-print]) { display: none !important; }
            [data-inno-print] { display: block !important; position: static !important; width: 160mm; max-width: 100%; margin: 8mm auto 0; }
            [data-inno-print] * { animation: none !important; transition: none !important; }
          }`}</style>
          <PassKeepsake pass={pass} />
        </div>, document.body
      )}
    </div>
  );
}
