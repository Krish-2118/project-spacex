import type { SVGProps } from 'react';

/** Four-point star used throughout the design. */
export function Sparkle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M12 0C12.8 7.5 16.5 11.2 24 12C16.5 12.8 12.8 16.5 12 24C11.2 16.5 7.5 12.8 0 12C7.5 11.2 11.2 7.5 12 0Z" fill="currentColor"></path>
    </svg>
  );
}

/** Ringed-planet INNOVISION mark. */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" {...props}>
      <ellipse cx="20" cy="20" rx="18" ry="18" fill="none" stroke="currentColor" strokeWidth="4"></ellipse>
      <ellipse cx="20" cy="22" rx="11" ry="7" fill="none" stroke="currentColor" strokeWidth="3.5"></ellipse>
    </svg>
  );
}
