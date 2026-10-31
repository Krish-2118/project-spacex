/* eslint-disable @next/next/no-img-element -- static decorative SVG, no optimisation needed */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { WORLDS } from '@/components/innovision/data';
import { Logo } from '@/components/innovision/icons';
import styles from './EventsPage.module.css';

/**
 * Frame shared by /events, /events/<world>, /privacy and /terms: the INNOVISION wordmark home link, the breadcrumb trail the page's
 * BreadcrumbList JSON-LD describes, and a footer linking every world page. Server-rendered, no client JS.
 * Links into the animated explorer (/#/...) are plain <a>, not <Link>: the explorer reads its hash route once its
 * loader finishes, and a full page load is what keeps that hash (as for a visitor arriving from search).
 * Every <Link> here (and on the /events pages) has prefetch={false}: by default each one in the viewport costs uncached
 * RSC requests on Vercel (3 to 5 per page view were measured). A click still navigates client-side, fetching then.
 *
 * @param trail [name, path] from the home page down to this page; the last entry is the current page.
 */
export default function EventsChrome({ trail, children }: { trail: [string, string][]; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <img className={styles.stars} src="/assets/starfield.svg" alt="" decoding="async" />
      <div className={styles.wrap}>
        <header className={styles.top}>
          <Link prefetch={false} href="/" className={styles.brand} aria-label="INNOVISION 2026 home">
            <Logo style={{ width: '22px' }} />
            INNOVISION
          </Link>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <ol>
              {trail.map(([name, path], i) => (
                <li key={path}>
                  {i === trail.length - 1 ? <span aria-current="page">{name}</span> : <Link prefetch={false} href={path}>{name}</Link>}
                </li>
              ))}
            </ol>
          </nav>
        </header>
        <main>{children}</main>
        <footer className={styles.foot}>
          <nav aria-label="Event worlds">
            <p>WORLDS</p>
            <ul>
              <li><Link prefetch={false} href="/events">All events</Link></li>
              {WORLDS.map((w) => <li key={w.slug}><Link prefetch={false} href={`/events/${w.slug}`}>{w.name}</Link></li>)}
            </ul>
          </nav>
          <nav aria-label="Innovision">
            <p>INNOVISION</p>
            <ul>
              <li><Link prefetch={false} href="/">Home</Link></li>
              <li><a href={`/#/worlds/${WORLDS[0].slug}`}>Explore the worlds</a></li>
              <li><Link prefetch={false} href="/register">Registrations</Link></li>
              <li><Link prefetch={false} href="/merch">Official merch</Link></li>
              <li><Link prefetch={false} href="/privacy">Privacy Policy</Link></li>
              <li><Link prefetch={false} href="/terms">Terms and Conditions</Link></li>
            </ul>
          </nav>
          <p style={{ margin: 0, alignSelf: 'flex-end' }}>© 2026 Innovision · NIT Rourkela, Odisha</p>
        </footer>
      </div>
    </div>
  );
}
