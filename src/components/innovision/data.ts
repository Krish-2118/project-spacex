// Content and tuning constants for the Innovision 2026 experience.

export const A = '/assets/';

export type WorldKey = 'takeoff' | 'touchdown' | 'highpoint';

export interface World {
  key: WorldKey;
  /** URL segment used in #/worlds/<slug> and #/world/<slug>. */
  slug: string;
  name: string;
  category: string;
  accent: string;
  ink: string;
  tint: string;
  tint2: string;
  accentL: string;
  planet: string;
  astro: string;
  astroStyle?: import('react').CSSProperties;
  astroSit: boolean;
  music: WorldKey;
  /** Asset file names shown in the mission tickets' portholes (cycled). */
  gates: string[];
  coord: string;
  /** Drifting decoration on the worlds slide: image, left, top, height, rotation. */
  deco: string;
  decoL: string;
  decoT: string;
  decoH: string;
  decoR: string;
  statL: string;
  statR: string;
  tagline: string;
  intro: string;
  specs: [string, string][];
  /** [name, text, format, duration] */
  missions: [string, string, string, string][];
}

export const WORLDS: World[] = [
  { key: 'takeoff', slug: 'flagship-events', name: 'Flagship Events', category: 'Technical Events', accent: 'oklch(0.56 0.13 32)', accentL: 'oklch(0.76 0.11 38)', ink: 'oklch(0.3 0.08 32)', tint: 'oklch(0.94 0.02 55)', tint2: 'oklch(0.85 0.045 40)',
    planet: A + 'planet-yellow.webp', astro: '', astroSit: false, music: 'takeoff',
    gates: ['indian-astronaut.webp', 'astro-red.webp', 'spaceship.webp', 'big-spaceship.webp'],
    coord: 'RA 05h 35m · DEC −05° 23′', deco: A + 'spaceship.webp', decoL: 'clamp(28px,9vw,180px)', decoT: '31%', decoH: 'min(22vh, 210px)', decoR: '-14deg',
    statL: 'Mission 01', statR: 'Tech Arena', tagline: 'Code. Build. Break the atmosphere.',
    intro: 'Strap in for the technical arena of Innovision. Hackathons, robotics and coding battles where ideas get their launch thrust. Bring your crew, your laptop and your wildest builds.',
    specs: [['Category', 'Technical'], ['Format', 'Solo & team'], ['Launch pad', 'NIT Rourkela'], ['Fuel', 'Code & circuits'], ['Status', 'Boarding soon']],
    missions: [['Hackathon', 'A non-stop build sprint. Ship a working prototype before the countdown hits zero.', 'Team · 2–4', '36 hrs'], ['Robo Wars', 'Bring your bot into the arena. Last machine standing takes the crown.', 'Team · up to 5', 'Knockout'], ['Code Sprint', 'Competitive programming under pressure. Fast logic, faster fingers.', 'Solo', '3 hrs'], ['Circuit Lab', 'Design, debug and demo hardware that works on the first try.', 'Team · 2', '4 hrs']] },
  { key: 'touchdown', slug: 'main-events', name: 'Main Events', category: 'Workshops & Talks', accent: 'oklch(0.55 0.12 295)', accentL: 'oklch(0.77 0.09 295)', ink: 'oklch(0.3 0.08 295)', tint: 'oklch(0.94 0.018 295)', tint2: 'oklch(0.85 0.04 295)',
    planet: A + 'planet-blue.webp', astro: '', astroStyle: { transform: 'translateX(-44vh) translateY(12.5vh) rotate(-28deg)', height: '100%', mixBlendMode: 'multiply', filter: 'grayscale(1) contrast(2.2) brightness(1.2)' }, astroSit: false, music: 'touchdown',
    gates: ['astro-yellow.webp', 'home-astronaut.webp', 'spaceship.webp', 'planet-blue.webp'],
    coord: 'RA 18h 36m · DEC +38° 47′', deco: '', decoL: '62vw', decoT: '12vh', decoH: 'min(30vh, 280px)', decoR: '12deg',
    statL: 'Mission 02', statR: 'Learn & Land', tagline: 'A cosmic calm for curious minds.',
    intro: 'Slow the descent and land on new ideas. Hands-on workshops and talks from people who have been there, built that, and are ready to show you how.',
    specs: [['Category', 'Workshops'], ['Format', 'Hands-on'], ['Crew', 'Experts & alumni'], ['Fuel', 'Curiosity'], ['Status', 'Boarding soon']],
    missions: [['AI & ML Workshop', 'From first model to deployed demo in a single session.', 'Hands-on', 'Full day'], ['Guest Lectures', 'Stories and lessons from engineers, founders and researchers.', 'Open to all', '90 min'], ['Startup Talks', 'How ideas become companies, straight from the people who did it.', 'Open to all', '60 min'], ['Maker Labs', 'Solder, print and prototype with guidance at every step.', 'Limited seats', 'Half day']] },
  { key: 'highpoint', slug: 'dts-and-fun-events', name: 'DTS and Fun Events', category: 'Games & Showcases', accent: 'oklch(0.56 0.09 178)', accentL: 'oklch(0.8 0.08 178)', ink: 'oklch(0.3 0.06 185)', tint: 'oklch(0.94 0.018 178)', tint2: 'oklch(0.85 0.04 180)',
    planet: A + 'planet-green.webp', astro: A + 'astro-yellow.webp', astroSit: true, music: 'highpoint',
    gates: ['astro-green.webp', 'moon.webp', 'astro-red.webp', 'big-spaceship.webp'],
    coord: 'RA 13h 25m · DEC −11° 09′', deco: A + 'spaceship.webp', decoL: 'clamp(28px,9vw,180px)', decoT: '31%', decoH: 'min(21vh, 200px)', decoR: '24deg',
    statL: 'Mission 03', statR: 'Fun Zone', tagline: 'Ride the wave where the fest peaks.',
    intro: 'The best of both worlds: competition meets celebration. Gaming arenas, quizzes and showcases that keep the energy high until the very last night.',
    specs: [['Category', 'Fun & games'], ['Format', 'Open to all'], ['Vibe', 'Euphoric'], ['Fuel', 'Team spirit'], ['Status', 'Boarding soon']],
    missions: [['Gaming Arena', 'Squad up for LAN battles and console showdowns.', 'Squad', 'All night'], ['Quiz Night', 'Tech, pop culture and everything in between.', 'Team · 2–3', '3 rounds'], ['Treasure Hunt', 'Clues scattered across campus. Only the sharpest crews finish.', 'Team · 3–4', 'Campus-wide'], ['Project Expo', 'Walk the hall of student builds and vote for your favourite.', 'Open to all', 'All fest']] },
];

/** Images the loader waits for: everything the views display (unused design leftovers are not fetched). */
export const PRELOAD = ['indian-astronaut.webp', 'stars.webp', 'moon.webp', 'planet-yellow.webp', 'planet-blue.webp', 'planet-green.webp',
  'astro-red.webp', 'astro-yellow.webp', 'astro-green.webp', 'big-spaceship.webp', 'planet-blue-half.webp',
  'floor.webp', 'spaceship.webp', 'cloud-1.webp', 'cloud-2.webp', 'cloud-3.webp', 'cloud-4.webp', 'cloud-5.webp',
  'home-rocks.webp'];

export const HERO_SPARKS = [
  { x: '9%', y: '24%', s: '18px', c: '#141312' }, { x: '17%', y: '62%', s: '12px', c: '#141312' }, { x: '27%', y: '14%', s: '10px', c: '#141312' },
  { x: '83%', y: '18%', s: '22px', c: '#141312' }, { x: '91%', y: '58%', s: '12px', c: '#141312' }, { x: '74%', y: '84%', s: '16px', c: '#141312' },
  { x: '38%', y: '30%', s: '10px', c: '#ECE8DF' }, { x: '61%', y: '27%', s: '14px', c: '#ECE8DF' }, { x: '43%', y: '78%', s: '12px', c: '#ECE8DF' },
  { x: '58%', y: '72%', s: '9px', c: '#ECE8DF' },
];

export const LOADER_SPARKS = [
  { x: '12%', y: '20%', s: '16px' }, { x: '22%', y: '70%', s: '10px' }, { x: '84%', y: '26%', s: '20px' }, { x: '78%', y: '64%', s: '12px' },
  { x: '6%', y: '48%', s: '10px' }, { x: '93%', y: '44%', s: '9px' }, { x: '34%', y: '10%', s: '11px' }, { x: '66%', y: '86%', s: '14px' },
];

/** Home briefing headline; [key] tokens become image pills (see PILLS). */
export const BRIEF = 'For a few days, [moon] NIT Rourkela turns into a launch pad for [astro] builders, thinkers and makers from across the [planet] country.';
export const PILLS: Record<string, [string, string]> = { moon: ['moon.webp', '50% 50%'], astro: ['indian-astronaut.webp', '50% 20%'], planet: ['planet-yellow.webp', '50% 50%'] };

export const STATUS = ['ALIGNING THE ORBITS', 'CHARTING CONSTELLATIONS', 'FUELLING THE THRUSTERS', 'PLOTTING THE ODYSSEY'];
export const SCRAMBLE = 'XYZXYZABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Z-distance between consecutive gallery frames. */
export const GAP = 1100;

export interface GalleryItem { id: string; no: string; title: string; titleU: string; w: string; h: string }

export const GALLERY: GalleryItem[] = ['Hackathon', 'Robo Wars', 'Code Sprint', 'Guest Lectures', 'Maker Labs', 'Startup Talks', 'Gaming Arena', 'Quiz Night', 'Treasure Hunt', 'Project Expo', 'Circuit Lab', 'Closing Night'].map((t, i) => ({
  id: 'gallery-' + (i + 1), no: String(i + 1).padStart(2, '0'), title: t, titleU: t.toUpperCase(),
  w: i % 3 === 1 ? 'min(22vw, 300px)' : 'min(32vw, 440px)', h: i % 3 === 1 ? 'min(29vw, 400px)' : 'min(21vw, 290px)' }));

export const G_MAX = (GALLERY.length - 1) * GAP + 900;

/** Top navigation: [label, key]. Events/Merch/Gallery are routes; the rest scroll the home page. */
export const LINKS: [string, string][] = [['Home', 'home'], ['Events', 'events'], ['Gallery', 'gallery'], ['Sponsors', 'sponsors'], ['Merch', 'merch'], ['Contact', 'footer']];

/** Frames in the home page's gallery tunnel: [caption, x offset, y offset, aspect ratio]. */
export const TUNNEL: [string, string, string, string][] = [['Opening night', '-15vw', '-6vh', '4 / 3'], ['Hackathon floor', '17vw', '7vh', '3 / 4'], ['Robo Wars arena', '-18vw', '9vh', '4 / 3'], ['Guest lecture', '15vw', '-10vh', '1 / 1'], ['Project expo', '-8vw', '-11vh', '3 / 4'], ['Closing ceremony', '6vw', '5vh', '16 / 10']];
export const TUNNEL_C = ['oklch(0.76 0.11 38)', 'oklch(0.77 0.09 295)', 'oklch(0.8 0.08 178)'];

const INK: [string, string] = ['Ink', '#141312'], BONE: [string, string] = ['Bone', '#ECE8DF'];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export interface Product { id: string; name: string; price: number; tag?: string; desc: string; sizes?: string[]; colors?: [string, string][] }

export const PRODUCTS: Product[] = [
  { id: 'tee', name: 'Odyssey Tee', price: 499, tag: 'Bestseller', desc: 'Heavyweight cotton tee with the celestial disc printed across the back.', sizes: SIZES, colors: [INK, BONE, ['Ember', 'oklch(0.56 0.13 32)']] },
  { id: 'hoodie', name: 'Orbit Hoodie', price: 1199, tag: 'Limited', desc: 'Brushed fleece hoodie with an embroidered Innovision wordmark.', sizes: SIZES, colors: [INK, ['Dusk', 'oklch(0.55 0.12 295)']] },
  { id: 'cap', name: 'Mission Cap', price: 349, desc: 'Six-panel cap with a tonal orbit patch. One size, adjustable strap.', colors: [INK, ['Mint', 'oklch(0.56 0.09 178)']] },
  { id: 'mug', name: 'Celestial Mug', price: 299, desc: 'Matte ceramic mug for late-night hackathon fuel.', colors: [INK, BONE] },
  { id: 'stickers', name: 'Sticker Pack', price: 99, desc: 'Eight die-cut stickers: planets, astronauts and mission badges.' },
];

/**
 * Images placed into image slots, keyed by slot id (e.g. 'sponsor-1-1', 'gallery-3', 'merch-tee',
 * 'merch-feature'). Slots without an entry show the placeholder, as in the design.
 * Example: 'sponsor-1': { src: A + 'sponsors/acme.webp', fit: 'contain' }
 */
export const SLOT_IMAGES: Record<string, { src: string; fit?: 'contain' | 'cover' }> = {
  // Image placed in the design's title-sponsor slot (from .image-slots.state.json).
  'sponsor-title': { src: A + 'sponsor-title.webp' },
};

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

