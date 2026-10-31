import Link from 'next/link';
import type { CSSProperties } from 'react';
import { WORLDS } from '@/components/innovision/data';
import EventsChrome from '@/components/events/EventsChrome';
import styles from '@/components/events/EventsPage.module.css';
import { eventsForWorld, fetchPublicEvents } from '@/lib/events';
import { jsonLdScript, listPageJsonLd, pageMetadata } from '@/lib/seo';

// Rebuilt in the background at most every 5 minutes, so newly published events appear without a deploy.
export const revalidate = 300;

const DESCRIPTION =
  "Explore the events of INNOVISION 2026 by NIT Rourkela, Eastern India's largest techno-management fest: Flagship, Standout, Main, and DTS and Fun Events.";

export const metadata = pageMetadata({ title: 'Events', description: DESCRIPTION, path: '/events', ownImage: true });

const TRAIL: [string, string][] = [['Home', '/'], ['Events', '/events']];

/**
 * /events: the four event worlds of the Celestial Odyssey with the events each has published, as crawlable HTML.
 * The animated explorer (#/worlds/... on the home page) stays the main way to browse; every world links into it.
 */
export default async function EventsPage() {
  const events = await fetchPublicEvents();
  // ISR keeps serving the last good page when a background rebuild throws; only a build without the database renders
  // the announcement state instead.
  if (events === null && process.env.NEXT_PHASE !== 'phase-production-build') throw new Error('Events are unavailable');
  const worlds = WORLDS.map((w) => ({ w, list: eventsForWorld(w, events ?? []) }));

  const jsonLd = listPageJsonLd({
    name: 'INNOVISION 2026 Events', description: DESCRIPTION, path: '/events', trail: TRAIL,
    items: WORLDS.map((w) => ({ name: w.name, path: `/events/${w.slug}` })),
  });

  return (
    <EventsChrome trail={TRAIL}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <section className={styles.hero}>
        <p className={styles.kicker}>INNOVISION 2026 · NIT ROURKELA</p>
        <h1 className={styles.title}>Innovision 2026 Events</h1>
        <p className={styles.lead}>
          Hosted by NIT Rourkela, Odisha, Innovision is Eastern India&apos;s largest techno-management fest. Its 2026
          edition, The Celestial Odyssey,
          charts four worlds: <b>Flagship Events</b> for the technical arena, <b>Standout Events</b> for the signature
          showcases, <b>Main Events</b> for workshops and talks, and <b>DTS and Fun Events</b> for the games, quizzes and
          showcases where the fest peaks.
        </p>
        <div className={styles.actions}>
          <a href={`/#/worlds/${WORLDS[0].slug}`} className={`${styles.cta} ${styles.ctaPrimary}`}>EXPLORE THE WORLDS</a>
          <Link prefetch={false} href="/" className={`${styles.cta} ${styles.ctaGhost}`}>BACK TO INNOVISION</Link>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="worlds-heading">
        <div className={styles.sectionHead}>
          <h2 id="worlds-heading" className={styles.h2}>The four worlds</h2>
        </div>
        <div className={styles.worlds}>
          {worlds.map(({ w, list }) => (
            <article key={w.slug} className={styles.world} style={{ '--accent': w.accentL } as CSSProperties}>
              <p className={styles.kicker} style={{ margin: 0, color: w.accentL }}>{w.statL.toUpperCase()} · {w.category.toUpperCase()}</p>
              <h3 className={styles.h2}><Link prefetch={false} href={`/events/${w.slug}`}>{w.name}</Link></h3>
              <p className={styles.tagline} style={{ margin: 0 }}>{w.tagline}</p>
              <p className={styles.worldIntro}>{w.intro}</p>
              {list.length > 0 ? (
                <>
                  <p className={styles.count}>{list.length} {list.length === 1 ? 'EVENT' : 'EVENTS'} PUBLISHED</p>
                  <ul className={styles.titles} aria-label={`${w.name} line-up`}>
                    {list.map((ev) => <li key={ev.id ?? ev.title}>{ev.title}</li>)}
                  </ul>
                </>
              ) : (
                <p className={styles.count}>LINE-UP ANNOUNCED SOON</p>
              )}
              <div className={styles.links}>
                <Link prefetch={false} href={`/events/${w.slug}`} className={styles.link}>{w.name.toUpperCase()} →</Link>
                <a href={`/#/world/${w.slug}`} className={styles.link}>ENTER THE WORLD</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </EventsChrome>
  );
}
