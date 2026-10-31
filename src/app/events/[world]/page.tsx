/* eslint-disable @next/next/no-img-element -- posters are ImageKit URLs resized by ImageKit itself (posterThumb) */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { WORLDS, type World } from '@/components/innovision/data';
import EventsChrome from '@/components/events/EventsChrome';
import styles from '@/components/events/EventsPage.module.css';
import { eventsForWorld, fetchPublicEvents, posterThumb, worldBySlug, type PublicEvent } from '@/lib/events';
import { jsonLdScript, listPageJsonLd, pageMetadata } from '@/lib/seo';

// Rebuilt in the background at most every 5 minutes, so newly published events appear without a deploy.
export const revalidate = 300;
// Only the four worlds exist: any other /events/<slug> is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return WORLDS.map((w) => ({ world: w.slug }));
}

/** Meta description: which world, of which fest, and its tagline (short enough not to be cut off in results). */
const description = (w: World) => `${w.name} at INNOVISION 2026, Eastern India's largest techno-management fest, hosted by NIT Rourkela, Odisha. ${w.tagline}`;

export async function generateMetadata({ params }: PageProps<'/events/[world]'>): Promise<Metadata> {
  const w = worldBySlug((await params).world);
  if (!w) return {};
  return pageMetadata({ title: w.name, description: description(w), path: `/events/${w.slug}`, ownImage: true });
}

/** One event card: the published poster, title, description and the format / duration / venue the organisers set. */
function EventCard({ ev, eager }: { ev: PublicEvent; eager: boolean }) {
  const facts = ([['FORMAT', ev.format], ['DURATION', ev.duration], ['VENUE', ev.venue]] as const).filter(([, v]) => v && v.trim());
  return (
    <li>
      <article className={styles.card}>
        {ev.poster_url && (
          <img className={styles.poster} src={posterThumb(ev.poster_url)} alt={`${ev.title} poster`} width={640} height={800}
            loading={eager ? undefined : 'lazy'} decoding="async" />
        )}
        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>{ev.title}</h3>
          {ev.description && <p className={styles.cardText}>{ev.description}</p>}
          {facts.length > 0 && (
            <dl className={styles.facts}>
              {facts.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}
        </div>
      </article>
    </li>
  );
}

/**
 * /events/<world>: one world of the Celestial Odyssey and the events it has published, as crawlable HTML.
 * Event names, descriptions and details come from the events table only, never from the placeholder line-ups in
 * data.ts; a world with nothing published says so. ENTER THE WORLD opens the same world in the animated explorer.
 */
export default async function WorldPage({ params }: PageProps<'/events/[world]'>) {
  const w = worldBySlug((await params).world);
  if (!w) notFound();

  const all = await fetchPublicEvents();
  // ISR keeps serving the last good page when a background rebuild throws; only a build without the database renders
  // the announcement state instead.
  if (all === null && process.env.NEXT_PHASE !== 'phase-production-build') throw new Error('Events are unavailable');
  const events = eventsForWorld(w, all ?? []);
  // A world combining several categories lists them in titled groups, as the explorer does (events without a
  // category, which every world lists, come last and untitled).
  const cat = (ev: PublicEvent) => ev.category?.toLowerCase().trim();
  const groups: [string | null, PublicEvent[]][] = w.groups
    ? ([
      ...w.groups.map(([c, title]) => [title, events.filter((ev) => cat(ev) === c)]),
      [null, events.filter((ev) => !w.groups!.some(([c]) => c === cat(ev)))],
    ] as [string | null, PublicEvent[]][]).filter(([, l]) => l.length)
    : [[null, events]];
  const ordered = groups.flatMap(([, l]) => l);

  const path = `/events/${w.slug}`;
  const trail: [string, string][] = [['Home', '/'], ['Events', '/events'], [w.name, path]];
  const jsonLd = listPageJsonLd({
    name: `${w.name} – INNOVISION 2026`, description: description(w), path, trail,
    items: ordered.map((ev) => ({ name: ev.title })),
  });
  const next = WORLDS[(WORLDS.indexOf(w) + 1) % WORLDS.length];

  return (
    <EventsChrome trail={trail}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div style={{ '--accent': w.accentL } as CSSProperties}>
        <section className={styles.hero}>
          <p className={styles.kicker}>INNOVISION 2026 · NIT ROURKELA · {w.statL.toUpperCase()}</p>
          <h1 className={styles.title}>{w.name}</h1>
          <p className={styles.tagline}>{w.tagline}</p>
          <p className={styles.lead}>{w.intro}</p>
          <div className={styles.actions}>
            <a href={`/#/world/${w.slug}`} className={`${styles.cta} ${styles.ctaPrimary}`}>ENTER THE WORLD</a>
            <Link prefetch={false} href="/events" className={`${styles.cta} ${styles.ctaGhost}`}>ALL EVENTS</Link>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="lineup-heading">
          <div className={styles.sectionHead}>
            <h2 id="lineup-heading" className={styles.h2}>The line-up</h2>
            {events.length > 0 && <p className={styles.count}>{events.length} {events.length === 1 ? 'EVENT' : 'EVENTS'}</p>}
          </div>
          {events.length === 0 ? (
            <p className={styles.notice}>
              The {w.name} line-up for Innovision 2026 hasn&apos;t been announced yet. Events will be listed here as soon
              as they are published. Meanwhile, explore the other worlds of the Celestial Odyssey.
            </p>
          ) : (
            groups.map(([title, list], gI) => (
              <div key={title ?? 'all'}>
                {title && <h3 className={styles.groupTitle}>{title.toUpperCase()}</h3>}
                <ul className={styles.grid}>
                  {list.map((ev, i) => <EventCard key={ev.id ?? ev.title} ev={ev} eager={gI === 0 && i < 2} />)}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className={styles.section} aria-label="Next world">
          <p className={styles.kicker}>NEXT WORLD · {next.statL.toUpperCase()}</p>
          <p className={styles.h2} style={{ '--accent': next.accentL } as CSSProperties}><Link prefetch={false} href={`/events/${next.slug}`}>{next.name} →</Link></p>
        </section>
      </div>
    </EventsChrome>
  );
}
