'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { Cinzel, Space_Grotesk } from 'next/font/google';
import ErrorFallback from '@/components/innovision/ErrorFallback';

// global-error replaces the root layout, so it brings its own fonts (same variables as layout.tsx) and document.
const cinzel = Cinzel({ variable: '--font-cinzel', weight: ['900'], subsets: ['latin'] });
const spaceGrotesk = Space_Grotesk({ variable: '--font-grotesk', weight: ['400', '700'], subsets: ['latin'] });

/** Catches a crash in the root layout itself. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en" className={`${cinzel.variable} ${spaceGrotesk.variable}`}>
      <body style={{ margin: 0, background: '#0c0b0a' }}>
        <title>INNOVISION 2026 · Signal lost</title>
        <ErrorFallback retry={retry} digest={error.digest} />
      </body>
    </html>
  );
}
