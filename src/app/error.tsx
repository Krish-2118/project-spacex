'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import ErrorFallback from '@/components/innovision/ErrorFallback';

/** Catches a crash inside the page; the root layout (fonts, globals.css) still renders around it. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <ErrorFallback retry={retry} digest={error.digest} />;
}
