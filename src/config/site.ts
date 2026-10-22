/**
 * The site's public identity: one canonical origin and the copy shared by metadata, robots.txt, sitemap.xml,
 * structured data and the Google sign-in return address.
 *
 * Canonical URLs are always built from SITE_URL, never from the request's Host header, so a preview deployment, a
 * per-deployment vercel.app URL or a spoofed Host never becomes the canonical address.
 */

// The production address. The www host is the primary one: innonitrkl.com (the apex) 308-redirects to it on Vercel.
// Every canonical URL, og:url, robots.txt, sitemap.xml and JSON-LD URL follows it. NEXT_PUBLIC_SITE_URL overrides it.
const DEFAULT_SITE_URL = 'https://www.innonitrkl.com';

/** Origin of NEXT_PUBLIC_SITE_URL (no trailing slash), or the default if it is unset or not an http(s) URL. */
function siteOrigin(value: string | undefined): string {
  try {
    const url = value ? new URL(value) : null;
    if (url && (url.protocol === 'https:' || url.protocol === 'http:')) return url.origin;
  } catch {}
  return DEFAULT_SITE_URL;
}

/**
 * Canonical origin. Google sign-in returns here too, so it must be listed under Supabase -> Authentication ->
 * URL Configuration.
 */
export const SITE_URL = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL);

/** The official brand name, exactly as it is written: og:site_name, the app name and the home page title. */
export const SITE_NAME = 'INNOVISION 2026 | NIT ROURKELA';
export const EVENT_DATE = { label: '13 NOV 2026', display: '13 November 2026' } as const;

/** Rourkela city coordinates (22°12′ N, 84°54′ E), used as a venue-city imprint.
 * Source: https://nitrkl.ac.in/docs/PlacementBrochure/09082017164608850.pdf */
export const VENUE_CITY = { latitude: 22.2, longitude: 84.9, imprint: '22°12′ N · 84°54′ E' } as const;

/** Home page title. Other pages use the "%s – INNOVISION 2026 | NIT ROURKELA" template from the root layout. */
export const SITE_TITLE = SITE_NAME;

/** The fest's official social profiles (the footer's links), for the Organization's sameAs in structured data. */
export const SOCIAL_PROFILES = [
  'https://www.instagram.com/inno.nitr_official/',
  'https://www.linkedin.com/company/innovision-nitrkl/',
];

export const SITE_DESCRIPTION =
  "Official website of INNOVISION 2026 by NIT Rourkela, Eastern India's largest techno-management fest. Explore the Flagship, Standout, Main, and DTS and Fun Events.";

/** Official WhatsApp Community / Group link for registered attendees. */
export const WHATSAPP_COMMUNITY_URL =
  'https://chat.whatsapp.com/ISNec5MRzMD3RTUPaT9Wqx?s=cl&p=a&mlu=4&ilr=4';

/**
 * Whether search engines may index this deployment. Only Vercel's production deployment is indexable: preview and
 * development deployments get `noindex` and a robots.txt that disallows everything, so they never compete with the
 * official site. Outside Vercel (VERCEL_ENV unset, e.g. a local `next start`) the build is treated as production.
 * Server-only: VERCEL_ENV is not exposed to the browser.
 */
export const INDEXABLE = (process.env.VERCEL_ENV ?? 'production') === 'production';
