import { EVENT_DATE, SITE_NAME } from '@/config/site';
import type { ParticipantPass } from '@/lib/pass-experience';

/** Draw with the site's installed fonts; raster text preserves names in any script. */
async function renderPass(pass: ParticipantPass, qr: string | null) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image export unavailable.');
  const display = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'serif';
  const sans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'sans-serif';
  const wrap = (value: string, font: string, width: number) => {
    ctx.font = font;
    const lines: string[] = [];
    let line = '';
    // Prefer whole words; split only oversized words, without breaking combining characters.
    for (const word of value.trim().split(/\s+/)) {
      const joined = line ? `${line} ${word}` : word;
      if (ctx.measureText(joined).width <= width) { line = joined; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)) {
        if (line && ctx.measureText(line + segment).width > width) { lines.push(line); line = ''; }
        line += segment;
      }
    }
    if (line) lines.push(line.trim());
    return lines;
  };
  const name = wrap(pass.name ?? '', `700 44px ${sans}`, 592);
  const college = wrap(pass.college ?? '', `24px ${sans}`, 592);
  const height = 550 + name.length * 58 + college.length * 34 + (qr ? 300 : 0);
  canvas.width = 1400; canvas.height = height * 2;
  ctx.scale(2, 2);
  ctx.fillStyle = '#ECE8DF'; ctx.fillRect(0, 0, 700, height);
  ctx.fillStyle = '#141312'; ctx.fillRect(0, 0, 700, 12);
  let y = 66;
  const text = (value: string, font: string, color = '#141312') => {
    ctx.font = font; ctx.fillStyle = color; ctx.fillText(value, 54, y);
  };
  text(SITE_NAME, `bold 17px ${sans}`, '#786343'); y += 32;
  text(EVENT_DATE.label, `bold 16px ${sans}`, '#786343'); y += 40;
  text(pass.registrationId?.startsWith('PREVIEW-') ? 'DESIGN PREVIEW - NOT VALID FOR ENTRY' : 'YOUR INNO PASS, ISSUED.', `16px monospace`); y += 60;
  for (const line of name) { text(line, `700 44px ${sans}`); y += 58; }
  y += 26; text('COLLEGE', '16px monospace', '#5c574f'); y += 36;
  for (const line of college) { text(line, `24px ${sans}`); y += 34; }
  y += 24; text('VENUE', '16px monospace', '#5c574f'); y += 34;
  text('NIT Rourkela', `24px ${sans}`); y += 40;
  ctx.strokeStyle = '#b5a78d'; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(25, y); ctx.lineTo(675, y); ctx.stroke(); ctx.setLineDash([]);
  y += 42; text('REGISTRATION ID', '16px monospace', '#5c574f'); y += 38;
  text(pass.registrationId ?? '', 'bold 30px monospace'); y += 40;
  text('PAYMENT VERIFIED', 'bold 18px monospace', '#786343'); y += 30;
  if (qr) {
    const img = new Image(); img.src = qr; await img.decode();
    ctx.drawImage(img, 54, y, 240, 240); y += 270;
    text('Show your QR with your college ID. Keep it private.', `17px ${sans}`); y += 30;
  }
  text('See you at NIT Rourkela.', `22px ${display}`, '#5c574f');
  return canvas;
}

/** Retained for existing image-export callers. */
export async function downloadPass(pass: ParticipantPass, qr: string | null) {
  const canvas = await renderPass(pass, qr);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image export failed.')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `INNOVISION-${pass.registrationId}.png`; link.click();
  // Let the browser consume the download before releasing its object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Loaded only after Save PDF is pressed. No print dialog or server rendering required. */
export async function downloadPassPdf(pass: ParticipantPass) {
  const [{ jsPDF }, qr] = await Promise.all([
    import('jspdf'),
    pass.token ? import('qrcode').then(({ default: qrcode }) => qrcode.toDataURL(pass.token!, {
      width: 480, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#141312', light: '#ffffff' },
    })) : Promise.resolve(null),
  ]);
  const canvas = await renderPass(pass, qr);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const scale = Math.min(174 / canvas.width, 253 / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  pdf.setProperties({ title: `INNOVISION — ${pass.name}`, subject: 'Verified registration pass', creator: 'INNOVISION 2026, NIT Rourkela' });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (210 - width) / 2, 18, width, height);
  const id = (pass.registrationId ?? 'pass').replace(/[^A-Za-z0-9_-]/g, '');
  pdf.save(`INNOVISION-${id}.pdf`);
}
