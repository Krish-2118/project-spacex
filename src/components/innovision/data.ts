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
  /** Shows the animated rover driving over the planet on this world's slide. */
  rover?: boolean;
  /** Shows the ground station and satellite linked by radio waves on this world's slide. */
  uplink?: boolean;
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
    planet: A + 'planet-yellow.webp', astro: '', astroSit: false, rover: true,
    gates: ['indian-astronaut.webp', 'astro-red.webp', 'spaceship.webp', 'big-spaceship.webp'],
    coord: 'RA 05h 35m · DEC −05° 23′', deco: A + 'spaceship.webp', decoL: 'clamp(28px,9vw,180px)', decoT: '31%', decoH: 'min(22vh, 210px)', decoR: '-14deg',
    statL: 'Mission 01', statR: 'Tech Arena', tagline: 'Code. Build. Break the atmosphere.',
    intro: 'Strap in for the technical arena of Innovision. Hackathons, robotics and coding battles where ideas get their launch thrust. Bring your crew, your laptop and your wildest builds.',
    specs: [['Category', 'Technical'], ['Format', 'Solo & team'], ['Launch pad', 'NIT Rourkela'], ['Fuel', 'Code & circuits'], ['Status', 'Boarding soon']],
    missions: [['Hackathon', 'A non-stop build sprint. Ship a working prototype before the countdown hits zero.', 'Team · 2–4', '36 hrs'], ['Robo Wars', 'Bring your bot into the arena. Last machine standing takes the crown.', 'Team · up to 5', 'Knockout'], ['Code Sprint', 'Competitive programming under pressure. Fast logic, faster fingers.', 'Solo', '3 hrs'], ['Circuit Lab', 'Design, debug and demo hardware that works on the first try.', 'Team · 2', '4 hrs']] },
  { key: 'touchdown', slug: 'main-events', name: 'Main Events', category: 'Workshops & Talks', accent: 'oklch(0.55 0.12 295)', accentL: 'oklch(0.77 0.09 295)', ink: 'oklch(0.3 0.08 295)', tint: 'oklch(0.94 0.018 295)', tint2: 'oklch(0.85 0.04 295)',
    planet: A + 'planet-blue.webp', astro: '', astroStyle: { transform: 'translateX(-44vh) translateY(12.5vh) rotate(-28deg)', height: '100%', mixBlendMode: 'multiply', filter: 'grayscale(1) contrast(2.2) brightness(1.2)' }, astroSit: false, uplink: true,
    gates: ['astro-yellow.webp', 'home-astronaut.webp', 'spaceship.webp', 'planet-ringed.webp'],
    coord: 'RA 18h 36m · DEC +38° 47′', deco: '', decoL: '62vw', decoT: '12vh', decoH: 'min(30vh, 280px)', decoR: '12deg',
    statL: 'Mission 02', statR: 'Learn & Land', tagline: 'A cosmic calm for curious minds.',
    intro: 'Slow the descent and land on new ideas. Hands-on workshops and talks from people who have been there, built that, and are ready to show you how.',
    specs: [['Category', 'Workshops'], ['Format', 'Hands-on'], ['Crew', 'Experts & alumni'], ['Fuel', 'Curiosity'], ['Status', 'Boarding soon']],
    missions: [['AI & ML Workshop', 'From first model to deployed demo in a single session.', 'Hands-on', 'Full day'], ['Guest Lectures', 'Stories and lessons from engineers, founders and researchers.', 'Open to all', '90 min'], ['Startup Talks', 'How ideas become companies, straight from the people who did it.', 'Open to all', '60 min'], ['Maker Labs', 'Solder, print and prototype with guidance at every step.', 'Limited seats', 'Half day']] },
  { key: 'highpoint', slug: 'dts-and-fun-events', name: 'DTS and Fun Events', category: 'Games & Showcases', accent: 'oklch(0.56 0.09 178)', accentL: 'oklch(0.8 0.08 178)', ink: 'oklch(0.3 0.06 185)', tint: 'oklch(0.94 0.018 178)', tint2: 'oklch(0.85 0.04 180)',
    planet: A + 'planet-green.webp', astro: A + 'astro-yellow.webp', astroSit: true,
    gates: ['astro-green.webp', 'planet-crescent.webp', 'astro-red.webp', 'big-spaceship.webp'],
    coord: 'RA 13h 25m · DEC −11° 09′', deco: A + 'spaceship.webp', decoL: 'clamp(28px,9vw,180px)', decoT: '31%', decoH: 'min(21vh, 200px)', decoR: '24deg',
    statL: 'Mission 03', statR: 'Fun Zone', tagline: 'Ride the wave where the fest peaks.',
    intro: 'The best of both worlds: competition meets celebration. Gaming arenas, quizzes and showcases that keep the energy high until the very last night.',
    specs: [['Category', 'Fun & games'], ['Format', 'Open to all'], ['Vibe', 'Euphoric'], ['Fuel', 'Team spirit'], ['Status', 'Boarding soon']],
    missions: [['Gaming Arena', 'Squad up for LAN battles and console showdowns.', 'Squad', 'All night'], ['Quiz Night', 'Tech, pop culture and everything in between.', 'Team · 2–3', '3 rounds'], ['Treasure Hunt', 'Clues scattered across campus. Only the sharpest crews finish.', 'Team · 3–4', 'Campus-wide'], ['Project Expo', 'Walk the hall of student builds and vote for your favourite.', 'Open to all', 'All fest']] },
];

/**
 * What the loader waits for: its own planets (Loader ORBS) plus everything on the first home screen
 * (HomeView hero: starfield, orbiting asteroid and ringed planet, rocks, storm planet, astronaut).
 */
export const PRELOAD_CRITICAL = ['planet-tide.webp', 'planet-yellow.webp', 'planet-blue.webp', 'stars.webp',
  'asteroid.webp', 'planet-ringed.webp', 'home-rocks.webp', 'planet-storm.webp', 'indian-astronaut.webp'];
/**
 * Art for the other views, warmed a few files at a time once the loader is gone (Innovision#warmDeferred),
 * roughly in the order a visitor meets it: transition curtain, worlds slider, the flagship world, the rest.
 */
export const PRELOAD_DEFERRED = ['cloud-1.webp', 'cloud-2.webp', 'cloud-3.webp', 'cloud-4.webp', 'cloud-5.webp',
  'planet-green.webp', 'spaceship.webp', 'astro-yellow.webp', 'satellite.webp', 'receiver.webp',
  'floor.webp', 'lab.webp', 'lander.webp', 'astro-red.webp', 'big-spaceship.webp', 'planet-blue-half.webp',
  'moon.webp', 'home-astronaut.webp', 'moon-cratered.webp', 'planet-crescent.webp', 'astro-green.webp'];

/** Intrinsic [width, height] of art drawn with one CSS dimension left auto (public/assets). */
const IMG_SIZE: Record<string, [number, number]> = {
  'asteroid.webp': [1000, 1000], 'astro-green.webp': [600, 1379], 'astro-red.webp': [200, 557], 'astro-yellow.webp': [600, 1083],
  'big-spaceship.webp': [1000, 1329], 'floor.webp': [2000, 973], 'home-astronaut.webp': [600, 1418], 'indian-astronaut.webp': [1246, 1263],
  'lab.webp': [1524, 1016], 'lander.webp': [1131, 922], 'moon.webp': [800, 850], 'planet-blue-half.webp': [2000, 1884],
  'planet-crescent.webp': [1000, 1000], 'planet-ringed.webp': [1000, 1000], 'planet-yellow.webp': [1600, 1605],
  'receiver.webp': [700, 606], 'satellite.webp': [900, 436], 'spaceship.webp': [600, 1537], 'sponsor-title.webp': [1026, 1040],
};
/**
 * width/height attributes for an asset image ({} when unknown). The browser derives the aspect ratio from them,
 * so an image sized by one CSS dimension holds its box before it loads; CSS still decides the rendered size.
 */
export const imgSize = (src: string) => { const d = IMG_SIZE[src.replace(A, '')]; return d ? { width: d[0], height: d[1] } : {}; };
/** loading="lazy" for an image in a secondary view, unless it is PRELOAD_CRITICAL art (cached already, shared with the first screen). */
export const lazyUnlessCritical = (src: string) => (PRELOAD_CRITICAL.includes(src.replace(A, '')) ? undefined : 'lazy' as const);

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
export const PILLS: Record<string, [string, string]> = { moon: ['moon-cratered.webp', '50% 50%'], astro: ['indian-astronaut.webp', '50% 20%'], planet: ['planet-crescent.webp', '24% 26%'] };

export const STATUS = ['ALIGNING THE ORBITS', 'CHARTING CONSTELLATIONS', 'FUELLING THE THRUSTERS', 'PLOTTING THE ODYSSEY'];
export const SCRAMBLE = 'XYZXYZABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Z-distance between consecutive gallery frames. */
export const GAP = 1100;

export interface GalleryItem { id: string; no: string; title: string; titleU: string; w: string; h: string }

export const GALLERY: GalleryItem[] = ['Hackathon', 'Robo Wars', 'Code Sprint', 'Guest Lectures', 'Maker Labs', 'Startup Talks', 'Gaming Arena', 'Quiz Night', 'Treasure Hunt', 'Project Expo', 'Circuit Lab', 'Closing Night'].map((t, i) => ({
  id: 'gallery-' + (i + 1), no: String(i + 1).padStart(2, '0'), title: t, titleU: t.toUpperCase(),
  w: i % 3 === 1 ? 'min(22vw, 300px)' : 'min(32vw, 440px)', h: i % 3 === 1 ? 'min(29vw, 400px)' : 'min(21vw, 290px)' }));

export const G_MAX = (GALLERY.length - 1) * GAP + 900;

/** Top navigation: [label, key]. Events/Schedule/Gallery/Merch are routes; the rest scroll the home page. */
export const LINKS: [string, string][] = [['Home', 'home'], ['Events', 'events'], ['Schedule', 'schedule'], ['Gallery', 'gallery'], ['Sponsors', 'sponsors'], ['Merch', 'merch']];

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

/** One sponsor: logo is a path under /public (e.g. A + 'sponsors/acme.svg'); url opens in a new tab. */
export interface Sponsor { name?: string; logo?: string; url?: string }
export type SponsorTier = { key: string; title: string; /** Card size on the rail: main sponsors get the larger cards. */ size: 'lg' | 'md'; items: Sponsor[] };

/** Shown alone in the featured card at the top of the sponsors section. */
export const TITLE_SPONSOR: Sponsor = {};

/**
 * Each tier is a horizontally scrolling rail, so any number of sponsors fits. Replace the empty
 * placeholders ({}) with real entries, e.g. { name: 'Acme', logo: A + 'sponsors/acme.svg', url: 'https://acme.com' }.
 */
export const SPONSOR_TIERS: SponsorTier[] = [
  { key: 'main', title: 'Our sponsors', size: 'lg', items: Array.from({ length: 10 }, () => ({})) },
  { key: 'media', title: 'Media sponsors', size: 'md', items: Array.from({ length: 8 }, () => ({})) },
  { key: 'food', title: 'Food sponsors', size: 'md', items: Array.from({ length: 8 }, () => ({})) },
];

/**
 * Images placed into image slots, keyed by slot id (e.g. 'sponsor-1-1', 'gallery-3', 'merch-tee',
 * 'merch-feature'). Slots without an entry show the placeholder, as in the design.
 * Example: 'sponsor-1': { src: A + 'sponsors/acme.webp', fit: 'contain' }
 */
export const SLOT_IMAGES: Record<string, { src: string; fit?: 'contain' | 'cover' }> = {
  // Art from the design's title-sponsor slot (.image-slots.state.json); it now decorates the title card beside the logo.
  'sponsor-title': { src: A + 'sponsor-title.webp' },
};

/** Schedule day tabs: [theme, planet image]. */
export const SCHED_DAYS: [string, string][] = [['Launch', 'moon-cratered.webp'], ['Orbit', 'planet-ringed.webp'], ['Re-entry', 'planet-storm.webp']];

/** Parts of a fest day on the schedule page: [name, from, until], in minutes after midnight (by start time). */
export const SCHED_BLOCKS: [string, number, number][] = [['Morning', 0, 12 * 60], ['Afternoon', 12 * 60, 17 * 60], ['Evening', 17 * 60, 24 * 60]];

/** One schedule entry: [start 'HH:MM', duration in minutes, title, world index, venue]. */
export type SchedEvent = [string, number, string, number, string];

/** Events per fest day, in start order. The schedule page splits each day into morning, afternoon and evening. */
export const SCHED: SchedEvent[][] = [
  [['09:00', 60, 'Opening Ceremony', 1, 'Main Auditorium'], ['09:30', 90, 'Robotics Bootcamp', 1, 'Mechanical Workshop'], ['10:00', 2160, 'Hackathon Kick-off', 0, 'Lecture Hall Complex'], ['10:00', 120, 'Circuit Debugging', 0, 'Electronics Lab'],
   ['10:30', 180, 'AI & ML Workshop', 1, 'CS Lab 2'], ['10:30', 90, 'Rubik\'s Cube Speedrun', 2, 'SAC Hall'], ['11:00', 120, 'CAD Modelling Contest', 0, 'Design Studio'], ['11:00', 60, 'Talk: Satellites on a Budget', 1, 'Seminar Hall'],
   ['11:30', 150, 'Robo Wars: Qualifiers', 0, 'Sports Complex Arena'], ['11:30', 90, 'Photography Walk', 2, 'Central Lawns'],
   ['12:30', 120, 'Campus Treasure Hunt', 2, 'Central Lawns'], ['13:00', 90, 'Web Dev Workshop', 1, 'CS Lab 1'], ['13:00', 120, 'Water Rocket Contest', 0, 'Football Ground'], ['13:30', 60, 'Meme Making Contest', 2, 'Library Annexe'],
   ['14:00', 75, 'Guest Lecture: Building for Space', 1, 'Main Auditorium'], ['14:30', 90, 'Code Relay', 0, 'CS Lab 1'], ['14:30', 120, 'Chess Blitz', 2, 'Golden Jubilee Hall'], ['15:00', 90, 'Circuit Design Challenge', 0, 'Electronics Lab'],
   ['15:30', 180, 'Gaming Arena: Group Stage', 2, 'SAC Hall'], ['16:30', 90, 'Drone Race Heats', 0, 'Football Ground'],
   ['17:00', 90, 'Open Source Meetup', 1, 'CS Lab 2'], ['17:30', 90, 'Startup Pitch Pad', 1, 'Seminar Hall'], ['17:30', 60, 'Sketch Battle', 2, 'Design Studio'], ['18:00', 90, 'Mock Interviews', 1, 'Library Annexe'],
   ['18:00', 120, 'Night Coding Sprint', 0, 'CS Lab 1'], ['18:30', 60, 'Battle of Bands: Auditions', 2, 'Open Air Theatre'], ['19:00', 90, 'Quiz Night: Round One', 2, 'Lecture Hall Complex'], ['19:30', 60, 'Astrophotography Talk', 1, 'Main Auditorium'],
   ['20:00', 90, 'Sci-Fi Movie Night', 2, 'Golden Jubilee Hall'], ['20:30', 90, 'Starlight Open Mic', 2, 'Open Air Theatre']],
  [['09:00', 60, 'Hackathon Checkpoint', 0, 'Lecture Hall Complex'], ['09:00', 120, 'Origami Orbit', 2, 'Central Lawns'], ['09:30', 150, 'IoT Workshop', 1, 'Electronics Lab'], ['09:30', 90, 'Blind Coding', 0, 'CS Lab 1'],
   ['10:00', 120, 'Hydraulic Arm Challenge', 0, 'Mechanical Workshop'], ['10:30', 150, 'Robo Wars: Knockouts', 0, 'Sports Complex Arena'], ['10:30', 90, 'Debate: Tech on Trial', 1, 'Library Annexe'], ['11:00', 120, 'Paper Presentation', 1, 'Seminar Hall'],
   ['11:00', 90, 'Pictionary Showdown', 2, 'SAC Hall'], ['11:30', 60, 'Talk: Rockets 101', 1, 'Main Auditorium'],
   ['12:00', 90, 'Line Follower Sprint', 0, 'Mechanical Workshop'], ['12:30', 120, 'Reverse Engineering Lab', 0, 'Electronics Lab'], ['13:00', 90, 'Cyber Security Workshop', 1, 'CS Lab 2'], ['13:30', 75, 'Panel: Founders from Campus', 1, 'Main Auditorium'],
   ['13:30', 60, 'Ad Mad Show', 2, 'SAC Hall'], ['14:30', 120, 'Escape Room', 2, 'Library Annexe'], ['14:30', 90, 'Data Science Sprint', 0, 'CS Lab 1'], ['15:00', 60, 'Talk: Women in Aerospace', 1, 'Seminar Hall'],
   ['15:30', 120, 'Bridge Building Challenge', 0, 'Civil Engineering Yard'], ['16:30', 180, 'Gaming Arena: Finals', 2, 'SAC Hall'],
   ['17:00', 60, 'Tug of War', 2, 'Football Ground'], ['17:30', 120, 'UI/UX Design Sprint', 1, 'Design Studio'], ['17:30', 90, 'Competitive Programming', 0, 'CS Lab 1'], ['18:00', 60, 'Research Showcase Talks', 1, 'Seminar Hall'],
   ['18:30', 90, 'Laser Tag', 2, 'Central Lawns'], ['19:00', 90, 'Quiz Night: Finals', 2, 'Lecture Hall Complex'], ['19:00', 120, 'Hardware Night Build', 0, 'Electronics Lab'], ['19:30', 90, 'Dance Off', 2, 'Open Air Theatre'],
   ['20:00', 60, 'Talk: Life on Mars', 1, 'Main Auditorium'], ['21:00', 90, 'Stargazing Session', 2, 'Rooftop Observatory']],
  [['09:00', 120, 'Hackathon Final Demos', 0, 'Lecture Hall Complex'], ['09:00', 60, 'Sunrise Yoga', 2, 'Central Lawns'], ['09:30', 90, 'Typing Race', 2, 'CS Lab 1'], ['10:00', 150, 'Cloud & DevOps Workshop', 1, 'CS Lab 2'],
   ['10:30', 120, 'Robo Wars: Grand Final', 0, 'Sports Complex Arena'], ['10:30', 90, 'Talk: From Idea to Patent', 1, 'Seminar Hall'], ['11:00', 120, 'Solar Car Showcase', 0, 'Mechanical Workshop'], ['11:30', 180, 'Project Expo', 2, 'Golden Jubilee Hall'],
   ['11:30', 60, 'Crossword Rush', 2, 'Library Annexe'], ['11:30', 90, 'PCB Design Contest', 0, 'Electronics Lab'],
   ['12:30', 60, 'Model Rocketry Launch', 0, 'Football Ground'], ['13:00', 90, 'Blockchain Basics', 1, 'CS Lab 2'], ['13:00', 60, 'Mobile Gaming Cup', 2, 'SAC Hall'], ['13:30', 90, 'Debugging Duel', 0, 'CS Lab 1'],
   ['14:00', 75, 'Keynote: The Next Frontier', 1, 'Main Auditorium'], ['14:30', 90, 'Science Magic Show', 2, 'Seminar Hall'], ['15:00', 90, 'Tech Charades', 2, 'SAC Hall'], ['15:00', 120, 'Mars Rover Challenge', 0, 'Civil Engineering Yard'],
   ['15:30', 90, 'Drone Race Final', 0, 'Football Ground'], ['16:30', 120, 'Gaming Arena: Grand Final', 2, 'SAC Hall'],
   ['17:00', 60, 'Hackathon Results', 0, 'Lecture Hall Complex'], ['17:30', 75, 'Alumni Connect', 1, 'Seminar Hall'], ['17:30', 60, 'Cosmic Fashion Walk', 2, 'Golden Jubilee Hall'], ['18:00', 60, 'Talk: Careers in Deep Tech', 1, 'Main Auditorium'],
   ['18:00', 90, 'Antakshari Night', 2, 'Library Annexe'], ['18:30', 60, 'Sponsor Meet and Greet', 1, 'Design Studio'], ['19:00', 60, 'Prize Distribution', 1, 'Main Auditorium'], ['19:30', 60, 'Club Showcase', 2, 'Central Lawns'],
   ['20:00', 30, 'DJ Warm-up', 2, 'Open Air Theatre'], ['20:30', 150, 'Closing Night Pro Show', 2, 'Open Air Theatre']],
];

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

