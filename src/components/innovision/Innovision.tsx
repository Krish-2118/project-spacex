/* eslint-disable @typescript-eslint/ban-ts-comment -- GSAP class component uses @ts-ignore extensively for dynamic internal state */
// @ts-nocheck
"use client";
import { CLICKABLE, preloadClick, warmClick, unlockClick, playClick } from './clickSound';
/* eslint-disable @typescript-eslint/no-explicit-any -- view-model is dynamically constructed and consumed across many child views */
/* eslint-disable @typescript-eslint/no-unused-vars -- some destructured vars are kept for future use */

import { Component, createRef, memo, type ComponentType, type MouseEvent, type TouchEvent, type WheelEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import {
  A, WORLDS, PRELOAD_CRITICAL, PRELOAD_DEFERRED, HERO_SPARKS, LOADER_SPARKS, STATUS, SCRAMBLE, GAP, GALLERY, ARCHIVE, ikWidth, gFrame,
  LINKS, NAVBAR_HIDDEN, TUNNEL, TUNNEL_C, BRIEF, SCHED, SCHED_DAYS, SCHED_BLOCKS, PAST_SPONSORS, type WorldKey,
} from './data';
import HomeView from './HomeView';
import WorldsView from './WorldsView';
import Hud from './Hud';
import WorldNav from './WorldNav';
import Curtain from './Curtain';
import AboutPanel from './AboutPanel';
import ProfileOverlay from './ProfileOverlay';
import RegistrationStatusSync from './RegistrationStatusSync';
import PhoneModal from './PhoneModal';
import AmbassadorCodeDialog, { type AmbassadorDialogState } from './AmbassadorCodeDialog';
import EventPopup from './EventPopup';
import AdminDashboard from './AdminDashboard';
import Toast from './Toast';
import WorldHint from './WorldHint';
import DetailNotice from './DetailNotice';
import Loader from './Loader';
import { LiveV } from './SiteFooter';
import type { V } from './types';
import {
  getSupabase,
  isSupabaseConfigured,
  getOrCreateUserProfile,
  updateUserPhone,
  fetchUserRegistration,
  createRegistration,
  checkReferralCode,
  fetchAmbassadorCode,
  signInWithGoogle,
  signOutUser,
  cleanAuthUrl,
  saveSessionToDatabase,
  fetchSessionFromDatabase,
  getCookie,
  purgeLocalStorageTokens,
  type UserProfile,
  type Registration,
  type EventItem,
  type GalleryPhoto,
} from '@/lib/supabase';
import { REGISTRATIONS_OPEN, REGISTRATIONS_SOON_PATH, MERCH_PATH, REGISTRATION_PREVIEW_ENABLED } from '@/config/launch';
import { fetchSeatCount, SEATS_FULL_MESSAGE } from '@/lib/seats';
import { AMBASSADOR_FORM_URL, AMBASSADOR_SECTION } from '@/config/ambassador';
import { REGISTRATION_FEE, UPI_ID, UPI_PAY_LINK, UPI_QR_SRC } from '@/config/payment';
import { SKIP_INTRO_KEY } from '@/components/coming-soon/SkipIntroOnReturn';
import { isValidGoogleDriveUrl, GENDER_OPTIONS as GENDERS, normalizeReferralCode, isReferralCode, formatReferralCode, REFERRAL_CODE_FORMAT_ERROR, isIterSoaCollege, isIterSoaEmail, ITER_SOA_ERROR_MESSAGE } from '@/lib/validation';
import { httpErrorMessage, isTransientFailure } from '@/lib/api-errors';
import { ID_CARD_UPLOAD_TARGET_BYTES } from '@/lib/id-cards';
import { shrinkImage } from '@/lib/compress-image';

/** The registration form's two uploads: error key (and file input name), the route that takes the file, its limits. */
const UPLOADS = {
  pay: { ek: 'payfile', url: '/api/upload', what: 'screenshot', maxMb: 1, typeError: 'Upload the screenshot as an image (JPG, PNG or WebP).' },
  id: { ek: 'idfile', url: '/api/id-card', what: 'ID card photo', maxMb: 2, typeError: 'Upload a photo of your ID card (JPG, PNG or WebP).' },
} as const;

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);
// A phone's address bar sliding in or out resizes the window; re-measuring every trigger then makes scrolling hitch.
ScrollTrigger.config({ ignoreMobileResize: true });

// Views and overlays the first screen never shows: each is its own chunk and mounts the first time it is
// needed (Innovision#mount), hidden, under the curtain, loader or a closed overlay. Once mounted it stays.
// sel: the mounted root. load: the one import() of the chunk, shared by dynamic() below and by prefetching
// (a second import() of the same file would make the bundler emit, and the browser fetch, a second chunk).
const LAZY = {
  detail: { sel: '[data-view="detail"]', load: () => import('./DetailView') },
  gallery: { sel: '[data-view="gallery"]', load: () => import('./GalleryView') },
  schedule: { sel: '[data-view="schedule"]', load: () => import('./ScheduleView') },
  menu: { sel: '[data-menu]', load: () => import('./MenuOverlay') },
  auth: { sel: '[data-auth-root]', load: () => import('./AuthOverlay') },
};
type LazyKey = keyof typeof LAZY;
const DetailView = dynamic(LAZY.detail.load, { ssr: false });
const GalleryView = dynamic(LAZY.gallery.load, { ssr: false });
const ScheduleView = dynamic(LAZY.schedule.load, { ssr: false });
const MenuOverlay = dynamic(LAZY.menu.load, { ssr: false });
const AuthOverlay = dynamic(LAZY.auth.load, { ssr: false });
/** Save-Data or a 2G-class connection: nothing is fetched ahead of need. */
const slowNet = () => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (!!c.saveData || c.effectiveType === 'slow-2g' || c.effectiveType === '2g');
};
/** A left click with no modifier: links with a page of their own (e.g. /events/...) stay in the experience for these. */
const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
const LOAD_FAIL = "Couldn't load that part of the site. Check your connection and try again.";
/**
 * Pages of their own that the experience links to: /merch, and the registrations teaser while that flow is closed
 * (src/config/launch.ts). They open without reloading the site (leaveTo).
 */
const OWN_PAGES = [MERCH_PATH, !REGISTRATIONS_OPEN && REGISTRATIONS_SOON_PATH].filter(Boolean) as string[];
/**
 * Devices that start in low-power mode: few cores or little memory, Save-Data, or reduced motion.
 * iOS Safari reports 2-4 cores whatever the phone (anti-fingerprinting), so there only the frame-rate check judges.
 */
const lowPowerDevice = () => {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const ios = /iP(hone|ad|od)/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
  return (!ios && !!n.hardwareConcurrency && n.hardwareConcurrency <= 4) || (!!n.deviceMemory && n.deviceMemory <= 4)
    || matchMedia('(prefers-reduced-motion: reduce)').matches || !!n.connection?.saveData;
};

type PureProps = { v: V; deps: readonly unknown[] };
/**
 * Wraps a large view so it re-renders only when one of its deps changes. Every handler in v reads
 * live state, so a view keeping an older v stays correct; deps list the state its markup shows.
 */
const pure = (View: ComponentType<{ v: V }>) => memo(function Pure({ v }: PureProps) { return <View v={v} />; },
  (a, b) => a.deps.length === b.deps.length && a.deps.every((d, k) => Object.is(d, b.deps[k])));
const HomeV = pure(HomeView), WorldsV = pure(WorldsView), DetailV = pure(DetailView), GalleryV = pure(GalleryView), ScheduleV = pure(ScheduleView), LoaderV = pure(Loader);

type ViewName = 'loading' | 'home' | 'worlds' | 'detail' | 'gallery' | 'schedule';
type Route = { view: Exclude<ViewName, 'loading'>; index: number; section?: string };
type SlideParts = { hero: HTMLElement | null; rot: HTMLElement | null; astro: HTMLElement[]; link: HTMLElement[]; outline: HTMLElement | null; labels: HTMLElement[] };
type El = HTMLElement & { _tw?: gsap.core.Tween };
type Attracted = HTMLElement & { _a: { x: number; y: number; tx: number; ty: number; s: number; on: boolean } };

interface Props {
  /** Minimum loader duration in seconds. */
  loaderSeconds?: number;
  skipLoader?: boolean;
  /** Google OAuth client ID for "Continue with Google" (defaults to NEXT_PUBLIC_GOOGLE_CLIENT_ID). */
  googleClientId?: string;
  /** Flagship rover stops to take a sample and look around (true) or drives a steady loop (false). */
  roverPauses?: boolean;
  /** Flagship rover driving speed multiplier (min .25). */
  roverSpeed?: number;
  /** The app router (InnovisionApp), for client-side navigation to other pages; without it they load in full. */
  router?: { push(href: string): void; replace(href: string): void; prefetch(href: string): void };
}

interface State {
  /** dIndex: world shown by the detail page; it only follows index when that page is prepared. */
  view: ViewName; index: number; dIndex: number; about: boolean; compact: boolean; narrow: boolean;
  menu: boolean; toastOn: boolean; toastMsg: string; curtainLabel: string; curtainKicker: string;
  gIdx: number;
  /** Schedule: selected day index, starred event ids. */
  schedDay: number; saved: string[];
  /** Lighter rendering (see goLowPower); only ever switches on. */
  lowPower: boolean;
  /** Lazy views and overlays (LAZY) that have been mounted. */
  lazy: Partial<Record<LazyKey, boolean>>;
  /** The active page has scrolled under the HUD, which then sits on a frosted bar. */
  hudSolid: boolean;
  /** Continue with Google: popup in progress, the last problem to show, and the account it returned. */
  gBusy: boolean; gErr: string; gUser: { name: string; email: string } | null;
  /** First-visit guide on the worlds slider is showing; coarse: touch-first device (hint wording). */
  hint: boolean; notice: boolean; coarse: boolean;
  /** Admin and profile modal states */
  adminOpen: boolean;
  profileOpen: boolean;
  phoneModalOpen: boolean;
  /** Mission ticket (index into the detail page's missions) whose poster and rulebook popup is open. */
  eventPop: number | null;
  registration: Registration | null;
  user: UserProfile | null;
  authReady: boolean; auth: boolean; authMode: string; step: number; err: any; busyLbl: string; files: any; drag: string; copied: boolean; schedFilter: string;
  /** The referral code on the pass was just copied (shows COPIED). */
  refCopied: boolean;
  /** GET MY CODE (Campus Ambassador section): what the dialog shows; null while it is closed. */
  ambDialog: AmbassadorDialogState | null;
  dbGallery: GalleryPhoto[];
  dbEvents: EventItem[];
}

const SAVED_KEY = 'iv26-schedule-saved';
/** A share link's referral code (captureReferral) and how long it is kept for the registration form. */
const SHARED_REF_KEY = 'inv_shared_ref';
const SHARED_REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const HINT_KEY = 'iv26-hint-worlds';

const parts = (s: Element): SlideParts => ({
  hero: s.querySelector<HTMLElement>('[data-s-hero]'), rot: s.querySelector<HTMLElement>('[data-s-rot]'),
  // The flagship rover enters and leaves with the astronaut.
  astro: [s.querySelector<HTMLElement>('[data-s-astro]'), s.querySelector<HTMLElement>('[data-rover]')].filter((el): el is HTMLElement => !!el), outline: s.querySelector<HTMLElement>('[data-s-outline]'),
  labels: [...s.querySelectorAll<HTMLElement>('[data-s-label]')],
  // The uplink's waves wait until the planet has swung into place.
  link: [...s.querySelectorAll<HTMLElement>('[data-s-link]')],
});
const partList = (p: SlideParts) => [p.hero, p.rot, ...p.astro, p.outline, ...p.labels, ...p.link];

export class Innovision extends Component<Props, State> {
  rootRef = createRef<HTMLDivElement>();
  state: State = { view: 'loading', index: 0, dIndex: 0, about: false, compact: false, narrow: false, menu: false, toastOn: false, toastMsg: '', curtainLabel: 'INNOVISION', curtainKicker: 'NOW ENTERING',
    auth: false, authMode: 'register', step: 0, err: {} as any, busyLbl: '', user: null, files: {} as any, drag: '', copied: false, refCopied: false, ambDialog: null, gIdx: 0, schedDay: 0, schedFilter: 'all', saved: [], hudSolid: false, gBusy: false, gErr: '', gUser: null, hint: false, notice: false, coarse: false, lowPower: false, lazy: {},
    adminOpen: false, profileOpen: false, phoneModalOpen: false, eventPop: null, registration: null, authReady: false, dbGallery: [], dbEvents: [] };
  busy = false; pending = false; slideDir = 0;
  authBusy = false; authClosing = false;
  /** Settles once the first session check has finished, so an early REGISTER / LOG IN click waits for it. */
  _authReady = (() => { let res = () => {}; const p = new Promise<void>((r) => { res = r; }); return { p, res, done: false }; })();
  /** Bumped on every sign-out, so a profile lookup still in flight can't put a logged-out visitor back. */
  _authEpoch = 0;
  _toast: any; _copy: any; _refCopy: any; reg: any; pass: any; _rEls: any; _rift: any; authO: any; _warpRaf: any; _warpTw: any; _stars: any;
  // flagship rover ticker; _rvReseq is set when roverPauses changes so the drive sequence is rebuilt
  _rvTick: ((time: number, dms: number) => void) | null = null; _rvReseq = false;
  // schedule: day swap in progress
  _dayBusy = false;
  // new-visitor guidance: the worlds guide has been seen/dismissed, and its delayed appearance
  hintSeen = false; _hintT?: ReturnType<typeof setTimeout>; _noticeT?: ReturnType<typeof setTimeout>;
  /** Home section to scroll to once the home view has been prepared. */
  pendingSec: string | null = null;
  /** Referral code from a share link (/?ref=CODE, see captureReferral), pre-filled in the registration form. */
  sharedRef = '';
  /**
   * Whether this load skips the loader: the skipLoader prop, or a visitor coming back from a teaser page
   * (SkipIntroOnReturn). Read once, so a dev strict-mode remount (same instance) doesn't replay the loader.
   */
  _skipIntro?: boolean;
  skipIntro() {
    if (this._skipIntro === undefined) {
      let back = false;
      try { back = sessionStorage.getItem(SKIP_INTRO_KEY) === '1'; sessionStorage.removeItem(SKIP_INTRO_KEY); } catch {}
      this._skipIntro = !!this.props.skipLoader || back;
    }
    return this._skipIntro;
  }

  // lifecycle bookkeeping
  private alive = false;
  private ctx?: gsap.Context;
  private cleanups: (() => void)[] = [];
  private _toast?: ReturnType<typeof setTimeout>;

  // DOM helpers (set in boot)
  $: (s: string) => HTMLElement | null = () => null;
  $$: (s: string) => HTMLElement[] = () => [];
  reduce = false;


  // gallery page engine
  gEls: HTMLElement[] = []; dEls: HTMLElement[] = [];
  gZ = 0; gTarget = 0; gTy = 0; gDrawn = '';
  dust: { x: number; y: number; z: number }[] = [];
  gBar?: HTMLElement | null; gGlow?: HTMLElement | null; gEnd?: HTMLElement | null; gStars?: HTMLElement | null;

  // detail
  dTriggers: (ScrollTrigger | undefined)[] = [];
  dtl?: gsap.core.Timeline;

  // ambient loops: one tween per element, paused while the element is out of sight
  amb = new Map<HTMLElement, gsap.core.Animation>();
  /** Each loop's original start time, so a resumed loop picks up exactly where it would have been. */
  born = new WeakMap<gsap.core.Animation, number>();
  /** Home-page loop elements currently scrolled well away from the viewport. */
  off = new Set<Element>();
  io?: IntersectionObserver;

  // parallax / input
  pEls: HTMLElement[] = [];
  /** Index of the expanded odyssey-map panel on the home page. */
  mapOpen = 0;
  wheelLock = false;
  touch: { x: number; y: number } | null = null;

  set(s: Partial<State>) { return new Promise<void>((r) => this.setState(s as State, r)); }

  private listen(target: EventTarget, ev: string, fn: EventListener, opts?: AddEventListenerOptions) {
    target.addEventListener(ev, fn, opts);
    this.cleanups.push(() => target.removeEventListener(ev, fn, opts));
  }

  componentDidMount() {
    this.alive = true;
    // Stored values may be from an older version or edited by hand: keep only well-formed entries.
    let saved: string[] = [];
    try { const sv = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); if (Array.isArray(sv)) saved = sv.filter((x) => typeof x === 'string'); } catch {}
    try { this.hintSeen = localStorage.getItem(HINT_KEY) === '1'; } catch {}
    this.setState({ saved, compact: innerWidth < 1100, narrow: innerWidth < 720, coarse: matchMedia('(pointer: coarse)').matches });
    if (lowPowerDevice()) this.goLowPower();
    // Resize work forces layout (title fit, map panels), so it runs at most once per frame. Both depend on the width
    // only: a phone's toolbar or keyboard changes just the height, and re-tweening the map panels then cost a second of layout.
    let rz = 0, rw = innerWidth;
    this.listen(window, 'resize', () => {
      if (rz) return;
      rz = requestAnimationFrame(() => {
        rz = 0;
        const c = innerWidth < 1100, n = innerWidth < 720;
        if (c !== this.state.compact || n !== this.state.narrow) this.setState({ compact: c, narrow: n }, () => { if (this.state.view === 'detail') this.setupDetailScroll(true); });
        if (innerWidth === rw) return;
        rw = innerWidth;
        this.fitTitle();
        if (this.ctx) this.openMap(this.mapOpen);
      });
    });
    this.cleanups.push(() => cancelAnimationFrame(rz));
    this.boot();
    this.watchFrames();
    this.initSupabaseAuth();
    this.fetchPublicData();
  }

  componentWillUnmount() {
    this.alive = false;
    // A remount (dev strict mode) reuses this instance: low-power mode and the view tickers are set up again.
    document.documentElement.removeAttribute('data-lowpower'); this.lowPower = false; this.viewTicks = [];
    clearTimeout(this._toast); clearTimeout(this._hintT); clearTimeout(this._noticeT);
    this._dayBusy = false;
    this.cleanups.splice(0).forEach((fn) => fn());
    this.io?.disconnect(); this.io = undefined; this.off.clear(); this.amb.clear();
    this.ctx?.revert();
    this.ctx = undefined;
    ScrollTrigger.getAll().forEach((t) => t.kill());
    gsap.globalTimeline.clear();
  }

  boot() {
    const g = gsap;
    const R = this.rootRef.current!;
    this.$ = (s) => R.querySelector<HTMLElement>(s);
    this.$$ = (s) => [...R.querySelectorAll<HTMLElement>(s)];
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reduce) g.globalTimeline.timeScale(1.6);
    this.ctx = g.context(() => {
      R.removeAttribute('data-booting');
      g.set(this.$$('[data-view]'), { autoAlpha: 0 });
      g.set(this.$$('[data-slide]'), { autoAlpha: 0 });
      g.set(this.$$('[data-c-layer]'), { y: 0, yPercent: 100 / 3 });
      g.set(this.$$('[data-hud]'), { autoAlpha: 0 });
      // Hidden views, slides and the resting curtain pause their animations (see syncLoops).
      this.$$('[data-view], [data-slide], [data-curtain]').forEach((el) => el.setAttribute('data-idle', ''));
      this.sound();
      this.watchHome();
      this.loops();
      this.syncLoops();
      this.parallax();
      this.tapRipple();
      this.attract();
      this.homeScroll();
      this.galleryInit();
      try { this.rover(); } catch (e) { console.warn('rover', e); }
      // Scroll doesn't bubble, but a capturing listener on the root hears every view's scroller.
      let hr = 0;
      this.listen(R, 'scroll', () => { if (!hr) hr = requestAnimationFrame(() => { hr = 0; this.hudSync(); }); }, { capture: true, passive: true });
      this.cleanups.push(() => cancelAnimationFrame(hr));
      this.smoothWheel(this.$('[data-d-scroller]'));
      this.listen(window, 'hashchange', () => this.route());
      this.listen(window, 'keydown', (e) => this.onKey(e as KeyboardEvent));
      // A page restored from the back/forward cache doesn't boot again, so a flag set meanwhile by a teaser page
      // must not carry over to the next real load.
      this.listen(window, 'pageshow', (e) => { if ((e as PageTransitionEvent).persisted) { try { sessionStorage.removeItem(SKIP_INTRO_KEY); } catch {} } });
      // Plain links to a page of its own (MERCH in the navbar, menu and footer; REGISTER while closed) switch pages client-side.
      this.listen(document, 'click', (e) => {
        const ev = e as globalThis.MouseEvent;
        if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
        const u = new URL(a.href);
        if (u.origin !== location.origin || !OWN_PAGES.includes(u.pathname)) return;
        ev.preventDefault();
        this.leaveTo(u.pathname + u.search);
      });
      if (this.skipIntro()) { this.hideLoader(); this.firstPaint(); return; }
      this.loaderIntro();
    }, R);
    this.cleanups.push(() => { R.setAttribute('data-booting', ''); R.querySelectorAll('[data-idle]').forEach((el) => el.removeAttribute('data-idle')); });
    if (!this.skipIntro()) this.runLoader().then(() => { if (this.alive) this.loaderExit(); });

    // Auth Middleware Route Inspector: Check for middleware redirects (?auth=login, ?required=register, ?open=register, or #register)
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      this.captureReferral(search);
      // A link to the Campus Ambassador section: the loader always hands over at the top of the home page.
      if (window.location.hash === '#/' + AMBASSADOR_SECTION) this.afterBoot(() => this.scrollHome(AMBASSADOR_SECTION, true));
      const isAuthRequired = search.get('required') === 'register' || search.get('auth') === 'login';
      const isOpenRegister = search.get('open') === 'register' || window.location.hash === '#register';
      const isOpenLogin = search.get('open') === 'login';

      // Local dev shortcuts: ?preview=pass, #pass, #ticket or #receipt opens the boarding pass & ticket directly; ?preview=register or #dev-register opens the form
      if (REGISTRATION_PREVIEW_ENABLED && (search.get('preview') === 'pass' || window.location.hash === '#pass' || window.location.hash === '#ticket' || window.location.hash === '#receipt')) {
        setTimeout(() => this.devOpenPass(), 600);
      } else if (REGISTRATION_PREVIEW_ENABLED && (search.get('preview') === 'register' || window.location.hash === '#dev-register')) {
        setTimeout(() => this.devOpenRegister(), 600);
      } else if (!REGISTRATIONS_OPEN && (isOpenRegister || search.get('required') === 'register')) {
        this.showRegistrationsSoon(true);
      } else if (isAuthRequired) {
        // Remembered across the Google sign-in round trip, so the student lands on the form once signed in, and a
        // volunteer sent here by the check-in scanner ("Log in again") goes straight back to /admin/scan.
        const required = search.get('required');
        if (required === 'register' || required === 'scan') sessionStorage.setItem('inv_pending_action', required);

        // Clean auth and required query params from URL so they don't loop on refresh
        try {
          const cleanParams = new URLSearchParams(window.location.search);
          cleanParams.delete('auth');
          cleanParams.delete('required');
          const cleanQuery = cleanParams.toString();
          window.history.replaceState(null, '', window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '') + window.location.hash);
        } catch {}

        setTimeout(async () => {
          if (!this._authReady.done) await this._authReady.p;
          if (!this.alive) return;
          if (!this.state.user) {
            this.openAuth('login');
            this.toast(required === 'scan' ? 'Please log in again to continue scanning.' : 'Please log in to register.');
          } else if (required === 'scan') {
            this.leaveTo('/admin/scan', true);
          } else if (this.state.registration || this.pass) {
            this.openAuth('pass');
          } else {
            this.openAuth('register');
          }
        }, 1200);
      } else if (isOpenRegister) {
        // Waits for the session check, so a signed-in student isn't sent to log in first.
        setTimeout(async () => {
          if (!this._authReady.done) await this._authReady.p;
          if (!this.alive) return;
          if (!this.state.user) {
            sessionStorage.setItem('inv_pending_action', 'register');
            this.openAuth('login');
            this.toast('Please log in to register.');
          } else if (this.state.registration || this.pass) {
            this.openAuth('pass');
          } else {
            this.openAuth('register');
          }
        }, 1200);
      } else if (isOpenLogin) {
        // LOG IN / PROFILE from a page of its own (the merch page's top bar): log in, or the profile if signed in.
        setTimeout(async () => {
          if (!this._authReady.done) await this._authReady.p;
          if (!this.alive) return;
          if (this.state.user) this.openProfile(); else this.openAuth('login');
        }, 1200);
      }
    }
  }

  /* ---------- ambient loops ---------- */
  /** Starts the loop for every marked element that has none yet (the detail page re-renders its scene per world). */
  loops() {
    const g = gsap;
    const add = (el: HTMLElement, make: () => gsap.core.Animation) => {
      if (this.amb.has(el)) return;
      const tw = make();
      this.amb.set(el, tw); this.born.set(tw, tw.startTime());
      if (this.io && el.closest('[data-view="home"]')) this.io.observe(el);
    };
    this.$$('[data-orbit]').forEach((el) => add(el, () => {
      const st = +(el.dataset.start || 0) || 0, dir = el.dataset.rev ? -1 : 1;
      return g.fromTo(el, { rotation: st }, { rotation: st + 360 * dir, duration: +(el.dataset.dur || 0) || 60, ease: 'none', repeat: -1 });
    }));
    this.$$('[data-orbit-fast]').forEach((el) => add(el, () => {
      const arc = +(el.dataset.arcOrbit || 85);
      const durTop = +(el.dataset.dur || 35);
      const durBottom = 1.5;
      const tl = g.timeline({ repeat: -1 });
      tl.fromTo(el, { rotation: arc }, { rotation: -arc, duration: durTop, ease: 'none' });
      tl.to(el, { rotation: -(360 - arc), duration: durBottom, ease: 'none' });
      tl.progress((durTop / 2) / (durTop + durBottom));
      return tl;
    }));
    this.$$('[data-spin]').forEach((el) => add(el, () => g.to(el, { rotation: '+=360', duration: +(el.dataset.spin || 0) || 140, ease: 'none', repeat: -1 })));
    this.$$('[data-twinkle]').forEach((el, i) => add(el, () => g.fromTo(el, { scale: .5, opacity: .3 }, { scale: 1, opacity: 1, duration: 1.1 + ((i * 37) % 17) / 10, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: (i * .23) % 2 })));
    this.$$('[data-bob]').forEach((el) => add(el, () => g.to(el, { y: -22, rotation: '+=4', duration: 3.6, ease: 'sine.inOut', repeat: -1, yoyo: true })));
    this.$$('[data-marquee]').forEach((el) => add(el, () => {
      const dur = +(el.dataset.marquee || 0) || 36;
      return el.dataset.rev ? g.fromTo(el, { xPercent: -50 }, { xPercent: 0, duration: dur, ease: 'none', repeat: -1 }) : g.to(el, { xPercent: -50, duration: dur, ease: 'none', repeat: -1 });
    }));
    this.$$('[data-float]').forEach((el) => add(el, () => g.to(el, { y: -18, rotation: 1.2, duration: 6, ease: 'sine.inOut', repeat: -1, yoyo: true })));
  }
  /** Tracks which home-page loop elements are near the viewport; the page is many screens tall. */
  watchHome() {
    const root = this.$('[data-view="home"]');
    if (!root || typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) this.off.delete(e.target); else this.off.add(e.target); });
      this.syncLoops();
    }, { root, rootMargin: '50% 0px' });
  }
  /**
   * Runs each ambient loop only while it can be seen: nothing above it is [data-idle] (hidden view,
   * inactive slide, resting curtain, finished loader) and, on home, it is near the viewport.
   * The same attribute pauses the CSS keyframe loops (globals.css), so off-screen scenes cost nothing.
   */
  syncLoops() {
    const now = gsap.globalTimeline.time();
    this.amb.forEach((tw, el) => {
      if (!el.isConnected) { tw.kill(); this.amb.delete(el); this.off.delete(el); this.io?.unobserve(el); return; }
      // In low-power mode the decorations that sit out ([data-lp-skip]) don't loop either.
      const on = !this.off.has(el) && !el.closest('[data-idle]') && !(this.lowPower && el.closest('[data-lp-skip]'));
      if (tw.paused() !== on) return;
      // Resume in phase, as if the loop had never stopped (they all repeat forever).
      if (on) tw.totalTime(Math.max(0, now - (this.born.get(tw) ?? now)), true);
      tw.paused(!on);
    });
  }
  hideLoader() {
    const l = this.$('[data-loader]');
    gsap.set(l, { display: 'none' });
    l?.setAttribute('data-idle', '');
    this.syncLoops();
    this.warmDeferred();
  }

  waveLoop() {
    const w = this.$('[data-wave]') as El | null;
    if (w && !w._tw) { w._tw = gsap.to(w, { scaleY: .35, transformOrigin: 'center', duration: 1.1, ease: 'sine.inOut', repeat: -1, yoyo: true }); }
  }
  componentDidUpdate(pp: Props, ps: State) {
    if (this.ctx) this.waveLoop();
    if (pp.roverPauses !== this.props.roverPauses) this._rvReseq = true;
    if (ps.dbGallery !== this.state.dbGallery) {
      // Frames were added: redraw them all, even if the camera is at rest.
      this.gEls = this.$$('[data-g-item]'); this.gDrawn = '';
    }
  }


  /* ---------- flagship rover ---------- */
  /**
   * Drives the rover over the flagship planet from one throttled ticker: it follows a sequence of
   * drives and parks (sample with the arm, look around), its rocker-bogie wheels ride a terrain
   * profile fixed to the spinning planet, and the body, antenna whip, dish and dust react to speed.
   * It only runs while its slide is visible (nothing above it is [data-idle]).
   */
  rover() {
    const rig = this.$('[data-rover-rig]');
    if (!rig || this._rvTick) return;
    const svg = rig.querySelector('svg'), q = (s) => [...svg.querySelectorAll(s)], one = (s) => svg.querySelector(s);
    const wheels = q('[data-rv-wheel]'), body = one('[data-rv-body]'), head = one('[data-rv-head]'), eyes = one('[data-rv-eyes]'), whip = one('[data-rv-whip]'), dust = q('[data-rv-dust] circle');
    const dish = one('[data-rv-dish]'), arm = one('[data-rv-arm]'), spark = one('[data-rv-spark]'), beam = one('[data-rv-beam]');
    const wpos = q('[data-rv-wpos]').map((g) => { const [x, y] = g.getAttribute('data-rv-wpos').split(' ').map(Number); return { g, x, y, d: 0 }; });
    const linkB = q('[data-rv-link="b"]'), linkF = q('[data-rv-link="f"]'), pR = q('[data-rv-piv="r"]'), pB = q('[data-rv-piv="b"]'), pM = q('[data-rv-piv="m"]');
    const planet = rig.closest('[data-s-rot]').querySelector('[data-spin]');
    const WHEEL = 33.3, RAD = 800, DEG = 180 / Math.PI;
    const E = { out: (p) => 1 - (1 - p) * (1 - p), in: (p) => p * p, inOut: (p) => .5 - Math.cos(Math.PI * p) / 2, none: (p) => p };
    const seq = () => (this.props.roverPauses ?? true)
      ? [{ to: -32, d: 7, e: 'out' }, { park: 4.8, arm: true }, { to: 34, d: 10, e: 'inOut' }, { park: 4.6, look: -13 }, { to: 86, d: 7, e: 'in' }, { jump: -86 }]
      : [{ to: 86, d: 24, e: 'none' }, { jump: -86 }];
    // surface relief, fixed to the planet: small ripples plus a rock every ~19 degrees
    const terr = (a) => { const r = a / DEG; return 2.2 * Math.sin(r * 57) + 1.3 * Math.sin(r * 131 + 1.3) + 7.5 * Math.pow(Math.max(0, Math.sin(r * 19 + .4)), 14); };
    let steps = seq(), step = 0, t = 0, th = -62, from = th, wheel = 0, dist = 0, v = 0, aS = 0, wA = 0, wV = 0, pA = 0, pV = 0, lastSpin = null, nextBlink = 2.5, acc = 0;
    const H = { svgOrigin: '230.5 28' }, AR = { svgOrigin: '272 112' };
    const blink = () => gsap.fromTo(eyes, { scaleY: 1 }, { scaleY: .12, svgOrigin: '244 16.5', duration: .07, yoyo: true, repeat: 1, ease: 'power1.in' });
    const look = (a) => gsap.timeline()
      .to(head, { ...H, rotation: a, duration: .8, ease: 'power2.inOut' })
      .to(beam, { opacity: .85, duration: .35 }, .45)
      .to(beam, { opacity: .4, duration: .07, repeat: 3, yoyo: true, ease: 'none' }, .85)
      .add(blink, '+=.3')
      .to(head, { ...H, rotation: a * -.45, duration: 1, ease: 'power2.inOut' }, '+=.45')
      .to(head, { ...H, rotation: 0, duration: .7, ease: 'power2.inOut' }, '+=.35')
      .to(beam, { opacity: 0, duration: .4 }, '<');
    const sample = () => gsap.timeline()
      .to(head, { ...H, rotation: 12, duration: .7, ease: 'power2.inOut' }, .2)
      .to(arm, { ...AR, rotation: -38, duration: 1.1, ease: 'back.out(1.6)' }, .3)
      .to(beam, { opacity: .8, duration: .25 }, 1.15)
      .set(spark, { opacity: 1 }, 1.45)
      .to(arm, { ...AR, rotation: -35.5, duration: .05, repeat: 15, yoyo: true, ease: 'none' }, 1.45)
      .set(spark, { opacity: 0 }, 2.3)
      .to(beam, { opacity: 0, duration: .3 }, 2.4)
      .add(blink, 2.6)
      .to(arm, { ...AR, rotation: 0, duration: 1, ease: 'power3.inOut' }, 2.9)
      .to(head, { ...H, rotation: 0, duration: .8, ease: 'power2.inOut' }, 3.1);
    const next = () => {
      if (this._rvReseq) { this._rvReseq = false; steps = seq(); step = steps.findIndex((s) => s.to > th + 1); if (step < 0) step = steps.length - 1; }
      else step = (step + 1) % steps.length;
      t = 0; from = th;
      if (steps[step].look) look(steps[step].look);
      if (steps[step].arm) sample();
    };
    gsap.set(wheels, { clearProps: 'all' });
    const f = (n) => n.toFixed(2);
    const lk = (a, b, c) => { const bo = (a + b) / 2, ro = (bo + c) / 2; return [bo, ro, ro * .4 + c * .6]; };
    const tick = (time, dms) => {
      if (rig.closest('[data-idle]') || document.hidden) { lastSpin = null; return; }
      // ~33 fps is plenty for this small figure and roughly halves its attribute writes
      acc += dms;
      if (acc < 30) return;
      const dt = Math.min(.08, acc / 1000); acc = 0;
      const spin = Number(gsap.getProperty(planet, 'rotation')) || 0, dSpin = lastSpin == null ? 0 : spin - lastSpin;
      lastSpin = spin;
      if (this._rvReseq && steps[step].park == null) next();
      const s = steps[step], prev = th;
      const sp = Math.max(.25, +(this.props.roverSpeed ?? 1) || 1);
      if (s.jump != null) { th = s.jump; next(); }
      else if (s.park != null) { th += dSpin; t += dt; if (t >= s.park) next(); }
      else { t += dt * sp; const p = Math.min(1, t / s.d); th = from + (s.to - from) * E[s.e](p); if (p >= 1) next(); }
      const rel = s.jump != null ? 0 : (th - prev) - dSpin;
      const nv = rel / dt, a = (nv - v) / dt; v = nv;
      aS += (a - aS) * .08;
      wheel += (s.park != null ? 0 : rel) * WHEEL;
      dist += Math.abs(rel);
      const k = Math.min(1, Math.abs(v) / 7);
      rig.style.transform = 'rotate(' + th.toFixed(3) + 'deg)';
      const wt = 'rotate(' + wheel.toFixed(2) + ')';
      for (const w of wheels) w.setAttribute('transform', wt);
      // rocker-bogie: every wheel rides the relief, links and pivots follow
      const srf = th - spin;
      for (const w of wpos) { w.d = -terr(srf + (w.x - 160) / RAD * DEG); w.g.setAttribute('transform', 'translate(' + w.x + ' ' + f(w.y + w.d) + ')'); }
      const [b1, b2, b3, f1, f2, f3] = wpos.map((w) => w.d), [bb, rb, mb] = lk(b1, b2, b3), [bf, rf, mf] = lk(f1, f2, f3);
      const dB = 'M70 ' + f(189 + b1) + 'L116 ' + f(153 + bb) + 'L164 ' + f(183 + b2) + 'M116 ' + f(153 + bb) + 'L188 ' + f(125 + rb) + 'L248 ' + f(143 + mb) + 'L270 ' + f(190 + b3);
      const dF = 'M58 ' + f(196 + f1) + 'L104 ' + f(160 + bf) + 'L152 ' + f(190 + f2) + 'M104 ' + f(160 + bf) + 'L176 ' + f(132 + rf) + 'L236 ' + f(150 + mf) + 'L258 ' + f(197 + f3);
      for (const p of linkB) p.setAttribute('d', dB);
      for (const p of linkF) p.setAttribute('d', dF);
      for (const c of pR) c.setAttribute('cy', f(132 + rf));
      for (const c of pB) c.setAttribute('cy', f(160 + bf));
      for (const c of pM) c.setAttribute('cy', f(150 + mf));
      // body: follows the rockers, pitches with terrain, squats on accel and dips on braking (spring)
      const tilt = Math.atan2(((f3 + b3) - (f1 + b1)) / 2, 200) * DEG;
      const pT = Math.max(-7, Math.min(7, tilt - aS * .35));
      pV += ((pT - pA) * 70 - pV * 9) * dt; pA += pV * dt;
      const bob = (Math.sin(dist * 1.9) * 1.1 + Math.sin(dist * 4.7) * .5) * k;
      body.setAttribute('transform', 'translate(0 ' + f((rf + rb) / 2 + bob) + ') rotate(' + f(pA) + ' 176 132)');
      const target = Math.max(-18, Math.min(18, -aS * 1.6 - pV * .4 + Math.sin(dist * 2.2) * 3 * k));
      wV += ((target - wA) * 90 - wV * 9) * dt; wA += wV * dt;
      whip.setAttribute('transform', 'rotate(' + f(wA) + ' 96 85)');
      if (dish) dish.setAttribute('transform', 'rotate(' + f(Math.sin(time * .7) * 16 + Math.sin(time * 1.9) * 3) + ' 118 66)');
      const now = time * 1.7;
      dust.forEach((c, i) => {
        const p = (now + i / dust.length) % 1;
        c.setAttribute('cx', (32 - p * 40).toFixed(1));
        c.setAttribute('cy', (217 - p * 18 - (i % 2) * 5 + f1).toFixed(1));
        c.setAttribute('r', (2.5 + p * 9).toFixed(1));
        c.setAttribute('opacity', ((1 - p) * k * .9).toFixed(2));
      });
      nextBlink -= dt;
      if (nextBlink <= 0) { nextBlink = 3 + Math.random() * 4; blink(); }
    };
    this._rvTick = tick;
    this.tickFor('worlds', tick);
    this.cleanups.push(() => { this._rvTick = null; });
  }

  /* ---------- low-power mode ---------- */
  lowPower = false;
  /** Ticker callbacks that only matter while one view is shown. */
  viewTicks: { view: ViewName; fn: gsap.TickerCallback; prio: boolean; on: boolean }[] = [];
  /** Adds a view's per-frame callback; in low-power mode it leaves the ticker while that view is hidden. */
  tickFor(view: ViewName, fn: gsap.TickerCallback, prio = false) {
    const t = { view, fn, prio, on: false };
    this.viewTicks.push(t);
    this.syncTicks();
    this.cleanups.push(() => { if (t.on) gsap.ticker.remove(fn); t.on = false; });
  }
  syncTicks() {
    for (const t of this.viewTicks) {
      const want = !this.lowPower || this.state.view === t.view;
      if (want && !t.on) { gsap.ticker.add(t.fn, false, t.prio); t.on = true; }
      else if (!want && t.on) { gsap.ticker.remove(t.fn); t.on = false; }
    }
  }
  /**
   * Switches to the lighter rendering for good: <html data-lowpower> (globals.css drops the drop shadows and
   * half the sparks, dust and curtain clouds), their loops pause, and hidden views' ticker callbacks stop.
   */
  goLowPower() {
    if (this.lowPower || !this.alive) return;
    this.lowPower = true;
    document.documentElement.setAttribute('data-lowpower', '');
    this.setState({ lowPower: true });
    this.syncLoops();
    this.syncTicks();
  }
  /** Measures the first ~3 s of frames (after hydration settles) and downgrades if they average under ~40 fps. */
  watchFrames() {
    if (this.lowPower) return;
    let raf = 0, t0 = 0, n = 0;
    const from = performance.now() + 500;
    // A tab in the background has no frames: coming back restarts the window instead of counting the gap.
    this.listen(document, 'visibilitychange', () => { t0 = 0; });
    const step = (t: number) => {
      if (!this.alive || this.lowPower) return;
      if (document.hidden) t0 = 0;
      else if (t >= from) {
        if (!t0) { t0 = t; n = 0; } else n++;
        if (t - t0 >= 3000) { if ((t - t0) / n > 25) this.goLowPower(); return; }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    this.cleanups.push(() => cancelAnimationFrame(raf));
  }

  /* ---------- sound ---------- */
  /** The only sound is the click (clickSound.ts): every button, link or tab clicked anywhere answers with a tick. */
  sound() {
    preloadClick();
    // Created while the loader counts up, so that a first tap during the landing animation doesn't stall it either.
    this.cleanups.push(this.idle(warmClick));
    ['pointerdown', 'keydown'].forEach((ev) => this.listen(window, ev, unlockClick, { once: true, capture: true }));
    this.listen(document, 'click', (e) => {
      const t = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (t && !t.matches(':disabled, [aria-disabled="true"]')) playClick();
    }, { capture: true });
  }

  /* ---------- loader ---------- */
  loaderIntro() {
    gsap.timeline()
      .from(this.$$('[data-l-ring]'), { scale: .4, autoAlpha: 0, duration: 1.8, ease: 'expo.out', stagger: .14 }, 0)
      .from(this.$('[data-loader-disc]'), { scale: 0, duration: 1.3, ease: 'back.out(1.6)' }, .15)
      .from(this.$$('[data-l-line]'), { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: .08 }, .45)
      .from(this.$$('[data-l-corner]'), { autoAlpha: 0, duration: 1 }, .7);
  }
  setStatus(t: string) {
    const el = this.$('[data-l-status]');
    if (el) gsap.to(el, { duration: .6, scrambleText: { text: t, chars: SCRAMBLE, speed: .5 }, overwrite: true });
  }
  /** Runs fn when the browser is idle (or soon, where requestIdleCallback is missing); returns a canceller. */
  idle(fn: () => void) {
    if (typeof requestIdleCallback === 'function') { const id = requestIdleCallback(fn, { timeout: 4000 }); return () => cancelIdleCallback(id); }
    const id = setTimeout(fn, 200); return () => clearTimeout(id);
  }
  _warmed = false;
  /**
   * Warms the cache for art the first screen doesn't show, three files per idle period, once the loader
   * is gone. Skipped when the visitor asked to save data or is on a 2G-class connection.
   */
  warmDeferred() {
    if (!this.alive || this._warmed) return;
    this._warmed = true;
    if (slowNet()) return;
    // The overlay and view a visitor is most likely to open next are fetched ahead too (their own hover/tap also does).
    // The pages of their own (OWN_PAGES: MERCH, REGISTER while closed) are NOT prefetched: each router.prefetch cost 3
    // uncached RSC requests on every home page view, for a page few visitors open. A click on one still switches
    // client-side (the document click listener in componentDidMount), fetching the route then.
    this.cleanups.push(this.idle(() => { this.prefetch('auth'); this.prefetch('detail'); }));
    // The menu (where the top bar has a MENU button) and the register / log-in overlay are mounted, closed, ahead of
    // time: mounting one on its first tap blocked a phone for ~100 ms just as its reveal began. One per idle period.
    this.cleanups.push(this.idle(() => {
      if (this.state.compact) void this.mount('menu');
      this.cleanups.push(this.idle(() => { void this.mount('auth'); }));
    }));
    const queue = [...PRELOAD_DEFERRED];
    let cancel = () => {}, live = true;
    const batch = () => {
      const files = queue.splice(0, 3);
      let left = files.length;
      files.forEach((f) => { const im = new Image(); im.onload = im.onerror = () => { if (--left === 0 && live && queue.length) cancel = this.idle(batch); }; im.src = A + f; });
    };
    cancel = this.idle(batch);
    this.cleanups.push(() => { live = false; cancel(); });
  }
  /* ---------- lazily mounted views and overlays ---------- */
  /** Fetches a lazy component's chunk without mounting it. */
  prefetch(k: LazyKey) { LAZY[k].load().catch(() => {}); }
  prefetchAuth = () => this.prefetch('auth');
  _attached = new Set<LazyKey>();
  /**
   * Mounts a lazy view or overlay (hidden) and resolves true once its markup is in the DOM and wired up,
   * or false when its chunk can't be fetched (offline): callers then stay where they are.
   */
  async mount(k: LazyKey): Promise<boolean> {
    if (this._attached.has(k)) return true;
    try { await LAZY[k].load(); } catch { return false; }
    if (!this.alive) return false;
    if (!this.state.lazy[k]) this.setState((s) => ({ lazy: { ...s.lazy, [k]: true } }));
    // dynamic() renders its chunk a frame or so after the state change; wait for the markup itself.
    return new Promise((res) => {
      const t0 = performance.now();
      const check = () => {
        if (!this.alive) return res(false);
        if (this.$(LAZY[k].sel)) { this.attach(k); return res(true); }
        if (performance.now() - t0 > 8000) return res(false);
        requestAnimationFrame(check);
      };
      check();
    });
  }
  /** Gives a freshly mounted view what boot() gives the views that exist from the start. */
  attach(k: LazyKey) {
    if (this._attached.has(k)) return;
    this._attached.add(k);
    if (k !== 'detail' && k !== 'gallery' && k !== 'schedule') return;
    const el = this.$(LAZY[k].sel)!;
    // Hidden views pause their loops (see syncLoops); the loops for its [data-spin] etc. start paused.
    el.setAttribute('data-idle', '');
    this.ctx?.add(() => { gsap.set(el, { autoAlpha: 0 }); this.loops(); });
    this.syncLoops();
    if (k === 'detail') this.smoothWheel(this.$('[data-d-scroller]'));
    if (k === 'gallery') this.galleryQuery();
  }
  /** Mounts an overlay closed, then opens it a frame later so its CSS entrance transition plays. */
  async openLazy(k: LazyKey, open: Partial<State>) {
    const fresh = !this._attached.has(k);
    if (!(await this.mount(k))) { this.toast(LOAD_FAIL); return; }
    if (fresh) requestAnimationFrame(() => { if (this.alive) this.setState(open as State); });
    else this.setState(open as State);
  }
  /** Resolves once the images on the first screen of a view are decoded (at most ms), so a view never opens half-drawn. */
  imagesReady(view: string, ms = 3000) {
    const root = this.$('[data-view="' + view + '"]');
    if (!root) return Promise.resolve();
    const H = innerHeight, W = innerWidth;
    const imgs = [...root.querySelectorAll('img')].filter((im) => {
      // Inactive world slides are [data-idle] and stay hidden.
      if (im.complete || im.closest('[data-idle]')) return false;
      const r = im.getBoundingClientRect();
      return r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
    });
    if (!imgs.length) return Promise.resolve();
    return Promise.race([Promise.all(imgs.map((im) => im.decode().catch(() => {}))), new Promise((r) => setTimeout(r, ms))]).then(() => {});
  }
  runLoader() {
    return new Promise<void>((res) => {
      let loaded = 0, shown = 0, last = 0;
      // Only the first home screen's art holds the loader; a deep-linked view waits for its own
      // first-screen images under the loader instead (prepView → imagesReady).
      const N = PRELOAD_CRITICAL.length;
      PRELOAD_CRITICAL.forEach((f) => { const im = new Image(); im.onload = im.onerror = () => { ++loaded; }; im.src = A + f; });
      const minMs = (this.props.loaderSeconds ?? 2.8) * 1000;
      const t0 = performance.now();
      const cap9 = setTimeout(() => { loaded = N; }, 9000);
      const cnt = this.$('[data-l-count]')!, prog = this.$('[data-l-progress]')!;
      // The three planets swing in from their start angles and lock onto one line as loading
      // progresses and the dotted link follows them.
      const R = [24, 36, 50], T = [.34, .67, 1], link = this.$('[data-l-link]');
      // quickSetter writes the same transform as gsap.set without allocating a tween every frame.
      const orbs = this.$$('[data-l-orb]').map((o) => ({ o, rot: gsap.quickSetter(o, 'rotation', 'deg'), i: +(o.dataset.i || 0), a0: +(o.dataset.a0 || 0), lock: o.querySelector('[data-l-lock]'), done: false })).sort((a, b) => a.i - b.i);
      let pts0 = '';
      const align = (p: number) => {
        const pts = ['50,50'];
        orbs.forEach((b) => {
          const q = Math.min(1, p / T[b.i]), a = b.a0 * Math.pow(1 - q, 3), r = a * Math.PI / 180;
          b.rot(a);
          pts.push((50 + R[b.i] * Math.sin(r)).toFixed(2) + ',' + (50 - R[b.i] * Math.cos(r)).toFixed(2));
          if (q >= 1 && !b.done) {
            b.done = true;
            gsap.fromTo(b.lock, { scale: .6, autoAlpha: 1 }, { scale: 2.6, autoAlpha: 0, duration: 1.1, ease: 'expo.out' });
          }
        });
        const s = pts.join(' ');
        if (link && s !== pts0) { link.setAttribute('points', s); pts0 = s; }
      };
      align(0);
      const tick = () => {
        const cap = Math.min((loaded / N) * 100, ((performance.now() - t0) / minMs) * 100);
        shown = Math.min(100, Math.min(cap, shown + (this.reduce ? 4 : 1.6)));
        const c = String(Math.floor(shown)).padStart(3, '0');
        if (cnt.textContent !== c) cnt.textContent = c;
        prog.style.strokeDashoffset = String(307.9 * (1 - shown / 100));
        align(shown / 100);
        const si = Math.min(3, Math.floor(shown / 25));
        if (si !== last) { last = si; this.setStatus(STATUS[si]); }
        if (shown >= 100) { gsap.ticker.remove(tick); res(); }
      };
      gsap.ticker.add(tick);
      this.cleanups.push(() => { gsap.ticker.remove(tick); clearTimeout(cap9); });
    });
  }
  async loaderExit() {
    const g = gsap;
    let to = this.parse();
    this.setStatus('ORBITS ALIGNED');
    g.fromTo(this.$('[data-l-flare]'), { scale: .9, autoAlpha: 1 }, { scale: 2.6, autoAlpha: 0, duration: 1.3, ease: 'expo.out' });
    g.fromTo(this.$('[data-l-link]'), { attr: { 'stroke-width': .45 } }, { attr: { 'stroke-width': 1.4 }, duration: .25, yoyo: true, repeat: 1 });
    await new Promise((r) => setTimeout(r, 380));
    if (!this.alive) return;
    // A deep-linked view whose chunk can't be fetched opens home instead.
    if (to.view !== 'home' && !(await this.prepView(to))) to = this.fallHome();
    if (!this.alive) return;
    if (to.view !== 'home') {
      g.timeline()
        .to(this.$$('[data-l-fade]'), { autoAlpha: 0, duration: .5 }, 0)
        .to(this.$$('[data-l-ring]'), { scale: 2, autoAlpha: 0, duration: 1.2, ease: 'power3.in', stagger: .05 }, 0)
        .to(this.$('[data-loader-disc]'), { scale: 0, duration: .9, ease: 'power3.in' }, .2)
        .to(this.$('[data-loader]'), { autoAlpha: 0, duration: .9 }, .8)
        .add(() => { this.hideLoader(); this.enterView(to); g.to(this.$$('[data-hud]'), { autoAlpha: 1, duration: 1 }); }, 1.1);
      return;
    }
    await this.showView('home');
    if (to.section) this.scrollHome(to.section);
    const disc = this.$('[data-loader-disc]')!, target = this.$('[data-hero-disc]')!;
    g.set([target, this.$('[data-hero-sweep]')], { autoAlpha: 0 });
    const he = this.homeEnter().pause(0);
    const a = disc.getBoundingClientRect(), b = target.getBoundingClientRect();
    g.timeline()
      .to(this.$$('[data-l-fade]'), { autoAlpha: 0, duration: .5, ease: 'power2.in' }, 0)
      .to(this.$$('[data-l-ring]'), { scale: 2.4, autoAlpha: 0, duration: 1.4, ease: 'power3.in', stagger: .06 }, 0)
      .to(disc, { x: (b.left + b.width / 2) - (a.left + a.width / 2), y: (b.top + b.height / 2) - (a.top + a.height / 2), scale: b.width / a.width, duration: 1.6, ease: 'expo.inOut' }, .35)
      .to(this.$('[data-loader-bg]'), { autoAlpha: 0, duration: 1, ease: 'power2.inOut' }, .95)
      .add(() => { he.play(); }, 1.25)
      .add(() => { g.set([target, this.$('[data-hero-sweep]')], { autoAlpha: 1 }); this.hideLoader(); }, 1.96);
  }
  async firstPaint() {
    let to = this.parse();
    if (!(await this.prepView(to))) { to = this.fallHome(); await this.prepView(to); }
    if (!this.alive) return;
    this.enterView(to);
    gsap.to(this.$$('[data-hud]'), { autoAlpha: 1, duration: .6 });
  }
  /** The address of a route, for putting the hash back without a hashchange. */
  hashOf(r: Route) {
    const w = WORLDS[r.index];
    return r.view === 'home' ? '#/' : r.view === 'worlds' ? '#/worlds/' + w.slug : r.view === 'detail' ? '#/world/' + w.slug : '#/' + r.view;
  }
  fallHome(): Route { history.replaceState(null, '', '#/'); this.toast(LOAD_FAIL); return { view: 'home', index: this.state.index }; }
  /** Readies a view behind the curtain or loader; false when a lazy view's chunk couldn't be fetched (nothing changed). */
  async prepView(to: Route) {
    if (to.view in LAZY && !(await this.mount(to.view as LazyKey))) return false;
    if (to.view === 'home') { gsap.set(this.$$('[data-hero-disc],[data-hero-sweep]'), { autoAlpha: 1, scale: 1 }); this.$('[data-view="home"]')!.scrollTop = 0; }
    else if (to.view === 'schedule') this.$('[data-view="schedule"]')!.scrollTop = 0;
    else if (to.view === 'gallery') { this.gZ = -2600; this.gTarget = -2600; }
    else { await this.setSlide(to.index); if (to.view === 'detail') await this.prepDetail(to.index); }
    await this.showView(to.view);
    await this.imagesReady(to.view);
    return true;
  }
  enterView(to: Route): gsap.core.Timeline {
    if (to.view === 'detail' || to.view === 'worlds') this.fetchPublicData();
    if (to.view === 'gallery') this.fetchDbGallery();
    if (to.view === 'home') return this.homeEnter();
    if (to.view === 'gallery') return this.galleryEnter();
    if (to.view === 'schedule') return this.schedEnter();
    if (to.view === 'worlds') this.queueHint();
    return to.view === 'detail' ? this.detailEnter() : this.worldsEnter(to.index);
  }

  /* ---------- gallery page ---------- */
  galleryInit() {
    this.galleryQuery();
    this.tickFor('gallery', () => this.galleryTick());
  }
  /** Reads the gallery's elements; the view mounts on the first visit (attach), after boot. */
  galleryQuery() {
    this.gEls = this.$$('[data-g-item]');
    this.dEls = this.$$('[data-g-dust]');
    this.gZ = 0; this.gTarget = 0; this.gDrawn = '';
    this.dust = this.dEls.map((_, k) => ({ x: (((k * 73) % 100) / 100 - .5) * 1.6, y: (((k * 41) % 100) / 100 - .5) * 1.4, z: (k * 997) % 6000 }));
    this.gBar = this.$('[data-g-bar]'); this.gGlow = this.$('[data-g-glow]'); this.gEnd = this.$('[data-g-end]'); this.gStars = this.$('[data-g-stars]');
  }
  galleryTick() {
    if (this.state.view !== 'gallery' || !this.gEls.length) return;
    const dz = this.gTarget - this.gZ;
    this.gZ = Math.abs(dz) < .05 ? this.gTarget : this.gZ + dz * .07;
    const W = innerWidth, H = innerHeight, narrow = this.state.narrow, short = H < 500 && W > H;
    // Phones (narrow, or short in landscape) swing the spiral far less, so the photo in focus stays on screen at their
    // larger frame size (globals.css); portrait ones also lift it clear of the title and counter at the bottom.
    const tight = narrow || short;
    const RX = tight ? W * .05 : Math.min(W * .3, 520), RY = tight ? H * .04 : Math.min(H * .25, 250), lift = narrow ? -H * .07 : short ? -H * .03 : 0;
    // Once the camera has settled the frame is identical to the last one, so skip the 58 style writes.
    const key = this.gZ + '|' + W + '|' + H;
    if (key === this.gDrawn) return;
    this.gDrawn = key;
    this.gEls.forEach((el, i) => {
      const a = i * 2.4 + .7, x = Math.cos(a) * RX, y = Math.sin(a) * RY + lift, z = -i * GAP + this.gZ;
      const o = z < -6200 ? 0 : z < -4000 ? (z + 6200) / 2200 : z < 300 ? 1 : Math.max(0, 1 - (z - 300) / 500);
      el.style.transform = 'translate(-50%,-50%) translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + (-x / RX * 12).toFixed(2) + 'deg)';
      el.style.opacity = o.toFixed(3);
      const vis = o < .01 ? 'hidden' : 'visible', pe = o > .6 ? 'auto' : 'none';
      if (el.style.visibility !== vis) el.style.visibility = vis;
      if (el.style.pointerEvents !== pe) el.style.pointerEvents = pe;
    });
    const lp = this.lowPower;
    this.dEls.forEach((el, k) => {
      if (lp && k % 2) return; // hidden in low-power mode ([data-lp-skip])
      const d = this.dust[k], z = ((d.z + this.gZ * 1.2) % 6000 + 6000) % 6000 - 5200;
      el.style.transform = 'translate3d(' + (d.x * W).toFixed(1) + 'px,' + (d.y * H).toFixed(1) + 'px,' + z.toFixed(1) + 'px)';
      el.style.opacity = z > 500 ? '0' : Math.min(.9, Math.max(0, (z + 5200) / 2000)).toFixed(3);
    });
    const gLen = this.gEls.length || (GALLERY.length + this.state.dbGallery.length);
    const maxZ = Math.max(1200, (gLen - 1) * GAP + 900);
    const p = Math.max(0, Math.min(1, this.gZ / maxZ));
    this.gBar!.style.transform = 'scaleY(' + p.toFixed(4) + ')';
    this.gGlow!.style.transform = 'scale(' + (1 + Math.pow(p, 3) * 14).toFixed(3) + ')';
    this.gGlow!.style.opacity = p.toFixed(3);
    this.gStars!.style.transform = 'scale(' + (1 + p * .25).toFixed(4) + ')';
    // The end card shows once the camera has passed the last photo, so it never lands on top of it.
    const end = this.gZ > (gLen - 1) * GAP + 450;
    this.gEnd!.style.opacity = end ? '1' : '0';
    this.gEnd!.style.pointerEvents = end ? 'auto' : 'none';
    const idx = Math.max(0, Math.min(gLen - 1, Math.round((this.gZ - 200) / GAP)));
    if (idx !== this.state.gIdx) this.setState({ gIdx: idx });
  }
  galleryEnter() {
    this.gEls = this.$$('[data-g-item]');
    return gsap.timeline()
      .call(() => { this.gZ = -2600; this.gTarget = 0; }, undefined, .01)
      .fromTo(this.$$('[data-g-ui]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .1 }, .4)
      .to(this.$$('[data-hud]'), { autoAlpha: 1, duration: .8 }, .2);
  }
  getGMax() {
    const gLen = this.gEls?.length || (GALLERY.length + this.state.dbGallery.length);
    return Math.max(1200, (gLen - 1) * GAP + 900);
  }
  gStep(d: number) {
    const gLen = this.gEls?.length || (GALLERY.length + this.state.dbGallery.length);
    // One step past the last photo flies by it to the end card.
    const i = Math.max(0, Math.min(gLen, Math.round((this.gTarget - 200) / GAP) + d));
    this.gTarget = Math.min(this.getGMax(), i * GAP + 200);
  }
  gWheel = (e: WheelEvent) => {
    this.gTarget = Math.max(0, Math.min(this.getGMax(), this.gTarget + (e.deltaY + e.deltaX) * 1.6));
  };
  gTouchStart = (e: TouchEvent) => { this.gTy = e.touches[0].clientY; };
  gTouchMove = (e: TouchEvent) => {
    const y = e.touches[0].clientY;
    this.gTarget = Math.max(0, Math.min(this.getGMax(), this.gTarget + (this.gTy - y) * 4));
    this.gTy = y;
  };

  /* ---------- toast ---------- */
  toast(msg: string) {
    this.setState({ toastOn: true, toastMsg: msg });
    clearTimeout(this._toast);
    this._toast = setTimeout(() => this.setState({ toastOn: false }), 3200);
  }

  /* ---------- home ---------- */
  homeEnter() {
    const g = gsap, $ = this.$, $$ = this.$$;
    return g.timeline()
      .fromTo($$('[data-h-ring]'), { scale: .84, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 2.2, ease: 'expo.out', stagger: .12 }, 0)
      .fromTo($('[data-h-planet]'), { yPercent: 45, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 2.2, ease: 'expo.out' }, .15)
      .fromTo($$('[data-h-kicker]'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out' }, .2)
      .fromTo($$('[data-h-ch]'), { yPercent: 105, autoAlpha: 0, rotation: 7 }, { yPercent: 0, autoAlpha: 1, rotation: 0, duration: 1.5, ease: 'expo.out', stagger: .055 }, .25)
      .fromTo($('[data-h-astro]'), { x: 200, y: 90, rotation: 28, autoAlpha: 0 }, { x: 0, y: 0, rotation: 0, autoAlpha: 1, duration: 2.6, ease: 'expo.out' }, .35)
      .fromTo($$('[data-h-sub]'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out' }, .75)
      .fromTo($$('[data-h-cta]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .08 }, .9)
      .fromTo($$('[data-h-spark]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, stagger: .05 }, .6)
      .to($$('[data-hud]'), { autoAlpha: 1, duration: 1 }, .8);
  }
  homeLeave() {
    const g = gsap, $ = this.$, $$ = this.$$;
    return g.timeline()
      .to($$('[data-h-ch]'), { yPercent: -60, autoAlpha: 0, duration: .8, ease: 'power3.in', stagger: .03 }, 0)
      .to([...$$('[data-h-kicker]'), ...$$('[data-h-sub]'), ...$$('[data-h-cta]')], { autoAlpha: 0, y: -20, duration: .5, ease: 'power2.in' }, 0)
      .to($$('[data-hero-disc],[data-hero-sweep]'), { scale: 1.3, duration: 1.8, ease: 'power3.in' }, 0)
      .to($('[data-h-astro]'), { x: 220, y: -220, rotation: 30, autoAlpha: 0, duration: 1.6, ease: 'power3.in' }, 0)
      .to($('[data-h-planet]'), { yPercent: 40, duration: 1.6, ease: 'power3.in' }, 0)
      .to($$('[data-h-ring]'), { scale: 1.3, autoAlpha: 0, duration: 1.6, ease: 'power3.in', stagger: .05 }, 0);
  }
  homeScroll() {
    const sc = this.$('[data-view="home"]');
    // Ends the moment the briefing fully covers the pinned hero.
    gsap.timeline({ scrollTrigger: { trigger: this.$('[data-hero-wrap]'), scroller: sc, start: 'top top', end: 'bottom bottom', scrub: true } })
      .fromTo(this.$('[data-h-par]'), { scale: 1, yPercent: 0 }, { scale: .93, yPercent: 6, ease: 'none' }, 0)
      .fromTo(this.$('[data-h-dim]'), { opacity: 0 }, { opacity: .3, ease: 'none' }, 0);
    const tun = this.$('[data-tunnel]');
    if (tun) {
      const fr = this.$$('[data-t-frame]'), N = fr.length, TGAP = 1000, cnt = this.$('[data-t-count]');
      const head = this.$$('[data-t-head]'), cta = this.$('[data-t-cta]');
      fr.forEach((f, i) => { f.style.zIndex = String(N - i); });
      // The heading (and the phone scrim behind it) fades out over the first steps into the tunnel; "View full gallery"
      // fades in once the last photo is on its way. Both follow the scroll, so scrolling back up reverses them.
      const fade = (el: HTMLElement, o: number, dy: number) => {
        const os = String(+o.toFixed(3)), vis = o > 0 ? 'visible' : 'hidden';
        if (el.style.opacity !== os) { el.style.opacity = os; el.style.transform = 'translateY(' + ((1 - o) * dy).toFixed(1) + 'px)'; }
        if (el.style.visibility !== vis) el.style.visibility = vis;
      };
      // Only write what changed: replacing the counter's text every scroll update invalidates layout.
      const upd = (p: number) => {
        const ho = Math.max(0, 1 - p / .05);
        head.forEach((el) => fade(el, ho, -24));
        if (cta) {
          const co = Math.min(1, Math.max(0, (p - .86) / .08));
          fade(cta, co, 18);
          cta.style.pointerEvents = co > .6 ? 'auto' : 'none';
        }
        const travel = p * (N * TGAP - 200);
        // Phones fade a photo out sooner as it passes the camera, before it grows past the room between the heading and the counter.
        const near = innerWidth < 720 || (innerHeight < 500 && innerWidth > innerHeight) ? 120 : 250;
        fr.forEach((f, i) => {
          const z = -(i + 1) * TGAP + travel + 300;
          const o = String(z > near ? Math.max(0, 1 - (z - near) / 450) : z < -TGAP * 3 ? Math.max(0, 1 - (-TGAP * 3 - z) / TGAP) : 1), pe = +o > .6 ? 'auto' : 'none';
          f.style.transform = 'translate(-50%,-50%) translate3d(0,0,' + z + 'px)';
          if (f.style.opacity !== o) f.style.opacity = o;
          if (f.style.pointerEvents !== pe) f.style.pointerEvents = pe;
        });
        const c = String(Math.min(N, Math.floor(p * N) + 1)).padStart(2, '0');
        if (cnt && cnt.textContent !== c) cnt.textContent = c;
      };
      upd(0);
      ScrollTrigger.create({ trigger: tun, scroller: sc, start: 'top top', end: 'bottom bottom', onUpdate: (st) => upd(st.progress) });
    }
    this.$$('[data-view="home"] [data-reveal]').forEach((el) => gsap.fromTo(el, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, scroller: sc, start: 'top 88%' } }));
    // Briefing headline fills in word by word as it scrolls through.
    const fw = this.$$('[data-fill]');
    if (fw.length) gsap.fromTo(fw, { opacity: .14 }, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: fw[0].parentElement, scroller: sc, start: 'top 82%', end: 'bottom 48%', scrub: true } });
    // The closing section pins (sticky) once its bottom reaches the bottom of the screen, while the footer slides
    // over it. Its height and the screen's change with fonts, resizes and the phone address bar, so keep `top` in step.
    const ls = this.$('[data-launch-sec]');
    if (ls && sc) {
      const pin = () => { ls.style.top = (sc.clientHeight - ls.offsetHeight) + 'px'; };
      const ro = new ResizeObserver(pin);
      ro.observe(ls); ro.observe(sc);
      this.cleanups.push(() => ro.disconnect());
    }
    this.openMap(0);
  }
  /** Expands odyssey-map panel i; when the panels wrap onto several rows they all stay open. */
  openMap(i: number) {
    const ps = this.$$('[data-map-panel]');
    if (!ps.length) return;
    this.mapOpen = i;
    const wrapped = ps.some((p) => p.offsetTop !== ps[0].offsetTop);
    ps.forEach((p, k) => {
      const on = wrapped || k === i;
      gsap.to(p, { flexGrow: wrapped ? 1 : (k === i ? 2.3 : 1), duration: 1, ease: 'expo.out', overwrite: 'auto' });
      gsap.to(p.querySelector('[data-map-more]'), { autoAlpha: on ? 1 : 0, y: on ? 0 : 16, duration: .7, ease: 'expo.out', delay: on && !wrapped ? .15 : 0, overwrite: 'auto' });
      gsap.to(p.querySelector('[data-card-planet]'), { scale: k === i || wrapped ? 1.06 : .9, duration: 1.1, ease: 'expo.out', overwrite: 'auto' });
    });
  }

  /* ---------- views ---------- */
  async showView(name: ViewName) {
    this.$$('[data-view]').forEach((el) => { const on = el.dataset.view === name; gsap.set(el, { autoAlpha: on ? 1 : 0 }); el.toggleAttribute('data-idle', !on); });
    await this.set({ view: name });
    this.refreshParallax();
    // The detail scene is rendered per world: start its loops and drop the previous world's.
    this.ctx?.add(() => this.loops());
    this.syncLoops();
    this.syncTicks();
    this.hudSync();
  }
  /** Puts the HUD on its frosted bar once the active view's page has scrolled under it. */
  hudSync() {
    const v = this.state.view;
    const sc = v === 'detail' ? this.$('[data-d-scroller]') : v === 'home' || v === 'schedule' ? this.$('[data-view="' + v + '"]') : null;
    const solid = !!sc && sc.scrollTop > 24;
    if (solid !== this.state.hudSolid) this.setState({ hudSolid: solid });
    if (solid && v === 'detail') this.hideNotice();
  }
  clr(els: (HTMLElement | null)[]) { gsap.set(els.filter(Boolean), { clearProps: 'transform,opacity,visibility,filter,zIndex' }); }
  async setSlide(i: number) {
    await this.set({ index: i });
    this.$$('[data-slide]').forEach((s, k) => { this.clr(partList(parts(s))); gsap.set(s, { autoAlpha: k === i ? 1 : 0, zIndex: 'auto' }); s.toggleAttribute('data-idle', k !== i); });
    this.refreshParallax();
    this.syncLoops();
  }
  worldsEnter(i: number) {
    const p = parts(this.$$('[data-slide]')[i]);
    this.clr(partList(p));
    return gsap.timeline()
      .fromTo(p.hero, { yPercent: 40 }, { yPercent: 0, duration: 2, ease: 'expo.out' }, 0)
      .fromTo(p.rot, { rotation: -30 }, { rotation: 0, duration: 2.4, ease: 'expo.out' }, 0)
      .fromTo(p.astro, { y: -innerHeight * .4, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.8, ease: 'expo.out' }, .35)
      .fromTo(p.outline, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4 }, .3)
      .fromTo(p.labels, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .1 }, .7)
      .fromTo(p.link, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1.5)
      .add(() => this.coach(i), 1.7);
  }
  slideTo(to: number, dir: number) {
    const g = gsap, sl = this.$$('[data-slide]'), from = this.state.index;
    const a = sl[from], b = sl[to], pa = parts(a), pb = parts(b);
    const W = innerWidth, H = innerHeight;
    this.setState({ index: to });
    this.clr(partList(pb));
    g.set(a, { zIndex: 1 }); g.set(b, { zIndex: 2, autoAlpha: 0 });
    b.removeAttribute('data-idle'); this.syncLoops();
    return new Promise<void>((resolve) => {
      g.timeline({ onComplete: () => { g.set(a, { autoAlpha: 0, zIndex: 'auto' }); g.set(b, { zIndex: 'auto' }); a.setAttribute('data-idle', ''); this.syncLoops(); this.clr(partList(pa)); this.refreshParallax(); resolve(); } })
        .to(pa.hero, { x: -W * .7 * dir, yPercent: 12, duration: 1.3, ease: 'power3.inOut' }, 0)
        .to(pa.rot, { rotation: -70 * dir, duration: 1.3, ease: 'power3.inOut' }, 0)
        .to(pa.astro, { x: -W * .15 * dir, y: -H * .35, rotation: -25 * dir, autoAlpha: 0, duration: 1, ease: 'power3.in' }, 0)
        .to([pa.outline, ...pa.labels, ...pa.link], { autoAlpha: 0, duration: .5 }, 0)
        .to(b, { autoAlpha: 1, duration: 1, ease: 'power2.inOut' }, .2)
        .fromTo(pb.hero, { x: W * .7 * dir, yPercent: 12 }, { x: 0, yPercent: 0, duration: 1.5, ease: 'expo.out' }, .55)
        .fromTo(pb.rot, { rotation: 70 * dir }, { rotation: 0, duration: 1.8, ease: 'expo.out' }, .55)
        .fromTo(pb.astro, { y: -H * .4, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.5, ease: 'expo.out' }, .95)
        .fromTo(pb.outline, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, .8)
        .fromTo(pb.labels, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .08 }, 1)
        .fromTo(pb.link, { autoAlpha: 0 }, { autoAlpha: 1, duration: .9 }, 1.7)
        .add(() => this.coach(to), 1.9);
    });
  }

  /* ---------- detail ---------- */
  async prepDetail(i: number) {
    await this.set({ index: i, dIndex: i, eventPop: null });
    this.setupDetailScroll();
  }
  setupDetailScroll(keep?: boolean) {
    const g = gsap, root = this.$('[data-view="detail"]')!, sc = this.$('[data-d-scroller]')!;
    this.dTriggers.forEach((t) => t && t.kill());
    if (this.dtl) { if (this.dtl.scrollTrigger) this.dtl.scrollTrigger.kill(); this.dtl.kill(); }
    if (!keep) sc.scrollTop = 0;
    const q = (s: string) => [...root.querySelectorAll<HTMLElement>(s)];
    g.set(q('[data-speed],[data-d-titleblock],[data-d-word],[data-d-intro],[data-d-spec],[data-d-fade],[data-d-card]'), { clearProps: 'transform,opacity,visibility,filter' });
    const H = () => innerHeight;
    // smoothWheel already eases the scroll itself, so the scene follows it directly: a trailing scrub
    // drifted out of step with the page, most visibly where the sticky scene hands over to the manifest.
    const tl = g.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root.querySelector('[data-d-track]'), scroller: sc, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    // data-speed drifts a layer vertically (fraction of the screen height per half track); data-sx does the same
    // across the width, data-rot turns it (degrees) and data-zoom scales it over the whole track.
    q('[data-speed]').forEach((el) => {
      const n = (k: string) => parseFloat(el.dataset[k] || '') || 0, sp = n('speed'), sx = n('sx'), rot = n('rot'), zoom = n('zoom');
      tl.to(el, { y: () => H() * sp * 2, ...(sx && { x: () => innerWidth * sx * 2 }), ...(rot && { rotation: rot }), ...(zoom && { scale: zoom }), duration: 1 }, 0);
    });
    // Portrait phones and tablets stack the title and the lander in one column, so the lander lifts off once the title has
    // mostly faded instead of climbing through it.
    const liftAt = matchMedia('(orientation: portrait) and (max-width: 1099px)').matches ? .2 : 0;
    q('[data-thrust]').forEach((el) => tl.fromTo(el, { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: 0.15 }, liftAt));
    q('[data-lander]').forEach((el) => tl.to(el, { y: () => -H() * 0.25, duration: 0.35, ease: 'power1.out' }, liftAt));
    tl.to(root.querySelector('[data-d-titleblock]'), { scale: 1.25, autoAlpha: 0, y: () => -H() * .08, duration: .3 }, 0);
    // One tween per word (equivalent to stagger: .03): with GSAP 3.13+, a staggered fromTo inside a
    // scrubbed timeline that is invalidated on refresh reverts not-yet-started targets to visible.
    // Touch screens skip the blur: a filter redrawn on every scroll frame is costly on a phone.
    const blur = !matchMedia('(pointer: coarse)').matches;
    q('[data-d-word]').forEach((el, k) => tl.fromTo(el, { autoAlpha: 0, y: 40, ...(blur && { filter: 'blur(10px)' }) }, { autoAlpha: 1, y: 0, ...(blur && { filter: 'blur(0px)' }), duration: .12 }, .24 + k * .03));
    const intro = root.querySelector('[data-d-intro]'), spec = root.querySelector('[data-d-spec]');
    if (intro) tl.fromTo(intro, { autoAlpha: 0, x: -60 }, { autoAlpha: 1, x: 0, duration: .18 }, .5);
    if (spec) tl.fromTo(spec, { autoAlpha: 0, x: 60 }, { autoAlpha: 1, x: 0, duration: .18 }, .56);
    tl.fromTo(root.querySelector('[data-d-fade]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: .25 }, .75);
    this.dtl = tl;
    this.dTriggers = q('[data-d-card]').map((card) => g.fromTo(card, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: card, scroller: sc, start: 'top 90%' } }).scrollTrigger);
    this.fitTitle();
    ScrollTrigger.refresh();
  }
  /**
   * Eases wheel scrolling in a scroller: each notch glides instead of jumping ~100px, and the
   * scrubbed timelines are updated in the same frame as the scroll. Touch, keys and dragging stay native.
   */
  smoothWheel(sc: HTMLElement | null) {
    if (!sc || this.reduce) return;
    let cur = 0, target = 0, on = false;
    this.listen(sc, 'wheel', (ev) => {
      const e = ev as globalThis.WheelEvent;
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (!on) { cur = target = sc.scrollTop; on = true; }
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? sc.clientHeight : 1);
      target = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, target + d));
    }, { passive: false });
    const tick = () => {
      if (!on) return;
      // Something else moved it (keys, touch, a reset to the top): hand control back.
      if (Math.abs(sc.scrollTop - cur) > 2) { on = false; return; }
      cur += (target - cur) * (1 - Math.pow(.9, gsap.ticker.deltaRatio()));
      if (Math.abs(target - cur) < .5) { cur = target; on = false; }
      sc.scrollTop = cur;
      ScrollTrigger.update();
    };
    // Prioritised: the scroll moves before this frame's tweens render, so nothing lags it by a frame.
    this.tickFor('detail', tick, true);
  }
  detailEnter() {
    const root = this.$('[data-view="detail"]')!;
    this.hideNotice();
    return gsap.timeline()
      .fromTo(root.querySelectorAll('[data-d-ch]'), { yPercent: 70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.4, ease: 'expo.out', stagger: .05 }, .1)
      .fromTo(root.querySelector('[data-d-stats]'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out' }, .5)
      .fromTo(root.querySelectorAll('[data-d-sub]'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'expo.out' }, .7)
      .fromTo(root.querySelectorAll('[data-speed] > img, [data-speed] > div'), { scale: 1.08 }, { scale: 1, duration: 2.4, ease: 'expo.out' }, 0)
      .call(() => this.showNotice(), [], 1.2);
  }
  fitTitle() {
    const el = this.$('[data-d-title]');
    if (!el) return;
    el.style.fontSize = el.dataset.size || 'clamp(56px, 13vw, 250px)';
    const max = innerWidth * .9, w = el.scrollWidth;
    if (w > max) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * (max / w)) + 'px';
  }

  /* ---------- new-visitor guidance ---------- */
  /** Shows the worlds guide once the slide's entrance has played, unless this visitor has already seen it. */
  queueHint() {
    if (this.hintSeen) return;
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => { if (this.alive && this.state.view === 'worlds' && !this.hintSeen) this.setState({ hint: true }); }, 2600);
  }
  /** Briefly shows the "scroll down for missions" notice after a world's entrance; scrolling the page hides it early (hudSync). */
  showNotice() {
    clearTimeout(this._noticeT);
    if (this.state.view !== 'detail') return;
    this.setState({ notice: true });
    this._noticeT = setTimeout(() => { if (this.alive) this.setState({ notice: false }); }, 4500);
  }
  hideNotice() {
    clearTimeout(this._noticeT);
    if (this.state.notice) this.setState({ notice: false });
  }
  /** Touch has no hover, so a tap on a planet answers at once with a ripple from the finger before the curtain falls. */
  tapRipple() {
    const R = this.rootRef.current;
    if (!R) return;
    this.listen(R, 'pointerdown', (ev) => {
      const e = ev as PointerEvent;
      if (e.pointerType === 'mouse' || this.state.view !== 'worlds' || this.busy || this.reduce) return;
      if (!(e.target as Element | null)?.closest?.('[data-s-rot]')) return;
      const d = document.createElement('span');
      d.setAttribute('aria-hidden', 'true');
      d.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;z-index:55;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid #141312;box-shadow:0 0 0 3px rgba(236,232,223,.8),inset 0 0 0 3px rgba(236,232,223,.8);pointer-events:none';
      R.appendChild(d);
      gsap.fromTo(d, { scale: .3, opacity: 1 }, { scale: 2.6, opacity: 0, duration: .7, ease: 'expo.out', onComplete: () => d.remove() });
    }, { passive: true });
  }
  /** Starts the touch tap demo on world k's Enter button, once its entrance has played (CSS ignores it on pointer devices). */
  coach(k: number) { this.$$('[data-slide]')[k]?.querySelector('.cta-wrap')?.setAttribute('data-coach', ''); }
  dismissHint = () => {
    clearTimeout(this._hintT);
    if (!this.hintSeen) { this.hintSeen = true; try { localStorage.setItem(HINT_KEY, '1'); } catch {} }
    if (this.state.hint) this.setState({ hint: false });
  };

  /* ---------- schedule ---------- */
  schedEnter() {
    const v = this.$('[data-view="schedule"]')!;
    return gsap.timeline()
      .fromTo(v.querySelectorAll('[data-sc-reveal]'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .08 }, 0)
      .fromTo(v.querySelectorAll('[data-sc-tab]'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .08 }, .2)
      .fromTo(v.querySelector('[data-sc-planet]'), { scale: .8, rotation: -12, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 2, ease: 'expo.out' }, 0)
      .fromTo(v.querySelectorAll('[data-sc-row]'), { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .05 }, .35);
  }
  /** Fades the day out, applies a day change, then slides the new day in (dir: -1 or 1). */
  schedSwap(patch: Partial<State>, dir: number) {
    if (this._dayBusy) return;
    this._dayBusy = true;
    const v = this.$('[data-view="schedule"]'), list = this.$('[data-sc-list]');
    const out = [this.$('[data-sc-title]'), ...this.$$('[data-sc-row]')].filter(Boolean);
    const go = () => this.setState(patch as State, () => {
      this._dayBusy = false;
      if (v && list && v.scrollTop > list.offsetTop) v.scrollTo({ top: Math.max(0, list.offsetTop - 220), behavior: 'smooth' });
      this.schedIn(dir);
    });
    if (this.reduce) { go(); return; }
    gsap.to(out, { autoAlpha: 0, x: dir ? -36 * dir : 0, y: dir ? 0 : -14, duration: .26, ease: 'power2.in', stagger: .012, overwrite: true, onComplete: go });
  }
  schedIn(dir: number) {
    const title = this.$('[data-sc-title]'), rows = this.$$('[data-sc-row]');
    if (this.reduce) { gsap.set([title, ...rows], { autoAlpha: 1, x: 0, y: 0 }); return; }
    gsap.fromTo(title, { autoAlpha: 0, x: 40 * dir, y: dir ? 0 : 16 }, { autoAlpha: 1, x: 0, y: 0, duration: .8, ease: 'expo.out' });
    gsap.fromTo(rows, { autoAlpha: 0, x: 52 * dir, y: dir ? 0 : 24 }, { autoAlpha: 1, x: 0, y: 0, duration: .85, ease: 'expo.out', stagger: .04, delay: .05 });
  }
  pickDay(k: number) { const d = this.state.schedDay; if (k !== d) this.schedSwap({ schedDay: k }, k > d ? 1 : -1); }
  toggleSave(id: string, e?: MouseEvent<HTMLButtonElement>) {
    const on = this.state.saved.includes(id), saved = on ? this.state.saved.filter((x) => x !== id) : [...this.state.saved, id];
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch {}
    const svg = e?.currentTarget?.querySelector('svg');
    if (svg && !this.reduce) gsap.fromTo(svg, { scale: on ? .8 : .4, rotation: on ? 0 : -72 }, { scale: 1, rotation: 0, duration: .7, ease: 'elastic.out(1,.45)' });
    this.setState({ saved });
  }
  schedVals(s: State) {
    const day = s.schedDay, list = SCHED[day].map((e, i) => ({ e, id: 'd' + (day + 1) + '-' + i }));
    const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); return [(h % 12 || 12) + ':' + String(m).padStart(2, '0'), h < 12 ? 'AM' : 'PM']; };
    const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const dur = (m: number) => m >= 600 ? Math.round(m / 60) + ' HRS' : m >= 120 && m % 60 === 0 ? m / 60 + ' HRS' : m + ' MIN';
    const count = (n: number) => n + (n === 1 ? ' event' : ' events');
    const names = ['FLAGSHIP', 'STANDOUT', 'MAIN', 'FUN'];
    const nar = s.narrow;
    const starred = list.filter((x) => s.saved.includes(x.id)).length;
    return {
      schedTotal: SCHED.reduce((n, d) => n + d.length, 0),
      schedDays: SCHED_DAYS.map(([theme, img], k) => {
        const on = k === day;
        return {
          no: 'DAY ' + String(k + 1).padStart(2, '0'), theme, img: A + img, meta: nar ? count(SCHED[k].length) : count(SCHED[k].length) + ' · from ' + fmt(SCHED[k][0][0]).join(' '),
          sel: on, o: on ? 1 : .55, ps: on ? 1.12 : .86, pr: on ? '-14deg' : '0deg', bar: on ? 1 : 0, barO: k > day ? 'left' : 'right', sep: k ? 'rgba(236,232,223,.18)' : 'transparent', imgD: nar ? 'none' : 'block',
          pick: () => this.pickDay(k),
        };
      }),
      schedHeading: SCHED_DAYS[day][0],
      schedMeta: 'Day ' + (day + 1) + ' · ' + count(list.length),
      schedStarred: starred ? starred + ' starred' : '',
      // Morning, afternoon and evening rows (SCHED_BLOCKS), keyed by day so each row starts scrolled to its first event.
      schedBlocks: SCHED_BLOCKS.map(([name, from, to]) => {
        const items = list.filter(({ e }) => mins(e[0]) >= from && mins(e[0]) < to);
        return {
          key: day + '-' + name.toLowerCase(), name, lower: name.toLowerCase(),
          meta: count(items.length) + (items.length ? ', starting ' + fmt(items[0].e[0]).join(' ') : ''),
          cards: items.map(({ e, id }) => {
            const [t, ap] = fmt(e[0]), on = s.saved.includes(id);
            const wIdx = e[3];
            return {
              id, t, ap, dur: dur(e[1]), title: e[2], wn: names[wIdx], wc: WORLDS[wIdx].accent, wIdx, venue: e[4],
              on, star: on ? 'oklch(0.8 0.12 85)' : 'transparent',
              aria: (on ? 'Remove ' : 'Star ') + e[2],
              toggle: (ev: MouseEvent<HTMLButtonElement>) => this.toggleSave(id, ev)
            };
          }),
        };
      }).filter((b) => b.cards.length),
    };
  }

  /* ---------- curtain ---------- */
  async curtain(kicker: string, label: string, { delay = 0, covered, reveal }: { delay?: number; covered?: () => Promise<void> | void; reveal?: () => void } = {}) {
    await this.set({ curtainKicker: kicker, curtainLabel: label });
    const g = gsap, L = this.$$('[data-c-layer]'), c = this.$('[data-curtain]');
    return new Promise<void>((resolve) => {
      g.set(c, { pointerEvents: 'auto' });
      // The banks stay on their own GPU layers for the whole fall and lift. With GSAP's default force3D 'auto' each
      // tween ends on a 2D transform, so the pause while covered dropped the layers and the lift re-promoted five
      // screen-sized layers at once, right as the next view paints: on phones that stutters and reads as shaking.
      g.set(L, { y: 0, yPercent: 100 / 3, force3D: true, willChange: 'transform' });
      c?.removeAttribute('data-idle'); this.syncLoops();
      const tl = g.timeline({ delay, defaults: { force3D: true }, onComplete: () => { g.set(L, { willChange: 'auto' }); g.set(c, { pointerEvents: 'none' }); c?.setAttribute('data-idle', ''); this.syncLoops(); resolve(); } });
      tl.to(L, { yPercent: -100 / 3, duration: 1.3, ease: 'power3.inOut', stagger: .09 })
        .add(() => {
          tl.pause();
          // Whatever happens while covered, the curtain lifts again.
          Promise.resolve().then(() => covered && covered()).catch((e) => console.warn('curtain', e)).then(() => requestAnimationFrame(() => tl.resume()));
        })
        .add(() => { if (reveal) reveal(); }, '+=0.35')
        .to(L, { yPercent: -100, duration: 1.4, ease: 'power3.inOut', stagger: { each: .09, from: 'end' } }, '<');
    });
  }

  /* ---------- router ---------- */
  parse(): Route {
    if (typeof window !== 'undefined' && (location.hash.includes('access_token') || location.hash.includes('refresh_token'))) {
      cleanAuthUrl();
      return { view: 'home', index: this.state.index };
    }
    const [v, k] = location.hash.replace(/^#\/?/, '').split('/');
    const f = WORLDS.findIndex((w) => w.slug === k || w.key === k), idx = this.state.index;
    if (v === 'worlds') return { view: 'worlds', index: f >= 0 ? f : idx };
    if (v === 'world' && f >= 0) return { view: 'detail', index: f };
    // The merch has a page of its own: old #/merch links and bookmarks go there.
    if (v === 'merch') { this.leaveTo(MERCH_PATH, true); return { view: 'home', index: idx }; }
    if (v === 'gallery' || v === 'schedule') return { view: v, index: idx };
    if (v === 'sponsors') return { view: 'home', section: 'sponsors', index: idx };
    if (v === AMBASSADOR_SECTION) return { view: 'home', section: AMBASSADOR_SECTION, index: idx };
    return { view: 'home', index: idx };
  }
  go(hash: string, replace?: boolean) {
    if (location.hash === hash) return this.route();
    if (replace) location.replace(hash); else location.hash = hash;
  }
  async route() {
    if (this.state.view === 'loading') return;
    if (this.busy) { this.pending = true; return; }
    const to = this.parse(), s = this.state;
    if (s.about || s.menu) this.setState({ about: false, menu: false });
    if (to.view === s.view && to.view === 'home') { if (to.section) this.scrollHome(to.section, true); return; }
    if (to.view === s.view && to.view === 'gallery') { this.gTarget = 0; return; }
    if (to.view === s.view && (to.view === 'schedule' || to.index === s.index)) return;
    this.busy = true;
    try { await this.transition(to); } finally { this.busy = false; this.slideDir = 0; }
    if (this.pending) { this.pending = false; this.route(); }
  }
  async transition(to: Route) {
    const from = this.state.view, w = WORLDS[to.index];
    if (to.view === 'detail') this.dismissHint();
    if (to.view === 'home') {
      if (to.section) this.pendingSec = to.section;
      let he: gsap.core.Timeline | undefined;
      await this.curtain('RETURNING TO', 'INNOVISION', {
        covered: async () => { await this.prepView(to); if (this.pendingSec) { this.scrollHome(this.pendingSec); this.pendingSec = null; } he = this.homeEnter().pause(0); },
        reveal: () => { if (he) he.play(); },
      });
      return;
    }
    if (to.view === 'worlds' && from === 'worlds') {
      await this.slideTo(to.index, this.slideDir || (to.index > this.state.index ? 1 : -1));
      return;
    }
    const label = to.view === 'worlds' ? 'The Worlds' : to.view === 'gallery' ? 'The Gallery' : to.view === 'schedule' ? 'The Schedule' : w.name;
    // A lazy view's chunk downloads while the curtain falls.
    if (to.view in LAZY) this.prefetch(to.view as LazyKey);
    const back: Route = { view: from as Route['view'], index: this.state.index };
    if (from === 'home') this.homeLeave();
    let tlIn: gsap.core.Timeline | undefined;
    await this.curtain('NOW ENTERING', label, {
      delay: from === 'home' ? .55 : 0,
      covered: async () => {
        let at = to;
        // Its chunk couldn't be fetched: the curtain lifts on the view it fell over, and the address goes back.
        if (!(await this.prepView(to))) { at = back; history.replaceState(null, '', this.hashOf(back)); this.toast(LOAD_FAIL); await this.prepView(back); }
        tlIn = this.enterView(at); tlIn.pause(0);
      },
      reveal: () => { if (tlIn) tlIn.play(); },
    });
  }
  scrollHome(name: string | null, smooth?: boolean) {
    const sc = this.$('[data-view="home"]'), el = name && this.$('[data-sec="' + name + '"]');
    if (sc) sc.scrollTo({ top: el ? el.offsetTop : 0, behavior: smooth ? 'smooth' : 'auto' });
  }
  goSection(name: string | null) {
    if (this.state.about || this.state.menu) this.setState({ about: false, menu: false });
    if (this.state.view === 'home') { this.scrollHome(name, true); return; }
    this.pendingSec = name; this.go('#/');
  }

  /* ---------- interaction ---------- */
  stepSlide(d: number) {
    if (this.busy || this.state.view !== 'worlds') return;
    this.dismissHint();
    this.slideDir = d;
    this.go('#/worlds/' + WORLDS[(this.state.index + d + WORLDS.length) % WORLDS.length].slug, true);
  }
  navTo(k: number) {
    const key = WORLDS[k].slug;
    if (this.state.view === 'detail') this.go('#/world/' + key);
    else { if (k !== this.state.index) this.slideDir = k > this.state.index ? 1 : -1; this.go('#/worlds/' + key, this.state.view === 'worlds'); }
  }
  onKey(e: KeyboardEvent) {
    const s = this.state;
    if (s.auth || s.profileOpen || s.phoneModalOpen) return;
    if (e.key === 'Escape' && s.eventPop != null && s.view === 'detail') { this.setState({ eventPop: null }); return; }
    if (e.key === 'Escape' && (s.about || s.menu)) { this.setState({ about: false, menu: false }); return; }
    const v = s.view;
    if (v === 'worlds') {
      if (e.key === 'ArrowRight') { e.preventDefault(); this.stepSlide(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.stepSlide(-1); }
      if (e.key === 'Enter' && e.target === document.body) this.go('#/world/' + WORLDS[s.index].slug);
    } else if (v === 'detail' && e.key === 'Escape') this.go('#/worlds/' + WORLDS[s.index].slug);
    else if (v === 'gallery') {
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); this.gStep(1); }
      if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); this.gStep(-1); }
    }
  }
  parallax() {
    if (matchMedia('(pointer: coarse)').matches || this.reduce) return;
    let raf = 0;
    // One retargetable tween pair per layer instead of a fresh tween per layer on every frame of movement.
    const qt = new WeakMap<HTMLElement, [gsap.QuickToFunc, gsap.QuickToFunc]>();
    const to = (el: HTMLElement) => {
      let q = qt.get(el);
      if (!q) { q = [gsap.quickTo(el, 'x', { duration: 3, ease: 'power2.out' }), gsap.quickTo(el, 'y', { duration: 3, ease: 'power2.out' })]; qt.set(el, q); }
      return q;
    };
    const mm = (ev: Event) => {
      const e = ev as globalThis.MouseEvent;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const mx = e.clientX / innerWidth - .5, my = e.clientY / innerHeight - .5;
        this.pEls.forEach((el) => { const d = parseFloat(el.dataset.depth || '') || 0, [qx, qy] = to(el); qx(mx * -40 * d); qy(my * -60 * d); });
      });
    };
    this.listen(window, 'mousemove', mm, { passive: true });
    this.cleanups.push(() => cancelAnimationFrame(raf));
  }
  /** The hero INNOVISION letters ([data-attract]) drift toward the cursor when it is near; nothing else on the site follows the pointer. */
  attract() {
    if (matchMedia('(pointer: coarse)').matches || this.reduce) return;
    const els = this.$$('[data-view="home"] [data-attract]') as Attracted[];
    els.forEach((el) => { el._a = { x: 0, y: 0, tx: 0, ty: 0, s: parseFloat(el.dataset.attract || '') || .1, on: false }; });
    const m = { x: -1e5, y: -1e5 };
    let seen = false;
    this.listen(window, 'mousemove', (ev) => { const e = ev as globalThis.MouseEvent; m.x = e.clientX; m.y = e.clientY; seen = true; }, { passive: true });
    const tick = () => {
      // Nothing can be pulled before the pointer has been over the page.
      if (this.state.view !== 'home' || !seen) return;
      const H = innerHeight;
      // Measure every element before moving any: reading a rect after a write forced a style
      // recalc per element (~35 a frame); batched, the frame needs a single one.
      const rs = els.map((el) => el.getBoundingClientRect());
      for (let k = 0; k < els.length; k++) {
        const el = els[k], a = el._a, r = rs[k];
        if (!r.width || r.bottom < -100 || r.top > H + 100) { a.tx = a.ty = 0; }
        else {
          const ox = m.x - (r.left + r.width / 2 - a.x), oy = m.y - (r.top + r.height / 2 - a.y);
          const R = Math.max(240, Math.max(r.width, r.height) * .75), d = Math.hypot(ox, oy), f = d < R ? 1 - d / R : 0;
          a.tx = ox * a.s * f * 1.6; a.ty = oy * a.s * f * 1.6;
        }
        a.x += (a.tx - a.x) * .09; a.y += (a.ty - a.y) * .09;
        if (!a.tx && !a.ty && Math.abs(a.x) < .05 && Math.abs(a.y) < .05) { if (a.on) { el.style.translate = ''; a.on = false; } continue; }
        a.on = true; el.style.translate = a.x.toFixed(2) + 'px ' + a.y.toFixed(2) + 'px';
      }
    };
    this.tickFor('home', tick);
    this.cleanups.push(() => { els.forEach((el) => { el.style.translate = ''; }); });
  }
  refreshParallax() {
    const v = this.$('[data-view="' + this.state.view + '"]');
    this.pEls = v ? [...v.querySelectorAll<HTMLElement>('[data-depth]')].filter((el) => { const s = el.closest<HTMLElement>('[data-slide]'); return !s || +(s.dataset.slide || 0) === this.state.index; }) : [];
  }
  hover = (e: MouseEvent<HTMLElement>) => {
    // Touch screens fire mouseenter on every tap: the scramble swaps in letters of other widths, so the tapped label
    // (MENU, REGISTER) changed width for half a second and the top bar around it shook. Hover effects are for mice only.
    if (this.reduce || !this.ctx || this.state.coarse) return;
    const sp = e.currentTarget.querySelector<HTMLElement>('[data-scr]');
    if (!sp) return;
    sp.dataset.text = sp.dataset.text || sp.textContent || '';
    gsap.to(sp, { duration: .5, scrambleText: { text: sp.dataset.text, chars: SCRAMBLE, speed: .6 }, overwrite: true });
  };
  /* ---------- auth: register / login ---------- */
  RN = 22;
  // @ts-ignore
  register = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const t = e && e.currentTarget;
    // A click before the session check finishes waits for it, so a signed-in visitor isn't sent to log in.
    if (!this._authReady.done) await this._authReady.p;
    // Registrations closed (src/config/launch.ts): anyone without a pass goes to the "opening soon" page.
    if (!REGISTRATIONS_OPEN && !(this.state.registration || this.pass)) { this.showRegistrationsSoon(); return; }
    if (!this.state.user) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('inv_pending_action', 'register');
      }
      this.openAuth('login');
      this.toast('Please log in to register.');
      return;
    }
    if (this.state.registration || this.pass) {
      this.openAuth('pass');
      return;
    }
    const disc = t && t.closest && t.closest('[data-hero]') ? this.$('[data-hero-disc]') : null;
    this.openAuth('register', disc || t, !!disc);
  };
  /**
   * GET MY CODE in the Campus Ambassador section: any signed-in student can get a code. Signed out: log in first
   * (remembered across the Google round trip; handleUserSession comes back here). Signed in: the dialog shows their
   * code, or, the first time, asks for their college and creates it (createAmbassadorCode).
   */
  // @ts-ignore
  getAmbassadorCode = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!this._authReady.done) await this._authReady.p;
    if (!this.alive) return;
    if (!this.state.user) {
      try { sessionStorage.setItem('inv_pending_action', 'ambassador'); } catch {}
      this.openAuth('login');
      this.toast('Log in with Google to get your ambassador code.');
      return;
    }
    this.checkAmbassadorCode();
  };
  checkAmbassadorCode = async () => {
    this.setState({ ambDialog: { kind: 'loading' } });
    const res = await fetchAmbassadorCode();
    // Closed while checking: stay closed.
    if (!this.alive || !this.state.ambDialog) return;
    if (!res.ok) {
      if (res.status === 401) {
        // The session ran out: log in again, then come straight back to the code.
        this.setState({ ambDialog: null });
        try { sessionStorage.setItem('inv_pending_action', 'ambassador'); } catch {}
        this.openAuth('login');
        this.toast('Please log in again to get your code.');
        return;
      }
      this.setState({ ambDialog: { kind: 'error', message: res.error } });
      return;
    }
    const a = res.ambassador;
    this.setState({
      ambDialog: !a ? { kind: 'join', email: res.email, name: res.name, college: res.college }
        : a.status === 'revoked' ? { kind: 'revoked', email: res.email }
        : { kind: 'code', code: a.code, name: a.name, email: res.email },
    });
  };
  /** The first GET MY CODE: creates the student's code with the college they confirmed. */
  createAmbassadorCode = async (college: string) => {
    const join = this.state.ambDialog;
    if (!join || join.kind !== 'join' || join.busy) return;
    this.setState({ ambDialog: { ...join, college, busy: true, error: '' } });
    const res = await fetchAmbassadorCode({ college });
    if (!this.alive || this.state.ambDialog?.kind !== 'join') return;
    if (!res.ok) {
      if (res.status === 401) { this.setState({ ambDialog: null }); this.getAmbassadorCode(); return; }
      this.setState({ ambDialog: { ...join, college, busy: false, error: res.error } });
      return;
    }
    const a = res.ambassador;
    this.setState({
      ambDialog: a?.status === 'active' ? { kind: 'code', code: a.code, name: a.name, email: res.email }
        : a?.status === 'revoked' ? { kind: 'revoked', email: res.email }
        : { kind: 'error', message: 'Could not create your ambassador code. Please try again.' },
    });
  };
  /** Runs fn once the loader has handed over to a view and no view transition is running. */
  afterBoot(fn: () => void) {
    const run = () => {
      if (!this.alive) return;
      if (this.state.view === 'loading' || this.busy) { setTimeout(run, 250); return; }
      fn();
    };
    run();
  }
  /**
   * A share link's referral code (/?ref=CAK7QM2X, from an ambassador's GET MY CODE): kept on this device for 30 days,
   * across the Google sign-in round trip, and pre-filled in the registration form, where the student can still change
   * it. Taken off the address bar. A malformed code is ignored.
   */
  captureReferral(search: URLSearchParams) {
    const raw = search.get('ref');
    if (raw !== null) {
      const code = normalizeReferralCode(raw.slice(0, 64));
      if (isReferralCode(code)) {
        try { localStorage.setItem(SHARED_REF_KEY, JSON.stringify({ code, at: Date.now() })); } catch {}
      }
      try {
        const rest = new URLSearchParams(window.location.search);
        rest.delete('ref');
        const q = rest.toString();
        window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
      } catch {}
    }
    try {
      const saved = JSON.parse(localStorage.getItem(SHARED_REF_KEY) || 'null');
      if (saved && typeof saved.code === 'string' && isReferralCode(saved.code) && Date.now() - Number(saved.at) < SHARED_REF_TTL_MS) {
        this.sharedRef = formatReferralCode(saved.code);
      } else if (saved) localStorage.removeItem(SHARED_REF_KEY);
    } catch {}
  }
  /** Forgets the share link's code once it has been used for a registration. */
  clearSharedRef() {
    this.sharedRef = '';
    try { localStorage.removeItem(SHARED_REF_KEY); } catch {}
  }
  /**
   * The code a registrant shares from their pass: an active campus ambassador's permanent CA code (still valid whatever
   * happens to their own registration), otherwise their own referral code (not once the registration was rejected).
   */
  shareCode(): string {
    const r = this.state.registration, P = this.pass || r || {};
    if (r?.ambassador_code) return formatReferralCode(r.ambassador_code);
    return String(P.status || '').toUpperCase() !== 'REJECTED' ? r?.referral_code || '' : '';
  }
  /**
   * A rejected registration with attempts left (attempts_left, from GET /api/register) doesn't keep its owner out of
   * the form: REGISTER AGAIN on the pass opens it. Never while registrations are closed.
   */
  canRegisterAgain(): boolean {
    const r = this.state.registration;
    return REGISTRATIONS_OPEN && r?.status === 'rejected' && (r.attempts_left ?? 0) > 0;
  }
  /**
   * REGISTER AGAIN on a rejected pass (the registration overlay's or the profile's): a fresh form (new screenshot and
   * UTR) with the details pre-filled from the rejected registration. Checks the server first: the pass and this
   * component poll separately, so one may be ahead.
   */
  registerAgain = async () => {
    const user = this.state.user;
    if (!user || this.state.busyLbl) return;
    if (!this.canRegisterAgain()) {
      const fresh = await fetchUserRegistration(user.id, user.email);
      if (!this.alive || this.state.user?.id !== user.id) return;
      this.syncRegistration(fresh);
      if (!this.canRegisterAgain()) {
        this.toast('You can’t register again right now. Please contact the registration helpdesk.');
        return;
      }
    }
    this.dropFiles();
    this.reg = null;
    this.setState({ files: {}, step: 0, err: {} }, () => {
      if (this.state.auth) this.switchMode('register'); else this.openAuth('register');
    });
  };
  /** MY PASS uploaded the college ID card: reload the registration so the pending marks go away everywhere. */
  idCardUploaded = async () => {
    const user = this.state.user;
    if (!user) return;
    const fresh = await fetchUserRegistration(user.id, user.email);
    if (!this.alive || this.state.user?.id !== user.id) return;
    this.syncRegistration(fresh);
  };
  /** Leaves for the "registrations opening soon" page (/register while REGISTRATIONS_OPEN is false). */
  showRegistrationsSoon(replace?: boolean) {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('inv_pending_action');
    this.leaveTo(REGISTRATIONS_SOON_PATH, replace);
  }
  /** Goes to another page of the app: a client-side navigation (no full reload) when the router is at hand. */
  leaveTo(href: string, replace?: boolean) {
    const r = this.props.router;
    if (r) { if (replace) r.replace(href); else r.push(href); return; }
    if (replace) location.replace(href); else location.assign(href);
  }
  // @ts-ignore
  loginClick = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const src = e && e.currentTarget;
    if (!this._authReady.done) await this._authReady.p;
    if (this.state.user) { this.openProfile(); return; }
    if (this.state.about) this.setState({ about: false });
    this.openAuth('login', src);
  };
  /** Opens the profile panel (closing the menu or About on the way) and refreshes the profile behind it. */
  // @ts-ignore
  openProfile = (e?) => {
    if (e && e.preventDefault) e.preventDefault();
    const u = this.state.user;
    if (!u) return;
    if (u.id) this.refreshUserProfile(u.id);
    this.setState({ profileOpen: true, menu: false, about: false });
  };
  /** HUD and menu labels for the signed-in visitor: first name, initials, and an accessible name. */
  accountVals(s: State) {
    const u = s.user;
    const full = u ? ((u.full_name || '').trim() || this.nameFrom(u.email || '')) : '';
    const words = full.split(/\s+/).filter(Boolean);
    return {
      authReady: s.authReady,
      profileName: (words[0] || 'Profile').toUpperCase(),
      profileInitials: (words.slice(0, 2).map((w) => w[0]).join('') || 'IV').toUpperCase(),
      profileAria: 'Open your profile' + (full ? ', ' + full : ''),
      menuLogout: (e: MouseEvent) => { e.preventDefault(); this.setState({ menu: false }); this.logout(); },
    };
  }

  /* ---------- Public Events & Gallery Data Fetching ---------- */
  fetchPublicData = async () => {
    try {
      const eRes = await fetch('/api/events').then((r) => r.json()).catch(() => null);
      if (eRes?.success && Array.isArray(eRes.events) && eRes.events.length > 0) {
        this.setState({ dbEvents: eRes.events });
      }
    } catch (e) {
      console.warn('Error fetching public fest data:', e);
    }
  };

  /**
   * Photos staff upload from the admin dashboard, shown after the static ARCHIVE. Fetched once, and only when the
   * gallery page opens: the home page shows ARCHIVE photos alone, so it never queries the gallery table.
   */
  dbGalleryFetched = false;
  fetchDbGallery = async () => {
    if (this.dbGalleryFetched) return;
    this.dbGalleryFetched = true;
    const gRes = await fetch('/api/gallery').then((r) => r.json()).catch(() => null);
    if (!gRes?.success || !Array.isArray(gRes.gallery)) { this.dbGalleryFetched = false; return; } // retry next visit
    const known = new Set(ARCHIVE.map((p) => p.url));
    const extra = (gRes.gallery as GalleryPhoto[]).filter((p) => p.image_url && !known.has(p.image_url));
    if (extra.length && this.alive) this.setState({ dbGallery: extra });
  };

  /* ---------- Supabase Auth & Google OAuth (Cookie-Backed Sessions) ---------- */
  /** The first session check is over: show LOG IN or the profile, and release clicks waiting on it. */
  markAuthReady = () => {
    if (this._authReady.done) return;
    this._authReady.done = true;
    this._authReady.res();
    if (this.alive) this.setState({ authReady: true });
  };

  initSupabaseAuth = async () => {
    const slow = setTimeout(this.markAuthReady, 4000);
    this.cleanups.push(() => clearTimeout(slow));
    try {
      purgeLocalStorageTokens();
      if (!isSupabaseConfigured()) {
        this.markAuthReady();
        return;
      }
      const supabase = getSupabase();

      // 1. Check the active session. getSession waits for the client to start, which (detectSessionInUrl) already
      //    exchanges the PKCE code when returning from Google, so the code is only exchanged by hand as a fallback.
      let { data: { session } } = await supabase.auth.getSession();
      const code = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('code') : null;
      if (!session && code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.warn('PKCE exchange warning:', error.message);
          session = data?.session ?? null;
        } catch (e) {
          console.warn('exchangeCodeForSession error:', e);
        }
      }
      cleanAuthUrl();
      purgeLocalStorageTokens();

      if (session?.user) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.warn('Cached session is invalid or user was removed. Signing out...');
          this._authEpoch++;
          await signOutUser();
          return;
        }
        await Promise.all([saveSessionToDatabase(session), this.handleUserSession(user)]);
      } else {
        // 3. Fall back to Server/Database session via cookies (ZERO localStorage)
        const dbAuth = await fetchSessionFromDatabase();
        if (dbAuth.user) {
          const cookieAccessToken = getCookie('inn_access_token');
          const cookieRefreshToken = getCookie('inn_refresh_token');
          if (cookieAccessToken) {
            try {
              await supabase.auth.setSession({
                access_token: cookieAccessToken,
                refresh_token: cookieRefreshToken || '',
              });
            } catch (e) {
              console.warn('setSession failed:', e);
            }
          }
          await this.handleUserSession(dbAuth.user);
        }
      }

      // Supabase awaits this callback while holding its auth lock, so it must not await Supabase calls itself
      // (that deadlocks the client, and a later signOut then never finishes). The work runs on the next tick.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        cleanAuthUrl();
        purgeLocalStorageTokens();
        if (event === 'SIGNED_OUT') {
          this._authEpoch++;
          this.reg = null;
          this.pass = null;
          if (this.alive) {
            this.setState({
              user: null,
              registration: null,
              adminOpen: false,
              profileOpen: false,
              phoneModalOpen: false,
            });
          }
          return;
        }
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          const epoch = this._authEpoch;
          const known = this.state.user?.id === session.user.id;
          setTimeout(() => {
            if (!this.alive || epoch !== this._authEpoch) return;
            saveSessionToDatabase(session);
            // A refreshed token or a re-focused tab for the same account needs no profile reload.
            if (!known) this.handleUserSession(session.user);
          }, 0);
        }
      });
      this.cleanups.push(() => subscription.unsubscribe());
    } catch (err) {
      console.warn('initSupabaseAuth error:', err);
    } finally {
      clearTimeout(slow);
      this.markAuthReady();
    }
  };

  handleUserSession = async (authUser: any) => {
    const epoch = this._authEpoch;
    const intent = typeof window !== 'undefined' ? sessionStorage.getItem('inv_login_intent') : null;
    const isNitEmail = authUser.email?.toLowerCase().endsWith('@nitrkl.ac.in');

    if (intent === 'internal' && !isNitEmail) {
      if (typeof window !== 'undefined') sessionStorage.removeItem('inv_login_intent');
      this._authEpoch++;
      await signOutUser();
      this.setState({
        user: null,
        gErr: 'Internal login requires an official @nitrkl.ac.in institute email address. Please select External student login or use your NIT RKL account.',
        auth: true,
        authMode: 'login',
      });
      return;
    }

    const [profile, registration] = await Promise.all([
      getOrCreateUserProfile(authUser),
      fetchUserRegistration(authUser.id, authUser.email),
    ]);
    // Signed out (or signed in as someone else) while these were loading: this result is stale.
    if (!this.alive || epoch !== this._authEpoch) return;
    if (!profile) {
      this.setState({ user: null, registration: null });
      return;
    }

    if (registration) {
      this.pass = {
        name: registration.name,
        college: registration.college,
        id: registration.registration_id,
        email: registration.email,
        status: (registration.status || 'pending').toUpperCase(),
        utr: registration.utr,
      };
    }

    const needsPhone = !profile.phone;

    this.setState({
      user: profile,
      registration,
      phoneModalOpen: needsPhone,
      gErr: '',
      gBusy: false,
    });

    const pendingAction = typeof window !== 'undefined' ? sessionStorage.getItem('inv_pending_action') : null;
    if (pendingAction === 'scan') {
      // Back to the check-in scanner (a fixed path, never one taken from the URL). Removed first, so a signed-in user
      // who isn't staff (bounced from /admin/scan to /) can't loop.
      sessionStorage.removeItem('inv_pending_action');
      this.leaveTo('/admin/scan', true);
      return;
    }
    if (pendingAction === 'ambassador') {
      // GET MY CODE before signing in: back to the Campus Ambassador section (a jump, as for a link to it: a smooth
      // scroll down the whole page would still be under way behind the dialog), with the code check running.
      sessionStorage.removeItem('inv_pending_action');
      const resume = () => this.afterBoot(() => {
        if (this.state.view === 'home') this.scrollHome(AMBASSADOR_SECTION); else this.goSection(AMBASSADOR_SECTION);
        this.checkAmbassadorCode();
      });
      if (this.state.auth) this.closeAuth(resume); else resume();
      return;
    }
    if (pendingAction === 'register') {
      if (typeof window !== 'undefined') sessionStorage.removeItem('inv_pending_action');
      if (registration) {
        this.openAuth('pass');
        this.toast(`Welcome back, ${profile.full_name?.split(' ')[0] || 'Explorer'}! Here is your boarding pass.`);
      } else {
        this.toast(`Signed in as ${profile.email}.`);
        setTimeout(() => this.openAuth('register'), 300);
      }
      return;
    }

    if (this.state.auth) {
      if (registration) {
        this.openAuth('pass');
        this.toast(`Welcome back, ${profile.full_name?.split(' ')[0] || 'Explorer'}! Here is your boarding pass.`);
      } else if (this.state.authMode === 'login') {
        this.setState({ authMode: 'register', step: 0 });
      }
    }
  };

  syncRegistration = (registration: Registration | null) => {
    if (!this.alive || (registration && registration.user_id !== this.state.user?.id)) return;
    if (JSON.stringify(registration) === JSON.stringify(this.state.registration)) return;
    this.pass = registration ? {
      name: registration.name, college: registration.college, id: registration.registration_id,
      email: registration.email, status: registration.status.toUpperCase(), utr: registration.utr,
    } : null;
    this.setState({ registration });
    if (registration?.status === 'confirmed' && this.state.authMode === 'pass') this.authSpin(false);
  };

  refreshUserProfile = async (userId: string) => {
    const epoch = this._authEpoch;
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!this.alive || epoch !== this._authEpoch || this.state.user?.id !== userId) return;
      if (data && !error) {
        this.setState({ user: data as UserProfile });
      }
    } catch (err) {
      console.warn('refreshUserProfile error:', err);
    }
  };

  handleUpdatePhone = async (phone: string) => {
    if (!this.state.user) return;
    const res = await updateUserPhone(phone);
    if (!res.success) throw new Error(res.error || 'Failed to update phone');
    this.setState((st: any) => ({
      user: st.user ? { ...st.user, phone } : null,
      phoneModalOpen: false,
    }));
    this.toast('Phone number updated successfully.');
  };

  googleLogin = async (isInternal: boolean = false) => {
    const s = this.state;
    if (s.gBusy || s.busyLbl) return;
    this.setState({ gBusy: true, gErr: '' });
    try {
      const { error } = await signInWithGoogle({ internalOnly: isInternal });
      if (error) throw error;
    } catch (e: any) {
      this.gFail(e?.message || 'Google sign-in could not be completed. Please try again.');
    } finally {
      if (this.alive) this.setState({ gBusy: false });
    }
  };

  gFail(msg: string) {
    this.setState({ gErr: msg });
    const b = this.$('[data-g-btn]');
    if (b && !this.reduce) gsap.fromTo(b, { x: -10 }, { x: 0, duration: .6, ease: 'elastic.out(1,.3)' });
  }

  logout = async () => {
    // Flip the HUD back to LOG IN straight away; the server and Supabase sign-out finish in the background.
    this._authEpoch++;
    this.reg = null;
    this.pass = null;
    this.dropFiles();
    const f = this.$ && this.$('[data-auth-form]');
    if (f) f.reset();
    this.setState({
      user: null,
      registration: null,
      adminOpen: false,
      profileOpen: false,
      phoneModalOpen: false,
      ambDialog: null,
      authMode: 'register',
      step: 0,
      err: {},
      files: {},
      about: false,
      gUser: null,
      gErr: '',
    });
    this.toast('Logged out. See you in orbit.');
    try {
      await signOutUser();
    } catch (err) {
      console.warn('signOutUser error:', err);
    }
  };
  // @ts-ignore
  emailOk(x) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x); }
  nameFrom(em) { return em.split('@')[0].replace(/\d+/g, '').replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || 'Explorer'; }
  // @ts-ignore
  newId() { return 'IV26-' + (Math.floor(Math.random() * 9000) + 1000); }
  drop(err, k) { const e = { ...err }; delete e[k]; return e; }
  fee() { return REGISTRATION_FEE; }
  // @ts-ignore
  upi() { return UPI_ID; }
  speed() { const n = Number(this.props.riftSpeed ?? 1); return n > 0 ? n : 1; }
  // @ts-ignore
  fmtSize(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  livePage() { return [...this.$$('[data-view]').filter((el) => getComputedStyle(el).visibility !== 'hidden'), this.$('[data-hud]')].filter(Boolean); }
  // @ts-ignore
  pagePush(z) {
    const sc = z ? String(1 + .12 * z) : '', o = this.authO, to = z && o ? o.x.toFixed(0) + 'px ' + o.y.toFixed(0) + 'px' : '';
  // @ts-ignore
    // will-change while pushed: without it every frame of the zoom re-rastered the whole page (the home page is many screens tall).
    (this.page || []).forEach((el) => { el.style.scale = sc; el.style.transformOrigin = to; el.style.willChange = sc ? 'transform' : ''; });
    const veil = this.$ && this.$('[data-rift-veil]'); if (veil) veil.style.opacity = String(z * .85);
  }
  // @ts-ignore
  riftNew(p, v, e, z) {
    const r = { p, v, e, z, j: [], k: [] };
    for (let i = 0; i <= this.RN; i++) { r.j.push(Math.random() * 2 - 1); r.k.push(Math.random() * 2 - 1); }
    this._rEls = { sec: this.$('[data-auth]') };
    return r;
  }
  // @ts-ignore
  originOf(src, disc) {
    const W = innerWidth, H = innerHeight, b = src && src.getBoundingClientRect ? src.getBoundingClientRect() : null;
    const o = b && b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : { x: W / 2, y: H / 2 };
    return { x: Math.min(Math.max(o.x, 0), W), y: Math.min(Math.max(o.y, 0), H), r0: disc && b ? b.width / 2 : 0 };
  }
  // @ts-ignore
  riftDraw() {
    const r = this._rift, E = this._rEls; if (!r || !E || !E.sec) return;
    const W = innerWidth, H = innerHeight, o = this.authO || { x: W / 2, y: H / 2 };
    const r0 = o.r0 || 0, rad = r0 + (Math.hypot(Math.max(o.x, W - o.x), Math.max(o.y, H - o.y)) + 4 - r0) * r.p;
    E.sec.style.clipPath = 'circle(' + rad.toFixed(1) + 'px at ' + o.x.toFixed(1) + 'px ' + o.y.toFixed(1) + 'px)';
    this.pagePush(r.z);
  }
  // @ts-ignore
  warp(dur) {
    const c = this.$ && this.$('[data-warp]'); if (!c || !gsap) return;
    this.warpStop();
    const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 1.5), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // @ts-ignore
    const N = Math.round(Math.min(320, Math.max(120, W * H / 4500))), rnd = () => Math.random() * 2 - 1;
  // @ts-ignore
    if (!this._stars || this._stars.length !== N) this._stars = Array.from({ length: N }, () => ({ x: rnd(), y: rnd(), z: .05 + Math.random() * .95 }));
    const S = this._stars, w = { s: 0 }, cx = W / 2, cy = H / 2;
  // @ts-ignore
    const draw = (dt) => {
      ctx.clearRect(0, 0, W, H);
      const moving = w.s > .04;
      for (let i = 0; i < S.length; i++) {
        const st = S[i];
        st.z -= w.s * dt;
        if (st.z <= .04) { st.x = rnd(); st.y = rnd(); st.z = 1; continue; }
        const sx = cx + (st.x / st.z) * cx, sy = cy + (st.y / st.z) * cy;
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) { if (moving) { st.x = rnd(); st.y = rnd(); st.z = 1; } continue; }
        const a = Math.min(1, (1.05 - st.z) * 1.3).toFixed(2);
        if (moving) {
          const tz = Math.min(1.2, st.z + w.s * .06), tx = cx + (st.x / tz) * cx, ty = cy + (st.y / tz) * cy;
          ctx.strokeStyle = 'rgba(236,232,223,' + a + ')'; ctx.lineWidth = .6 + (1 - st.z) * 1.8;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx, sy); ctx.stroke();
        } else {
          const rr = .5 + (1 - st.z) * 1.4;
          ctx.fillStyle = 'rgba(236,232,223,' + a + ')'; ctx.fillRect(sx - rr / 2, sy - rr / 2, rr, rr);
        }
      }
    };
    if (this.reduce || !dur) { draw(0); return; }
    let last = performance.now();
  // @ts-ignore
    const loop = (t) => { const dt = Math.min(.05, (t - last) / 1000); last = t; draw(dt); this._warpRaf = requestAnimationFrame(loop); };
    this._warpRaf = requestAnimationFrame(loop);
  // @ts-ignore
    this._warpTw = gsap.timeline({ onComplete: () => { cancelAnimationFrame(this._warpRaf); this._warpRaf = 0; w.s = 0; draw(0); } })
      .to(w, { s: 2.2, duration: dur * .3, ease: 'power2.in' })
      .to(w, { s: 0, duration: dur * .7, ease: 'power3.out' });
  }
  warpStop() { cancelAnimationFrame(this._warpRaf); this._warpRaf = 0; if (this._warpTw) { this._warpTw.kill(); this._warpTw = null; } }
  // @ts-ignore
  async openAuth(mode, src, fromDisc) {
    if (!this.$ || !gsap || this.authBusy || this.authClosing) return;

    // Registrations closed (src/config/launch.ts): every route into the registration form ends at the "opening soon" page.
    if (mode === 'register' && !REGISTRATIONS_OPEN && !(this.state.registration || this.pass)) { this.showRegistrationsSoon(); return; }

    // Strict Auth Middleware Guard: Block access to registration if unauthenticated
    if (mode === 'register' && !this.state.user) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('inv_pending_action', 'register');
      }
      mode = 'login';
      this.toast('Please log in to register.');
    }

    // If user is already registered, always show their pass - never show registration (unless they were rejected
    // and may register again)
    if (mode === 'register' && (this.state.registration || this.pass) && !this.canRegisterAgain()) {
      mode = 'pass';
    }

    if (mode === 'pass') {
      this.setState({ step: 4 });
    }

    if (this.state.auth) { this.switchMode(mode); return; }
    this.authBusy = true;
    // The overlay is a lazy chunk (LAZY.auth): mount it before animating it. The rift opens from the button as it
    // is now, even if mounting takes a moment.
    const origin = this.originOf(src, fromDisc);
    if (!(await this.mount('auth'))) { this.authBusy = false; this.toast(LOAD_FAIL); return; }
    const g = gsap, root = this.$('[data-auth-root]'), sec = this.$('[data-auth]');
    this.page = this.livePage(); this.authO = origin;
    await this.set({ auth: true, authMode: mode, err: {}, gErr: '' });
    const sc = this.$('[data-auth-scroll]'); if (sc) sc.scrollTop = 0;
    const ins = this.$$('[data-a-in]'), ui = this.$('[data-a-ui]'), planet = this.$('[data-a-planet-wrap]');
    g.set(root, { autoAlpha: 1, pointerEvents: 'auto' });
    this.authSpin(mode !== 'pass');
    g.set(planet, { rotation: -Math.min(this.state.step, 4) * 26 });
    if (this.reduce) {
      sec.style.clipPath = 'none';
      g.set(ins, { autoAlpha: 1, y: 0 }); g.set(planet, { autoAlpha: 1, scale: 1, yPercent: 0 }); g.set(ui, { scale: 1 });
      this.warp(0);
  // @ts-ignore
      g.fromTo(sec, { autoAlpha: 0 }, { autoAlpha: 1, duration: .4, onComplete: () => { this.authBusy = false; this.focusAuth(); } });
      return;
    }
    g.set(ins, { autoAlpha: 0, y: 26 }); g.set(planet, { autoAlpha: 0, scale: .7, yPercent: 16 }); g.set(ui, { scale: .94 });
    this.authLayers(true);
    const r = this._rift = this.riftNew(0, 0, 1, 0);
    this.riftDraw();
    const k = this.speed();
    this.warp(2.4 / k);
  // @ts-ignore
    this.authTl = g.timeline({ onUpdate: () => this.riftDraw(), onComplete: () => {
      this._rift = null; sec.style.clipPath = 'none'; this.authLayers(false);
      this.pagePush(0); this.authBusy = false; this.focusAuth();
    } })
      .fromTo(sec, { autoAlpha: fromDisc ? 0 : 1 }, { autoAlpha: 1, duration: fromDisc ? .35 : .01, ease: 'power1.out' }, 0)
      .to(r, { p: 1, duration: 1.3, ease: fromDisc ? 'power3.inOut' : 'expo.inOut' }, fromDisc ? .15 : 0)
      .to(r, { z: 1, duration: 1.3, ease: 'power2.inOut' }, 0)
      .to(planet, { autoAlpha: 1, scale: 1, yPercent: 0, duration: 2, ease: 'expo.out' }, .55)
      .to(ui, { scale: 1, duration: 1.5, ease: 'expo.out' }, .6)
      .to(ins, { autoAlpha: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .07 }, .7);
    this.authTl.timeScale(k);
  }
  // @ts-ignore
  closeAuth(after) {
    if (!this.state.auth || this.authClosing || !gsap) return;
    this.authClosing = true;
    if (this.authTl) this.authTl.kill();
    clearTimeout(this._wait); this.warpStop();
    const g = gsap, root = this.$('[data-auth-root]'), sec = this.$('[data-auth]');
    this.page = this.livePage();
  // @ts-ignore
    const done = () => {
      this._rift = null; this.authLayers(false);
      g.set(root, { autoAlpha: 0, pointerEvents: 'none' }); g.set(sec, { autoAlpha: 1 }); sec.style.clipPath = 'none';
      this.pagePush(0);
      this.authSpin(false); this.authClosing = false; this.authBusy = false;
      this.setState({ auth: false, err: {}, busyLbl: '', drag: '' });
      if (after) after();
    };
    if (this.reduce) { g.to(sec, { autoAlpha: 0, duration: .3, onComplete: () => { g.set(sec, { autoAlpha: 1 }); done(); } }); return; }
    this.authLayers(true);
    const r = this._rift = this.riftNew(1, 1, 0, 1);
    this.riftDraw();
  // @ts-ignore
    this.authTl = g.timeline({ onUpdate: () => this.riftDraw(), onComplete: done })
      .to(this.$$('[data-a-in]'), { autoAlpha: 0, y: -14, duration: .3, ease: 'power2.in', stagger: .02 }, 0)
      .to(this.$('[data-a-planet-wrap]'), { autoAlpha: 0, scale: .85, duration: .5, ease: 'power2.in' }, 0)
      .to(r, { p: 0, duration: 1, ease: this.authO && this.authO.r0 ? 'power3.inOut' : 'expo.inOut' }, .2)
      .to(r, { z: 0, duration: 1, ease: 'power2.inOut' }, .2);
    if (this.authO && this.authO.r0) this.authTl.to(sec, { autoAlpha: 0, duration: .3, ease: 'power1.in' }, 1.1);
    this.authTl.timeScale(this.speed());
  }
  // @ts-ignore
  hideAuth() {
    if (!this.state.auth || !gsap) return;
    if (this.authTl) this.authTl.kill();
    clearTimeout(this._wait); this.warpStop(); this._rift = null;
    const sec = this.$('[data-auth]'); if (sec) { sec.style.clipPath = 'none'; gsap.set(sec, { autoAlpha: 1 }); }
    this.authLayers(false);
    gsap.set(this.$('[data-auth-root]'), { autoAlpha: 0, pointerEvents: 'none' });
    this.pagePush(0);
    this.authSpin(false); this.authBusy = false; this.authClosing = false;
    this.setState({ auth: false, busyLbl: '', drag: '' });
  }
  /**
   * Gives the form and its planet their own layers while the rift opens or closes: both scale, and the rift's clip
   * changes every frame, which otherwise re-rastered them each frame. Dropped once still, so the form stays crisp.
   */
  authLayers(on: boolean) {
    this.$$('[data-a-ui],[data-a-planet-wrap]').forEach((el) => { el.style.willChange = on ? 'transform' : ''; });
  }
  // @ts-ignore
  authSpin(on) {
  // @ts-ignore
    (this._spin || []).forEach((t) => t.kill()); this._spin = null;
    if (!on || this.reduce) return;
    this._spin = [
      gsap.to(this.$('[data-a-planet]'), { rotation: '+=360', duration: 180, ease: 'none', repeat: -1 }),
      gsap.to(this.$('[data-a-orbit]'), { rotation: '+=360', duration: 26, ease: 'none', repeat: -1 }),
    ];
  }
  // @ts-ignore
  focusAuth() {
    if (this.state.authMode === 'pass') { this.$('[data-auth]')?.focus({ preventScroll: true }); return; }
    if (matchMedia('(pointer: coarse)').matches) return;
  // @ts-ignore
    const el = this.$$('[data-auth] input').find((i) => i.type !== 'file' && i.offsetParent);
    if (el) el.focus({ preventScroll: true });
  }
  // @ts-ignore
  animPane(dir, head) {
    if (this.reduce || !gsap) return;
  // @ts-ignore
    const vis = (el) => el.offsetParent !== null;
    gsap.fromTo(this.$$('[data-auth] [data-s-in]').filter(vis), { autoAlpha: 0, x: 28 * dir }, { autoAlpha: 1, x: 0, duration: .65, ease: 'power3.out', stagger: .05, overwrite: true });
    if (head) gsap.fromTo(this.$$('[data-m-in]').filter(vis), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out', stagger: .06, overwrite: true });
  }
  // @ts-ignore
  switchMode = (mode) => {
    const s = this.state;
    let m = typeof mode === 'string' ? mode : (s.authMode === 'login' ? 'register' : 'login');

    // Never switch to register if user is already registered - show their pass (unless they were rejected and may
    // register again)
    if (m === 'register' && (s.registration || this.pass) && !this.canRegisterAgain()) {
      m = 'pass';
    }

    if (m === s.authMode || s.busyLbl) return;

    if (m === 'register' && !REGISTRATIONS_OPEN) { this.showRegistrationsSoon(); return; }

    // Strict Auth Middleware: Intercept switching to register without login
    if (m === 'register' && !s.user) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('inv_pending_action', 'register');
      }
      this.toast('Please log in to register.');
      return;
    }


    if (m !== 'pass') playClick();
    this.setState({ authMode: m, step: m === 'pass' ? 4 : s.step, err: {}, gErr: '' }, () => {
      if (m === 'pass') {
        this.passReveal();
      } else {
        this.animPane(1, true);
        this.focusAuth();
      }
    });

  };
  // @ts-ignore
  toStep(n) {
    const dir = n > this.state.step ? 1 : -1;
    this.setState({ step: n, err: {} }, () => {
      const sc = this.$('[data-auth-scroll]'); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
      this.animPane(dir); this.focusAuth();
      if (this.reduce) return;
      gsap.to(this.$('[data-a-planet-wrap]'), { rotation: -n * 26, duration: 1.8, ease: 'expo.out' });
      const node = this.$$('[data-rail-node]')[n];
      if (node) gsap.fromTo(node, { scale: .5 }, { scale: 1, duration: .8, ease: 'back.out(3)' });
      if (n === 1) setTimeout(() => this.scan('qr'), 380);
    });
  }
  railGo(k) { const s = this.state; if (s.authMode === 'register' && k < s.step && !s.busyLbl) this.toStep(k); }
  // @ts-ignore
  stepBack = () => { if (this.state.step > 0 && !this.state.busyLbl) this.toStep(this.state.step - 1); };
  // @ts-ignore
  wait(lbl, ms) {
    this.setState({ busyLbl: lbl });
  // @ts-ignore
    return new Promise((r) => { this._wait = setTimeout(() => { this.setState({ busyLbl: '' }); r(); }, ms); });
  }
  // @ts-ignore
  fail(err) {
    this.setState({ err });
    const k = Object.keys(err)[0];
    if (!k) return false;
    if (k !== 'payfile' && k !== 'idfile') { const el = this.$('[data-auth] [name="' + k + '"]'); if (el && el.offsetParent) el.focus(); }
    const row = this.$('[data-auth-act]');
    if (row && !this.reduce) gsap.fromTo(row, { x: -10 }, { x: 0, duration: .6, ease: 'elastic.out(1,.3)' });
    return true;
  }
  // @ts-ignore
  pickFile(kind) { return (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) this.takeFile(kind, f); }; }
  dragOver(kind) { return (e) => { e.preventDefault(); if (this.state.drag !== kind) this.setState({ drag: kind }); }; }
  dragLeave(kind) { return (e) => { if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return; if (this.state.drag) this.setState({ drag: '' }); }; }
  // @ts-ignore
  dropFile(kind) { return (e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; this.setState({ drag: '' }); if (f) this.takeFile(kind, f); }; }
  // @ts-ignore
  takeFile = async (kind, f) => {
    const slot = UPLOADS[kind] || UPLOADS.pay;
    const ek = slot.ek;
    const isImg = /^image\//.test(f.type);

    if (!isImg) {
      this.fail({ [ek]: slot.typeError });
      return;
    }

    // A phone camera photo of an ID card is often several MB: shrink it in the browser first.
    if (kind === 'id') f = await shrinkImage(f, ID_CARD_UPLOAD_TARGET_BYTES);

    // Same size limit as the route that takes the file (/api/upload: 1 MB, /api/id-card: 2 MB)
    const MAX_SIZE = slot.maxMb * 1024 * 1024;
    if (f.size > MAX_SIZE) {
      this.fail({ [ek]: `That file exceeds ${slot.maxMb} MB. Please select a smaller image (max ${slot.maxMb}MB).` });
      return;
    }

    const old = (this.state.files || {})[kind];
    if (old && old.url && old.url.startsWith('blob:')) URL.revokeObjectURL(old.url);

    const previewUrl = isImg ? URL.createObjectURL(f) : '';
    if (REGISTRATION_PREVIEW_ENABLED && this.state.user?.id === 'dev-preview-user') {
      this.setState((st) => ({
        files: { ...st.files, [kind]: { name: f.name, size: f.size, url: previewUrl, pdf: false, status: 'done', remotePath: 'preview/local-only' } },
        err: this.drop(st.err, ek),
      }));
      return;
    }
    this.setState(
      (st) => ({
        files: { ...st.files, [kind]: { name: f.name, size: f.size, url: previewUrl, pdf: !isImg, status: 'up' } },
        err: this.drop(st.err, ek),
      }),
      () => this.runUpload(kind)
    );

    // Upload to its private bucket via /api/upload or /api/id-card (the server picks the storage path)
    try {
      const formData = new FormData();
      formData.append('file', f);

      const { data: { session } } = await getSupabase().auth.getSession();
      const res = await fetch(slot.url, {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });

      // A rate limit or crash at the platform edge may answer with HTML, not our JSON.
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw Object.assign(new Error(httpErrorMessage(res) || data.error || 'Failed to upload the ' + slot.what), { status: res.status });
      }

      this.setState((st) => ({
        files: {
          ...st.files,
          [kind]: {
            name: f.name,
            size: f.size,
            // The bucket is private (there is no URL to load), so keep showing the local preview and submit
            // only the storage path the server returned with the registration.
            url: previewUrl,
            remotePath: data.path,
            pdf: !isImg,
            status: 'done',
          },
        },
      }));
    } catch (err: any) {
      if (this._up && this._up[kind]) this._up[kind].kill();
      // Rate limited, server error or offline: keep the chosen file so the student can retry it by hand once they have
      // waited (never automatically). Anything else (wrong type, too big, already registered) needs a different file.
      const keep = isTransientFailure(err?.status);
      this.setState((st) => ({
        files: { ...st.files, [kind]: keep ? { name: f.name, size: f.size, url: previewUrl, pdf: !isImg, status: 'failed', file: f } : null },
      }));
      if (!keep && previewUrl) URL.revokeObjectURL(previewUrl);
      this.fail({ [ek]: err?.status ? err.message : 'Upload failed. Please check your connection and try again.' });
    }
  };
  // @ts-ignore
  retryUpload(kind) { const f = (this.state.files || {})[kind]; if (f && f.status === 'failed' && f.file) this.takeFile(kind, f.file); }
  // @ts-ignore
  runUpload(kind) {
    const bar = this.$('[data-up-bar="' + kind + '"]'), pct = this.$('[data-up-pct="' + kind + '"]'), o = { v: 0 };
    this._up = this._up || {};
    if (this._up[kind]) this._up[kind].kill();
  // @ts-ignore
    const paint = () => { if (bar) bar.style.transform = 'scaleX(' + (o.v / 100).toFixed(3) + ')'; if (pct) pct.textContent = Math.round(o.v) + '%'; };
    paint();
  // @ts-ignore
    this._up[kind] = gsap.to(o, { v: 100, duration: this.reduce ? .3 : 1.3, ease: 'power2.inOut', onUpdate: paint, onComplete: () => {
      this.setState((st) => (st.files[kind] && st.files[kind].status === 'up' ? { files: { ...st.files, [kind]: { ...st.files[kind], status: 'done' } } } : null), () => this.scan(kind));
    } });
  }
  // @ts-ignore
  scan(kind) {
    if (this.reduce || !gsap) return;
    const s = this.$('[data-scan="' + kind + '"]');
    if (s && s.offsetParent !== null) gsap.fromTo(s, { yPercent: 0, autoAlpha: 1 }, { yPercent: 100, duration: 1.2, ease: 'power2.inOut', onComplete: () => gsap.to(s, { autoAlpha: 0, duration: .3 }) });
  }
  // @ts-ignore
  removeFile(kind) {
  // @ts-ignore
    const f = (this.state.files || {})[kind]; if (f && f.url && f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
    if (this._up && this._up[kind]) this._up[kind].kill();
    this.setState((st) => ({ files: { ...st.files, [kind]: null } }));
  }
  // @ts-ignore
  replaceFile(kind) { const i = this.$('[data-auth] [name="' + (UPLOADS[kind] || UPLOADS.pay).ek + '"]'); if (i) i.click(); }
  dropFiles() { Object.values(this.state.files || {}).forEach((f: any) => { if (f && f.url && f.url.startsWith('blob:')) URL.revokeObjectURL(f.url); }); }
  // @ts-ignore
  copyUpi = () => {
    const t = this.upi();
  // @ts-ignore
    const ok = () => { this.setState({ copied: true }); clearTimeout(this._copy); this._copy = setTimeout(() => this.setState({ copied: false }), 1600); };
  // @ts-ignore
    const no = () => this.toast('UPI ID: ' + t);
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, no); else no(); } catch (e) { no(); }
  };
  /** Copies the code shown on the pass (shareCode). */
  copyReferral = () => {
    const code = this.shareCode();
    if (!code) return;
    const ok = () => { this.setState({ refCopied: true }); clearTimeout(this._refCopy); this._refCopy = setTimeout(() => this.setState({ refCopied: false }), 1600); };
    const no = () => this.toast('Your referral code: ' + code);
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok, no); else no(); } catch { no(); }
  };
  // @ts-ignore
  authSubmit = (e) => {
    e.preventDefault();
    const s = this.state;
    if (s.busyLbl) return;

    const f = e.currentTarget.elements;
    const v = (n: string) => ((f[n] && f[n].value) || '').trim();
    const err: Record<string, string> = {};
    const files = s.files || {};
    const user = s.user;
    const isInternal = (user?.student_type === 'internal') || (user?.email?.toLowerCase().endsWith('@nitrkl.ac.in'));
    if (user?.id === 'dev-preview-user' && !REGISTRATION_PREVIEW_ENABLED) {
      this.toast('Preview is disabled. Please sign in with Google.');
      return;
    }

    if (s.authMode === 'login') {
      const em = v('lemail'), id = v('lid').toUpperCase().replace(/\s+/g, '');
      if (!this.emailOk(em)) err.lemail = 'Enter the email you registered with.';
      if (!/^IV26-?\d{4}$/.test(id)) err.lid = 'Registration IDs look like IV26-1234.';
      if (this.fail(err)) return;
      this.wait('CHECKING', 900).then(async () => {
        const supabase = getSupabase();
        const { data: reg } = await supabase
          .from('registrations')
          .select('*')
          .eq('registration_id', id.replace(/^IV26-?/, 'IV26-'))
          .ilike('email', em)
          .maybeSingle();

        if (reg) {
          this.pass = {
            name: reg.name,
            college: reg.college,
            id: reg.registration_id,
            email: reg.email,
            status: reg.status.toUpperCase(),
          };
          this.setState({ registration: reg });
          this.closeAuth(() => this.toast(`Welcome back, ${reg.name.split(' ')[0]}.`));
        } else {
          // Never show a pass for a registration the server didn't return.
          this.fail({ lid: 'No registration matches that email and ID.' });
        }
      });
      return;
    }

    if (s.authMode !== 'register') return;

    // Requirement: Registration is only permitted if user is logged in
    if (!user) {
      this.openAuth('login');
      this.toast('Please log in with Google to register.');
      return;
    }

    if (s.step === 0) {
      const name = v('name').replace(/\s+/g, ' ');
      const college = v('college').replace(/\s+/g, ' ');
      const email = user.email; // LOCKED - CANNOT BE ALTERED
      const phone = v('phone').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
      const enrollment_no = v('enrollment_no');
      const gender = v('gender');

      if (name.length < 2) err.name = 'Tell us your full name.';
      else if (name.length > 100) err.name = 'Keep your name under 100 characters.';
      if (!GENDERS.some((g) => g.value === gender)) err.gender = 'Select your gender.';
      if (college.length < 3) {
        err.college = 'Which college are you from?';
      } else if (college.length > 200) {
        err.college = 'Keep the college name under 200 characters.';
      } else if (isIterSoaCollege(college) || isIterSoaEmail(email)) {
        err.college = ITER_SOA_ERROR_MESSAGE;
      }
      if (!/^[6-9]\d{9}$/.test(phone)) err.phone = 'Use a 10-digit Indian mobile number.';
      if (!enrollment_no) err.enrollment_no = 'Enter your college roll / enrollment number.';
      else if (enrollment_no.length > 50 || (enrollment_no && !/^[A-Za-z0-9/_ -]+$/.test(enrollment_no))) {
        err.enrollment_no = 'Use only letters, numbers, spaces and / _ - (up to 50 characters).';
      }
      const idf = files.id;
      if (!idf) err.idfile = 'Upload a photo of the front of your college ID card.';
      else if (idf.status === 'failed') err.idfile = 'Your ID card photo did not upload. Use RETRY UPLOAD to send it again.';
      else if (idf.status !== 'done' || !idf.remotePath) err.idfile = 'Hold on, your ID card photo is still uploading.';
      // Optional: a registrant's or a campus ambassador's code. Checked with the server before payment (and again on
      // submit), so a wrong or deactivated code is fixed before anyone pays.
      const referred_by_code = normalizeReferralCode(v('referred_by_code'));
      if (referred_by_code && !isReferralCode(referred_by_code)) err.referred_by_code = REFERRAL_CODE_FORMAT_ERROR;

      if (this.fail(err)) return;
      this.reg = { name, college, email, phone, enrollment_no, gender, referred_by_code };

      // Every student, NIT Rourkela included, continues to Step 1 (payment), unless every seat is taken: nobody should
      // pay for a seat that isn't there. A count that can't be read doesn't hold the student up.
      this.setState({ busyLbl: referred_by_code ? 'CHECKING CODE' : 'CHECKING SEATS' });
      Promise.all([fetchSeatCount(), referred_by_code ? checkReferralCode(referred_by_code) : null]).then(([seats, res]) => {
        if (!this.alive) return;
        this.setState({ busyLbl: '' });
        // Moved on meanwhile (closed the form, signed out).
        if (!this.state.auth || this.state.authMode !== 'register' || this.state.step !== 0) return;
        if (seats && seats.left === 0) { this.fail({ form: SEATS_FULL_MESSAGE }); return; }
        // A check that couldn't run (offline, busy) doesn't hold the student up: the submit checks the code again.
        if (res && 'valid' in res && !res.valid) { this.fail({ referred_by_code: res.error }); return; }
        this.toStep(1);
      });
    } else if (s.step === 1) {
      this.toStep(2);
    } else if (s.step === 2) {
      if (REGISTRATION_PREVIEW_ENABLED && user.id === 'dev-preview-user') {
        const utr = v('utr').replace(/\s+/g, '');
        if (!files.pay || files.pay.status !== 'done') err.payfile = 'Choose an image to preview the payment screenshot upload.';
        if (!/^\d{12}$/.test(utr)) err.utr = 'Enter a 12-digit UTR to test this step. No payment is submitted.';
        if (this.fail(err)) return;
        this.wait('SUBMITTING', 600).then(() => {
          const r = this.reg || {};
          const regId = 'PREVIEW-9042';
          this.pass = {
            name: r.name || 'Alex Explorer',
            college: r.college,
            id: regId,
            email: user.email,
            status: 'PENDING',
            utr,
          };
          const mockReg = {
            id: 'dev-reg-temp',
            registration_id: regId,
            user_id: user.id,
            name: this.pass.name,
            email: user.email,
            college: this.pass.college,
            phone: r.phone || '9876543210',
            enrollment_no: r.enrollment_no,
            gender: r.gender,
            student_type: 'external' as const,
            payment_proof_path: 'mock/proof.png',
            id_card_path: 'mock/id-card.png',
            utr,
            amount: 999,
            status: 'pending' as const,
            referral_code: 'INNO-' + Math.floor(1000 + Math.random() * 9000),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          this.setState(
            {
              authMode: 'pass',
              step: 4,
              registration: mockReg as Registration,
              busyLbl: '',
            },
            () => this.passReveal()
          );
        });
        return;
      }
      const fp = files.pay, idf = files.id, utr = v('utr').replace(/\s+/g, '');
      if (!idf || idf.status !== 'done' || !idf.remotePath) {
        // Only on the details step: back there to upload it.
        this.toStep(0);
        this.setState({ err: { idfile: 'Upload a photo of the front of your college ID card.' } });
        return;
      }
      if (!fp) err.payfile = 'Upload the screenshot of your payment.';
      else if (fp.status === 'failed') err.payfile = 'Your screenshot did not upload. Use RETRY UPLOAD to send it again.';
      else if (fp.status !== 'done' || !fp.remotePath) err.payfile = 'Hold on, your screenshot is still uploading.';
      if (!/^\d{12}$/.test(utr)) err.utr = 'UTR numbers are 12 digits. Check the payment details in your UPI app.';
      if (this.fail(err)) return;

      this.wait('SUBMITTING', 1400).then(async () => {
        const r = this.reg || {};
        const regId = this.newId();
        const regPayload = {
          registration_id: regId,
          user_id: user.id,
          name: r.name,
          email: user.email,
          college: r.college,
          phone: r.phone,
          enrollment_no: r.enrollment_no,
          gender: r.gender,
          // student_type, amount and status are decided by the server (the body's values are ignored).
          student_type: (isInternal ? 'internal' : 'external') as Registration['student_type'],
          payment_proof_path: fp.remotePath,
          id_card_path: idf.remotePath,
          utr,
          amount: this.fee(),
          status: 'pending' as const,
          ...(r.referred_by_code ? { referred_by_code: r.referred_by_code } : {}),
        };

        const saveRes = await createRegistration(regPayload);
        const savedReg = saveRes.registration;
        if (!savedReg) {
          const msg = saveRes.error || 'Registration failed';
          this.toast(msg);
          const field = saveRes.field || '';
          const detailsField = ['name', 'college', 'phone', 'gender', 'enrollment_no', 'referred_by_code'].includes(field);
          if (isTransientFailure(saveRes.status) || !(detailsField || field === 'idfile' || field === 'payfile' || field === 'utr')) {
            // Rate limited, server error, offline, closed or signed out: stay on this step with the UTR and screenshot
            // intact, so the student can submit again by hand. Nothing is resubmitted automatically.
            this.setState({ busyLbl: '', err: { form: msg } });
            return;
          }
          if (field === 'idfile') {
            // The stored ID card photo can't be used: back to the details step to pick it again.
            this.removeFile('id');
            this.setState({ busyLbl: '' });
            this.toStep(0);
            this.setState({ err: { idfile: msg } });
            return;
          }
          if (field === 'payfile') {
            // The stored screenshot can't be used: pick it again (a fresh upload gets a fresh storage path).
            this.removeFile('pay');
            this.setState({ busyLbl: '', err: { payfile: msg } });
            return;
          }
          if (field === 'utr') {
            this.setState({ busyLbl: '' });
            this.fail({ utr: msg });
            return;
          }
          // Details from the first step (name, college, phone, gender, enrollment number, referral code): go back to
          // fix them.
          this.setState({ busyLbl: '' });
          this.toStep(0);
          this.setState({ err: { [field]: msg } });
          return;
        }

        this.clearSharedRef();
        this.pass = {
          name: savedReg.name || r.name,
          college: savedReg.college || r.college,
          id: savedReg.registration_id || regId,
          email: user.email,
          status: (savedReg.status || 'PAYMENT UNDER REVIEW').toUpperCase(),
          utr,
        };
        this.setState(
          {
            authMode: 'pass',
            step: 4,
            registration: savedReg as Registration,
            busyLbl: '',
          },
          () => this.passReveal()
        );
      });
    }
  };
  // @ts-ignore
  passReveal() {
    this.authSpin(false);
    const sc = this.$('[data-auth-scroll]'); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
    this.animPane(1, true);
  }
  // @ts-ignore
  devOpenPass = async () => {
    if (!REGISTRATION_PREVIEW_ENABLED) return;
    const mockUser: any = {
      id: 'dev-preview-user',
      email: 'alex.explorer@nitrkl.ac.in',
      full_name: 'Alex Explorer',
      student_type: 'internal',
      role: 'user',
      avatar_url: '',
      phone: '9876543210',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const mockReg: any = {
      id: 'dev-reg-1',
      registration_id: 'PREVIEW-9042',
      user_id: mockUser.id,
      name: 'Alex Explorer',
      email: mockUser.email,
      college: 'Example Institute of Technology',
      phone: '9876543210',
      enrollment_no: '122MN0999',
      gender: 'Male',
      student_type: 'internal',
      payment_proof_path: 'mock/payment.png',
      id_card_path: 'mock/id-card.png',
      utr: '987654321098',
      amount: 999,
      status: 'confirmed',
      referral_code: 'INNO-CELESTIAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.pass = {
      name: mockReg.name,
      college: mockReg.college,
      id: mockReg.registration_id,
      email: mockReg.email,
      status: 'CONFIRMED',
      utr: mockReg.utr,
    };
    if (!this.state.auth) {
      await this.openAuth('pass');
    }
    this.setState(
      {
        user: mockUser,
        registration: mockReg,
        auth: true,
        authMode: 'pass',
        step: 4,
      },
      () => this.passReveal()
    );
  };

  // @ts-ignore
  devOpenRegister = async () => {
    if (!REGISTRATION_PREVIEW_ENABLED) return;
    const mockUser: any = {
      id: 'dev-preview-user',
      email: 'alex.explorer@nitrkl.ac.in',
      full_name: 'Alex Explorer',
      student_type: 'internal',
      role: 'user',
      avatar_url: '',
      phone: '9876543210',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.reg = {
      name: 'Alex Explorer',
      college: '',
      phone: '9876543210',
      enrollment_no: '122MN0999',
      gender: 'Male',
      referred_by_code: '',
    };
    this.pass = null;
    this.setState(
      {
        user: mockUser,
        registration: null,
      },
      async () => {
        await this.openAuth('register');
        this.setState({ step: 0 });
        const sc = this.$('[data-auth-scroll]'); if (sc) sc.scrollTop = 0;
      }
    );
  };
  devApproveRegistration = () => {
    if (!REGISTRATION_PREVIEW_ENABLED || this.state.user?.id !== 'dev-preview-user' || this.state.registration?.status !== 'pending') return;
    this.pass = { ...this.pass, status: 'CONFIRMED' };
    this.setState((st) => ({ registration: { ...st.registration, status: 'confirmed' } }), () => this.passReveal());
  };
  // @ts-ignore
  clearErr = (e) => {
    const n = e.target && e.target.name;
    if (n && this.state.err[n]) this.setState((st) => ({ err: this.drop(st.err, n) }));
  };
  // @ts-ignore
  exploreFromPass = (e) => { e.preventDefault(); this.closeAuth(() => this.go('#/worlds/takeoff')); };
  // @ts-ignore
  authVals(s) {
  // @ts-ignore
    const am = s.authMode, st = s.step, reg = am === 'register', show = (b) => (b ? 'flex' : 'none'), gold = 'oklch(0.78 0.075 85)', cream = '#ECE8DF', bad = 'oklch(0.74 0.15 35)';
    const E = Object.assign({ name: '', gender: '', college: '', email: '', phone: '', enrollment_no: '', referred_by_code: '', idfile: '', payfile: '', utr: '', lemail: '', lid: '', form: '' }, s.err);
    const bc = {}, inv = {};
  // @ts-ignore
    Object.keys(E).forEach((k) => { bc[k] = E[k] ? bad : 'rgba(236,232,223,.28)'; inv[k] = String(!!E[k]); });
    const P = this.pass || s.registration || {}, fee = this.fee(), upi = this.upi(), R = this.reg || {}, files = s.files || {};
    const user = s.user;
    const isInternal = (user?.student_type === 'internal') || (user?.email?.toLowerCase().endsWith('@nitrkl.ac.in'));
    const regVals = {
      name: user?.full_name || R.name || '',
      college: R.college || s.registration?.college || '',
      email: user?.email || '',
      phone: user?.phone || R.phone || '',
      enrollment_no: user?.enrollment_no || s.registration?.enrollment_no || R.enrollment_no || '',
      gender: R.gender || s.registration?.gender || '',
      // What the student entered on the first step, else a share link's code.
      referred_by_code: this.reg ? R.referred_by_code || '' : this.sharedRef,
    };
  // @ts-ignore
    const up = (kind, ek, prompt) => {
      const f = files[kind], dz = s.drag === kind;
      return {
        emptyD: show(!f), prevD: f ? 'block' : 'none', busyD: show(!!f && f.status === 'up'), rowD: show(!!f && f.status === 'done'), failD: show(!!f && f.status === 'failed'), hasImg: !!(f && f.url), pdfD: show(!!f && f.pdf),
        url: (f && f.url) || '', name: f ? f.name : '', size: f ? this.fmtSize(f.size) : '',
        bc: dz ? gold : E[ek] ? bad : 'rgba(236,232,223,.32)', bg: dz ? 'rgba(220,183,106,.1)' : 'rgba(236,232,223,.03)', prompt: dz ? 'Release to upload' : prompt,
        pick: this.pickFile(kind), over: this.dragOver(kind), leave: this.dragLeave(kind), drop: this.dropFile(kind), remove: () => this.removeFile(kind), replace: () => this.replaceFile(kind), retry: () => this.retryUpload(kind),
      };
    };
    const showRail = reg;
    const notes = [regVals.name, 'by UPI', 'Submitted'];

    // Same three steps for every student: there is no free tier.
    const railSteps = [['DETAILS', 'Name, gender, college, phone, ID card', 'DETAILS'], ['PAYMENT', 'by UPI', 'PAY'], ['SUBMIT', 'Screenshot and transaction ID, then team review', 'SUBMIT']];

    return {
      noUser: !s.user, hasUser: !!s.user, showLogin: !s.narrow, loginClick: this.loginClick, noDrop: (e) => e.preventDefault(),
      authHidden: String(!s.auth),
      authAria: reg ? 'Register for Innovision 2026' : am === 'login' ? 'Log in to Innovision' : 'Your boarding pass',
      authCols: s.narrow ? 'minmax(0,1fr)' : 'minmax(0,.9fr) minmax(0,1fr)',
      authTitle: reg ? 'Claim your seat' : am === 'login' ? 'Welcome back' : P.status === 'CONFIRMED' ? 'Your place in the odyssey' : P.status === 'REJECTED' ? 'Payment not approved' : 'Registration received',
      authSub: reg
        ? 'Three short stops to register for Innovision 2026 at NIT Rourkela.'
        : am === 'login' ? 'Sign in or create your account with Google.' : P.status === 'CONFIRMED' ? 'Your payment is verified. Your INNO pass is always available here.' : P.status === 'REJECTED' ? (this.canRegisterAgain() ? 'See why below, then register again with the right details.' : 'Please contact the registration helpdesk for assistance.') : 'Your payment is under review by the registration team. Your pass appears here after approval.',
      // The seat counter (GET /api/seats) beside the registration form. Only while the overlay is open: it is mounted,
      // closed, at idle (warmDeferred), and a mounted counter polls every 30 s. `auth` turns true before the overlay
      // animates in and false after it has animated out, so the counter is never cut off mid-animation.
      showSeats: reg && s.auth,
      // REGISTER AGAIN on a rejected pass; the pass itself decides whether to show it (attempts left).
      registerAgain: REGISTRATIONS_OPEN ? this.registerAgain : undefined,
      idCardUploaded: this.idCardUploaded,
      railD: show(showRail && !s.narrow), hprogD: showRail && s.narrow ? 'grid' : 'none',
      prog: railSteps.map(([label, hint, short], k) => {
        const done = k < st, cur = k === st && reg, back = done && reg;
        return {
          label, short, note: done ? notes[k] || hint : hint, cur: cur ? 'step' : 'false',
          c: done || cur ? cream : 'rgba(236,232,223,.6)', bc: done || cur ? gold : 'rgba(236,232,223,.3)', fill: done ? gold : 'transparent', chk: done ? 1 : 0, dot: cur ? 1 : 0, dotS: cur ? 1 : .2,
          lineD: k < railSteps.length - 1 ? 'block' : 'none', lineS: done ? 1 : 0, segS: done ? 1 : cur ? .5 : 0,
          lock: !back || !!s.busyLbl, cursor: back ? 'pointer' : 'default', go: () => this.railGo(k), aria: label + (done ? ', done. Go back to edit' : cur ? ', current step' : ''),
        };
      }),
      d: { s0: show(reg && st === 0 && !!s.user), s2: show(reg && st === 1 && !!s.user), s3: show(reg && st === 2 && !!s.user), login: show(am === 'login' || (reg && !s.user)), pass: show(am === 'pass'), act: show(reg && !!s.user) },
      err: E, bc, inv, genderOptions: GENDERS,
      upPay: up('pay', 'payfile', 'Drop the screenshot here or browse (Max 1MB)'),
      upId: up('id', 'idfile', 'Drop a photo of your ID card here or browse'),
      fee, upi, copyUpi: this.copyUpi, copyLbl: s.copied ? 'COPIED' : 'COPY',
      upiLink: UPI_PAY_LINK, upiQr: UPI_QR_SRC,
      upiAppD: s.narrow ? 'inline-flex' : 'none',
      authSubmit: this.authSubmit, clearErr: this.clearErr, switchMode: this.switchMode, closeAuthH: () => this.closeAuth(),
      showSwitch: am !== 'pass' && !reg && !!s.user,
      switchQ: !s.user ? 'Authentication required' : 'Need to register?',
      switchLbl: !s.user ? 'SIGN IN' : 'REGISTER',
      switchQD: s.narrow ? 'none' : 'inline',
      canBack: reg && st > 0, stepBack: this.stepBack,
      submitLbl: s.busyLbl || (am === 'login' ? 'LOG IN' : ['CONTINUE TO PAYMENT', "I'VE PAID", 'SUBMIT REGISTRATION'][st] || 'CONTINUE'),
      busy: !!s.busyLbl, busyO: s.busyLbl ? .72 : 1,
      passName: P.name || '', passCollege: P.college || '', passCollegeD: P.college ? 'block' : 'none', passId: P.id || P.registration_id || '', passStatus: P.status ? P.status.toUpperCase() : 'PAYMENT UNDER REVIEW',
      // Mounted only while the pass is open, so the QR is fetched then and not on every page load.
      passQr: !!s.auth && am === 'pass' && !!s.user,
      passUserId: s.user?.id,
      passNote: P.status === 'CONFIRMED'
        ? 'You are confirmed. Download your entry pass now and show the QR with your college ID at the registration desk, so entry at NIT Rourkela is quick.'
        : P.status === 'REJECTED'
        ? 'Your registration could not be approved. Please contact the helpdesk.'
        : 'Your payment is under review. Only the registration team can approve it. This page updates automatically while you are here.',
      // The code shared from the pass: an ambassador's CA code, else the registrant's own (shareCode).
      refCode: this.shareCode(), refCodeLabel: s.registration?.ambassador_code ? 'Your Ambassador Code:' : 'Your Referral Code:',
      copyRefCode: this.copyReferral, refCodeLbl: s.refCopied ? 'COPIED' : 'COPY CODE',
      exploreFromPass: this.exploreFromPass,
      googleLogin: this.googleLogin, gBusy: s.gBusy, gErr: s.gErr, gLbl: s.gBusy ? 'Waiting for Google…' : 'Continue with Google',
      gNote: reg && st === 0 && s.user ? 'Signed in as ' + s.user.email + '.' : '',
      regVals,
      isInternal,
      user: s.user,
      isDev: REGISTRATION_PREVIEW_ENABLED,
      isPreviewUser: REGISTRATION_PREVIEW_ENABLED && s.user?.id === 'dev-preview-user',
      previewPending: REGISTRATION_PREVIEW_ENABLED && s.user?.id === 'dev-preview-user' && s.registration?.status === 'pending',
      previewPass: REGISTRATION_PREVIEW_ENABLED && s.user?.id === 'dev-preview-user' && s.registration ? {
        registrationStatus: s.registration.status,
        passStatus: s.registration.status === 'confirmed' ? 'active' : 'none',
        registrationId: s.registration.registration_id,
        name: s.registration.name,
        college: s.registration.college,
        checkedIn: false,
        token: null,
        idCard: s.registration.status === 'rejected' ? undefined : s.registration.id_card_path ? 'uploaded' : 'pending',
      } : undefined,
      devApproveRegistration: this.devApproveRegistration,
      devOpenPass: this.devOpenPass,
      devOpenRegister: this.devOpenRegister,
    };
  }
  linkGo = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const href = e.currentTarget.getAttribute('href') || '#/';
    this.setState({ menu: false, about: false });
    this.go(href);
  };
  onWheel = (e: WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (this.wheelLock || Math.abs(d) < 30) return;
    this.wheelLock = true;
    setTimeout(() => { this.wheelLock = false; }, 1500);
    this.stepSlide(d > 0 ? 1 : -1);
  };
  onTouchStart = (e: TouchEvent) => { this.touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  onTouchEnd = (e: TouchEvent) => {
    if (!this.touch) return;
    const dx = e.changedTouches[0].clientX - this.touch.x, dy = e.changedTouches[0].clientY - this.touch.y;
    this.touch = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    this.stepSlide(dx < 0 ? 1 : -1);
  };

  renderVals() {
    // Handlers below read this.state when they run: memoised views may hold an older v.
    const s = this.state, i = s.index, w = WORLDS[i], dw = WORLDS[s.dIndex], nx = WORLDS[(s.dIndex + 1) % WORLDS.length];
    const navOn = s.view === 'worlds' || s.view === 'detail';
    // On a world's page the world switcher shows only at the top, where you land after Enter; once the page scrolls
    // (hudSolid) it gives the scene and the mission list the whole screen.
    const navShown = navOn && !(s.view === 'detail' && s.hudSolid);
    const act = s.view === 'gallery' ? 'gallery' : s.view === 'schedule' ? 'schedule' : navOn ? 'events' : 'home';
    const routed = (k: string) => k === 'events' || k === 'merch' || k === 'gallery' || k === 'schedule';
    const navLinks = LINKS.map(([label, k]) => ({
      label: label.toUpperCase(), name: label, cur: String(k === act) as 'true' | 'false', o: k === act ? 1 : .68, bar: k === act ? 1 : 0, dc: k === act ? 'oklch(0.8 0.12 85)' : '#ECE8DF',
      href: k === 'events' ? '#/worlds/' + w.slug : k === 'merch' ? MERCH_PATH : k === 'gallery' ? '#/gallery' : k === 'schedule' ? '#/schedule' : '#/',
      onClick: (e: MouseEvent<HTMLAnchorElement>) => {
        if (routed(k)) { if (this.state.about || this.state.menu) this.setState({ about: false, menu: false }); return; }
        e.preventDefault(); this.goSection(k === 'home' ? null : k);
      },
    }));
    return {
      // Navbar (top bar and phone menu) hides Schedule; the view, #/schedule route and footer link stay.
      navLinks, hudLinks: navLinks.filter((_, i) => !NAVBAR_HIDDEN.includes(LINKS[i][1])), footLinks: navLinks.slice(0, 5), wide: !s.compact,
      // Wide screens open the About drawer; compact screens open the full-screen menu.
      // The MENU button only exists on compact screens; wide screens show LOG IN in its place.
      menuButton: () => { this.openLazy('menu', { menu: true }); },
      menuExpanded: s.menu,
      menuLogin: (e: MouseEvent<HTMLAnchorElement>) => { this.setState({ menu: false }); this.loginClick(e); },
      goHome: (e: MouseEvent) => { e.preventDefault(); this.goSection(null); },
      // Campus Ambassador section (HomeView): the Google Form ('' while it is a placeholder) and GET MY CODE.
      ambassadorFormUrl: AMBASSADOR_FORM_URL, getAmbassadorCode: this.getAmbassadorCode,
      topNav: navLinks.filter((_, i) => !NAVBAR_HIDDEN.includes(LINKS[i][1])).map((l) => ({ label: l.label, labelCap: l.name, href: l.href, menuColor: l.dc, cur: l.cur === 'true', onClick: l.onClick })),
      linkGo: this.linkGo,
      menuVis: (s.menu ? 'visible' : 'hidden') as 'visible' | 'hidden', menuDelay: s.menu ? '0s' : '.9s', menuClip: s.menu ? 'circle(150% at 100% 0%)' : 'circle(0% at 100% 0%)', menuHidden: !s.menu,
      closeMenu: () => this.setState({ menu: false }),
      tunnel: TUNNEL.map(([x, y], k) => {
        const photo = ARCHIVE[k % ARCHIVE.length];
        return {
          id: 'gallery-' + (k + 1),
          ph: photo.title + ' photo',
          capU: photo.title.toUpperCase(),
          no: String(k + 1).padStart(2, '0'),
          x,
          y,
          ar: photo.width + ' / ' + photo.height,
          arN: (photo.width / photo.height).toFixed(3),
          c: TUNNEL_C[k % TUNNEL_C.length],
          imageUrl: ikWidth(photo.url, 960),
        };
      }),
      tunnelTotal: String(TUNNEL.length).padStart(2, '0'),
      // Logos are sized by the square root of their aspect ratio, so wide wordmarks and square marks carry similar weight.
      pastSponsors: PAST_SPONSORS.map((s) => ({ ...s, src: ikWidth(s.logo, 400), w: Math.min(78, 36 * Math.sqrt(s.width / s.height)).toFixed(1) + '%' })),
      toastMsg: s.toastMsg,
      heroChars: 'INNOVISION'.split('').map((ch) => ({ ch })),
      briefWords: BRIEF.split(' '),
      heroSparks: HERO_SPARKS,
      loaderSparks: LOADER_SPARKS,
      worlds: WORLDS.map((x, k) => ({
        ...x, secNo: String(k + 1).padStart(2, '0'), secTotal: String(WORLDS.length).padStart(2, '0'), sealText: x.statL.toUpperCase() + ' · ' + x.category.toUpperCase() + ' · ',
        href: '#/world/' + x.slug, stroke: 'color-mix(in oklab, ' + x.ink + ' 36%, transparent)', statLU: x.statL.toUpperCase(), categoryU: x.category.toUpperCase(),
        astroBottom: x.astroSit ? 'calc(100% - 7vh)' : 'calc(100% - 3.5vh)', astroH: x.astroSit ? (s.narrow ? '32vh' : '42vh') : (s.narrow ? '30vh' : '40vh'),
        onExplore: () => this.go('#/world/' + x.slug),
        onEnter: () => this.openMap(k),
        // Footer links: crawlable /events/<slug> pages, but a plain click opens the world here, as before.
        pageHref: '/events/' + x.slug,
        openPage: (e: MouseEvent<HTMLAnchorElement>) => { if (plainClick(e)) { e.preventDefault(); this.go('#/world/' + x.slug); } },
      })),
      eventsHref: '/events',
      openEvents: (e: MouseEvent<HTMLAnchorElement>) => { if (plainClick(e)) { e.preventDefault(); this.go('#/worlds/' + WORLDS[0].slug); } },

      cw: (() => {
        // Events belong to the world that lists their category; an event without one shows in every world.
        const catEvents = (s.dbEvents || []).filter((ev) => !ev.category || dw.categories.includes(ev.category.toLowerCase().trim()));

        const useDynamic = catEvents.length > 0;
        const list = useDynamic
          ? catEvents.map((ev) => ({
              name: ev.title,
              text: ev.description,
              cat: (ev.category || '').toLowerCase().trim(),
              posterUrl: ev.poster_url || '',
              brochureUrl: ev.brochure_url && isValidGoogleDriveUrl(ev.brochure_url) ? ev.brochure_url : '',
            }))
          : dw.missions.map(([name, text, , , cat]) => ({ name, text, cat: cat || '', posterUrl: '', brochureUrl: '' }));

        // A world that combines categories (DTS and Fun) lists each one under its own heading, in dw.groups order;
        // anything that fits none of them (no category) closes the list untitled.
        const sections = dw.groups
          ? [...dw.groups.map(([cat, title]) => ({ key: cat, title, items: list.filter((m) => m.cat === cat) })),
             { key: 'other', title: '', items: list.filter((m) => !dw.groups!.some(([cat]) => cat === m.cat)) }]
          : [{ key: 'all', title: '', items: list }];
        // Numbered in display order; idx is the ticket's place in missions, which the event popup reads.
        // A titled group with no events yet stays, shown as "Coming soon".
        let n = 0;
        const groups = sections.filter((g) => g.items.length || g.title).map((g) => ({
          key: g.key,
          title: g.title,
          titleU: g.title.toUpperCase(),
          count: String(g.items.length).padStart(2, '0'),
          soon: !g.items.length,
          missions: g.items.map((m) => {
            const k = n++;
            return {
              ...m,
              idx: k,
              no: String(k + 1).padStart(2, '0'),
              tag: g.title ? g.title.toUpperCase() : dw.statL.toUpperCase(),
              format: '',
              dur: '',
              img: A + dw.gates[k % dw.gates.length],
            };
          }),
        }));
        const missions = groups.flatMap((g) => g.missions);

        return {
          ...dw,
          categoryU: dw.category.toUpperCase(),
          statLU: dw.statL.toUpperCase(),
          serial: 'IV26-0' + (s.dIndex + 1),
          stampText: 'BOARDING SOON · ' + dw.statL.toUpperCase() + ' · ',
          frame: 'color-mix(in oklab, ' + dw.ink + ' 50%, transparent)',
          ticker: [0, 1, 2, 3].flatMap(() => ['Now boarding · ' + dw.name, ...groups.flatMap((g) => g.soon ? [g.titleU + ' · Coming soon'] : g.missions.map((m) => m.name))]).map((t) => ({ t })),
          chars: [...dw.name.toUpperCase()].map((ch) => ({ ch: ch === ' ' ? ' ' : ch })),
          words: dw.tagline.split(' ').map((t) => ({ t })),
          specs: dw.specs.map(([k, v], j) => ({ k, v, i: String(j + 1).padStart(2, '0') })),
          missionCount: String(missions.length).padStart(2, '0'),
          missions,
          groups,
        };
      })(),
      nw: { href: '#/world/' + nx.slug, nameU: nx.name.toUpperCase(), planet: nx.planet },
      eventPop: s.view === 'detail' ? s.eventPop : null,
      openEvent: (k: number) => this.setState({ eventPop: k }),
      closeEvent: () => this.setState({ eventPop: null }),

      titleShadow: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${n}px ${n}px 0 ${dw.accent}`).join(', '),
      isTakeoff: dw.key === 'takeoff', isSpotlight: dw.key === 'spotlight', isTouchdown: dw.key === 'touchdown', isHighpoint: dw.key === 'highpoint',
      isDetail: s.view === 'detail',
      compact: s.compact, notCompact: !s.compact,
      taglineW: s.compact ? '88vw' : 'min(640px, 34vw)',
      arrowsDisplay: s.narrow ? 'none' : 'grid',
      backHref: '#/worlds/' + w.slug,
      nav: WORLDS.map((x, k) => ({ no: String(k + 1).padStart(2, '0'), label: x.name.toUpperCase(), current: k === i, color: k === i ? '#ECE8DF' : 'rgba(20,19,18,.72)', onClick: () => this.navTo(k) })),
      navX: (i * 100) + '%',
      navW: (100 / WORLDS.length) + '%',
      navGlow: '#141312',
      navO: navShown ? 1 : 0, navY: navShown ? '0px' : '30px', navPE: (navShown ? 'auto' : 'none') as 'auto' | 'none',
      navBottom: s.narrow ? 'calc(clamp(16px,2.6vw,44px) + 40px)' : 'clamp(16px,2.6vw,44px)',
      hudSolid: s.hudSolid,
      hintOn: s.hint && s.view === 'worlds' && !s.auth && !s.menu,
      // Entering is spelled out by the world's Enter button; the guide covers what isn't on screen: there are four worlds.
      // Name only the controls this screen shows: no side arrows on narrow screens, no keys on touch.
      hintMain: s.coarse ? 'Swipe left or right to visit all four worlds' : s.narrow ? 'Use the ← → keys or the switcher below to visit all four worlds' : 'Use the side arrows or ← → keys to visit all four worlds',
      hintSub: s.coarse ? 'Tap Enter, or the planet itself, to step inside one.' : 'Hover over a planet, then click Enter to step inside.',
      dismissHint: this.dismissHint,
      noticeOn: s.notice && s.view === 'detail' && !s.auth && !s.menu && !s.eventPop,
      noticeWorld: WORLDS[s.dIndex].name, noticeAccent: WORLDS[s.dIndex].accent,
      aboutVis: (s.about ? 'visible' : 'hidden') as 'visible' | 'hidden', aboutDelay: s.about ? '0s' : '.8s', aboutO: s.about ? 1 : 0, aboutX: s.about ? '0%' : '100%',
      aboutHidden: !s.about,
      openAbout: (e?: MouseEvent) => { if (e) e.preventDefault(); this.setState({ about: true, menu: false }); },
      closeAbout: () => this.setState({ about: false }),
      toTop: (e: MouseEvent) => { e.preventDefault(); const h = this.$('[data-view="home"]'); if (h) h.scrollTo({ top: 0, behavior: 'smooth' }); },
      toastO: s.toastOn ? 1 : 0, toastY: s.toastOn ? '0px' : '16px',
      register: this.register, hover: this.hover, prefetchAuth: this.prefetchAuth,
      openProfile: this.openProfile,
      ...this.accountVals(s),
      openAdmin: (e?: any) => {
        if (e) e.preventDefault();
        if (s.user?.id) this.refreshUserProfile(s.user.id);
        this.setState({ adminOpen: true, profileOpen: false });
      },
      isStaff: !!(s.user && (s.user.role === 'admin' || s.user.role === 'it-team' || s.user.role === 'registration-team' || s.user.role === 'viewer')),
      hasRegistered: !!(s.registration || this.pass),
      // A pending or confirmed registration without its college ID card: MY PASS asks for it (a dot on the button).
      idCardPending: !!s.registration && s.registration.status !== 'rejected' && 'id_card_path' in s.registration && !s.registration.id_card_path,
      openPass: () => this.openAuth('pass'),
      // @ts-ignore
      ...this.authVals(s),
      curtainLabel: s.curtainLabel, curtainKicker: s.curtainKicker,
      prevSlide: () => this.stepSlide(-1), nextSlide: () => this.stepSlide(1),
      onWheel: this.onWheel, onTouchStart: this.onTouchStart, onTouchEnd: this.onTouchEnd,
      // gallery page

      ...(() => {
        // The static archive, then any photos uploaded from the admin dashboard.
        const galleryList = [
          ...GALLERY,
          ...s.dbGallery.map((item, k) => {
            const i = GALLERY.length + k, t = item.title || `Memory ${i + 1}`;
            return { id: `gallery-db-${item.id || k}`, no: String(i + 1).padStart(2, '0'), title: t, titleU: t.toUpperCase(), imageUrl: item.image_url, ...gFrame(i % 3 === 1) };
          }),
        ];
        return {
          gallery: galleryList.map((g, k) => ({
            ...g,
            onFocus: () => {
              playClick();
              this.gTarget = k * GAP + 200;
            },
          })),
          gDust: Array.from({ length: 46 }, (_, k) => ({ s: (k % 3 === 0 ? 3 : 2) + 'px' })),
          gCur: galleryList[s.gIdx] || galleryList[0] || GALLERY[0],
          gTotal: String(galleryList.length).padStart(2, '0'),
        };
      })(),

      gRestart: () => { this.gTarget = 0; },
      gWheel: this.gWheel, gTouchStart: this.gTouchStart, gTouchMove: this.gTouchMove,
      ...this.schedVals(s),
    };
  }

  render() {
    const v = this.renderVals(), s = this.state;
    // The big views re-render only when what they show changes (the home page never does; its footer
    // reads the live values through LiveV). Small overlays render with every update.
    return (
      <div ref={this.rootRef} data-booting="" style={{ position: 'fixed', inset: '0', overflow: 'hidden', background: '#ECE8DF', color: '#141312', fontFamily: "var(--font-sans)" }}>
        {s.user && (s.auth || s.profileOpen) && <RegistrationStatusSync userId={s.user.id} onChange={this.syncRegistration} />}
        <LiveV value={v}>
        <HomeV v={v} deps={[]} />
        <WorldsV v={v} deps={[s.narrow, s.compact, s.dbEvents]} />
        {s.lazy.detail && <DetailV v={v} deps={[s.dIndex, s.compact, s.dbEvents]} />}
        {s.lazy.gallery && <GalleryV v={v} deps={[s.gIdx, s.dbGallery]} />}
        {s.lazy.schedule && <ScheduleV v={v} deps={[s.schedDay, s.schedFilter, s.saved, s.narrow]} />}
        <Hud v={v} />
        <WorldNav v={v} />
        <WorldHint v={v} />
        <DetailNotice v={v} />
        <Curtain v={v} />
        <AboutPanel v={v} />
        {s.lazy.menu && <MenuOverlay v={v} />}
        {s.lazy.auth && <AuthOverlay v={v} />}
        <ProfileOverlay
          isOpen={s.profileOpen}
          onClose={() => this.setState({ profileOpen: false })}
          user={s.user}
          registration={s.registration}
          onOpenPass={() => this.openAuth('pass')}
          onOpenRegister={() => this.openAuth('register')}
          onRegisterAgain={REGISTRATIONS_OPEN ? this.registerAgain : undefined}
          onOpenAdmin={() => this.setState({ adminOpen: true, profileOpen: false })}
          onLogout={this.logout}
          onUpdatePhone={this.handleUpdatePhone}
        />
        <EventPopup v={v} />
        <PhoneModal
          isOpen={s.phoneModalOpen}
          onSave={this.handleUpdatePhone}
          onClose={() => this.setState({ phoneModalOpen: false })}
          userEmail={s.user?.email}
        />
        <AmbassadorCodeDialog
          state={s.ambDialog}
          formUrl={AMBASSADOR_FORM_URL}
          onClose={() => this.setState({ ambDialog: null })}
          onRetry={this.checkAmbassadorCode}
          onCreate={this.createAmbassadorCode}
          onLogout={() => { this.setState({ ambDialog: null }); this.logout(); }}
        />
        {s.user && (s.user.role === 'admin' || s.user.role === 'it-team' || s.user.role === 'registration-team' || s.user.role === 'viewer') && (
          <AdminDashboard
            isOpen={s.adminOpen}
            onClose={() => this.setState({ adminOpen: false })}
            currentUser={s.user}
          />
        )}
        <Toast v={v} />
        <LoaderV v={v} deps={[]} />
        </LiveV>
      </div>
    );
  }
}


/** Innovision with the app router, so REGISTER / MERCH open their pages without reloading the site. */
export default function InnovisionApp(props: Omit<Props, 'router'>) {
  const router = useRouter();
  return <Innovision {...props} router={router} />;
}
