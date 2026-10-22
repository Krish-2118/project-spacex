import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OG_IMAGE } from '@/lib/seo';

// The link-preview card (Open Graph and X/Twitter) for the home page (src/app/opengraph-image.tsx) and the /events pages.
// It echoes the home hero: the ink disc with its starfield on the bone page, the title in DM Serif Display, and the gold
// subtitle line. Satori can't read woff2 or webp, hence the vendored TTF (src/assets/fonts, SIL OFL) and SVG/PNG art only.

const INK = '#141312';
const BONE = '#ECE8DF';
const GOLD = '#D9B661'; // oklch(0.8 0.12 85), the hero subtitle

export const OG_SIZE = { width: OG_IMAGE.width, height: OG_IMAGE.height };

/**
 * @param kicker small caps line above the title, e.g. 'NIT ROURKELA'.
 * @param kickerSub optional smaller second kicker line, e.g. 'STUDENT ACTIVITY CENTRE PRESENTS'.
 * @param title the big serif line; anything longer than INNOVISION is set smaller and may wrap onto two lines.
 * @param subtitle the gold line under the title.
 */
export async function ogCard({ kicker, kickerSub, title, subtitle }: { kicker: string; kickerSub?: string; title: string; subtitle: string }) {
  const [serif, starfield, logo] = await Promise.all([
    readFile(join(process.cwd(), 'src/assets/fonts/DMSerifDisplay-Regular.ttf')),
    readFile(join(process.cwd(), 'public/assets/starfield.svg')),
    readFile(join(process.cwd(), 'public/assets/INNOVISION LOGO.png')),
  ]);
  const disc = 600;
  const long = title.length > 10;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BONE }}>
        <div style={{ position: 'absolute', width: disc + 150, height: disc + 150, borderRadius: '50%', border: `1px dashed rgba(20,19,18,.35)` }} />
        <div
          style={{
            position: 'relative', width: disc, height: disc, borderRadius: '50%', overflow: 'hidden', background: INK,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
          <img src={`data:image/svg+xml;base64,${starfield.toString('base64')}`} alt="" width={disc * 1.78} height={disc} style={{ position: 'absolute', top: 0, left: -disc * 0.39 }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
          <img src={`data:image/png;base64,${logo.toString('base64')}`} alt="" width={84} height={84} style={{ marginBottom: 18 }} />
          <div style={{ color: BONE, fontSize: 20, letterSpacing: 6, fontWeight: 700 }}>{kicker}</div>
          {kickerSub && <div style={{ color: BONE, opacity: 0.78, fontSize: 17, letterSpacing: 4, fontWeight: 700, marginTop: 8 }}>{kickerSub}</div>}
          <div
            style={{
              display: 'flex', justifyContent: 'center', maxWidth: 470, textAlign: 'center', color: '#fff', fontFamily: 'DM Serif Display',
              fontSize: long ? 70 : 92, lineHeight: long ? 1.05 : 1, marginTop: 16,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: GOLD, fontSize: 22, letterSpacing: 5, fontWeight: 700, marginTop: 20 }}>
            <div style={{ width: 36, height: 1, background: GOLD, marginRight: 16 }} />
            {subtitle}
            <div style={{ width: 36, height: 1, background: GOLD, marginLeft: 16 }} />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: 'DM Serif Display', data: serif, style: 'normal', weight: 400 }] },
  );
}
