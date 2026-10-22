import { OG_IMAGE } from '@/lib/seo';
import { OG_SIZE, ogCard } from '@/lib/og-card';

// The home page's link-preview card (Open Graph; twitter-image.tsx reuses it). Rendered once at build time.
// The /events pages draw their own cards with the same template (src/lib/og-card.tsx).

export const alt = OG_IMAGE.alt;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpengraphImage() {
  return ogCard({ kicker: 'NIT ROURKELA', kickerSub: 'STUDENT ACTIVITY CENTRE PRESENTS', title: 'INNOVISION', subtitle: '2026 · THE CELESTIAL ODYSSEY' });
}
