/* eslint-disable @typescript-eslint/ban-ts-comment -- GSAP class component uses @ts-ignore extensively for dynamic internal state */
/* eslint-disable @typescript-eslint/no-explicit-any -- view-model is dynamically constructed and consumed across many child views */
/* eslint-disable @typescript-eslint/no-unused-vars -- some destructured vars are kept for future use */
// @ts-nocheck
'use client';

import { Component, createRef, memo, type ComponentType, type FormEvent, type MouseEvent, type TouchEvent, type WheelEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import type { Howl } from 'howler';
import {
  A, WORLDS, PRELOAD, HERO_SPARKS, LOADER_SPARKS, STATUS, SCRAMBLE, GAP, GALLERY, G_MAX,
  LINKS, TUNNEL, TUNNEL_C, PRODUCTS, BRIEF, PILLS, SCHED, SCHED_DAYS, SPONSOR_TIERS, TITLE_SPONSOR, inr, type Product, type WorldKey,
} from './data';
import HomeView from './HomeView';
import WorldsView from './WorldsView';
import DetailView from './DetailView';
import GalleryView from './GalleryView';
import MerchView from './MerchView';
import ScheduleView from './ScheduleView';
import Hud from './Hud';
import WorldNav from './WorldNav';
import Curtain from './Curtain';
import AboutPanel from './AboutPanel';
import MenuOverlay from './MenuOverlay';
import AuthOverlay from './AuthOverlay';
import ProfileOverlay from './ProfileOverlay';
import PhoneModal from './PhoneModal';
import AdminDashboard from './AdminDashboard';
import BagPanel from './BagPanel';
import CartPill from './CartPill';
import Toast from './Toast';
import Cursor from './Cursor';
import WorldHint from './WorldHint';
import Loader from './Loader';
import { LiveV } from './SiteFooter';
import type { V } from './types';
import {
  getSupabase,
  getOrCreateUserProfile,
  updateUserProfile,
  fetchUserRegistration,
  createRegistration,
  signInWithGoogle,
  signOutUser,
  cleanAuthUrl,
  saveSessionToDatabase,
  fetchSessionFromDatabase,
  purgeLocalStorageTokens,
  type UserProfile,
  type Registration,
} from '@/lib/supabase';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

type PureProps = { v: V; deps: readonly unknown[] };
/**
 * Wraps a large view so it re-renders only when one of its deps changes. Every handler in v reads
 * live state, so a view keeping an older v stays correct; deps list the state its markup shows.
 */
const pure = (View: ComponentType<{ v: V }>) => memo(function Pure({ v }: PureProps) { return <View v={v} />; },
  (a, b) => a.deps.length === b.deps.length && a.deps.every((d, k) => Object.is(d, b.deps[k])));
const HomeV = pure(HomeView), WorldsV = pure(WorldsView), DetailV = pure(DetailView), GalleryV = pure(GalleryView), MerchV = pure(MerchView), ScheduleV = pure(ScheduleView), LoaderV = pure(Loader);

type ViewName = 'loading' | 'home' | 'worlds' | 'detail' | 'gallery' | 'merch' | 'schedule';
type Route = { view: Exclude<ViewName, 'loading'>; index: number; section?: string };
/** A bag line: product id, colour index (-1 if none), size ('' if none), quantity. */
type BagLine = { id: string; key: string; c: number; s: string; qty: number };
type Sel = { color?: number; size?: string };
type MusicKey = 'home' | WorldKey;
type Track = { h: Howl; vol: number; seek?: number; started?: boolean; waiting?: boolean };
type SlideParts = { hero: HTMLElement | null; rot: HTMLElement | null; astro: HTMLElement[]; link: HTMLElement[]; outline: HTMLElement | null; labels: HTMLElement[] };
type El = HTMLElement & { _tw?: gsap.core.Tween };
/** Schedule timeline parts; each node remembers whether it is lit. */
type SchedParts = { list: HTMLElement; rows: HTMLElement[]; nodes: (HTMLElement & { _on?: boolean })[]; fill: HTMLElement; rocket: HTMLElement };
type Attracted = HTMLElement & { _a: { x: number; y: number; tx: number; ty: number; s: number; on: boolean } };

interface Props {
  /** Minimum loader duration in seconds. */
  loaderSeconds?: number;
  startMuted?: boolean;
  skipLoader?: boolean;
  /** Google OAuth client ID for "Continue with Google" (defaults to NEXT_PUBLIC_GOOGLE_CLIENT_ID). */
  googleClientId?: string;
  /** Flagship rover stops to take a sample and look around (true) or drives a steady loop (false). */
  roverPauses?: boolean;
  /** Flagship rover driving speed multiplier (min .25). */
  roverSpeed?: number;
}

interface State {
  /** dIndex: world shown by the detail page; it only follows index when that page is prepared. */
  view: ViewName; index: number; dIndex: number; muted: boolean; about: boolean; compact: boolean; narrow: boolean;
  menu: boolean; toastOn: boolean; toastMsg: string; curtainLabel: string; curtainKicker: string;
  gIdx: number; sel: Record<string, Sel>; bag: BagLine[]; bagOpen: boolean; added: string | null;
  /** Schedule: selected day index, filter ('all' | 'saved' | world index as a string), starred event ids. */
  schedDay: number; schedFilter: string; saved: string[];
  /** The active page has scrolled under the HUD, which then sits on a frosted bar. */
  hudSolid: boolean;
  /** Continue with Google: popup in progress, the last problem to show, and the account it returned. */
  gBusy: boolean; gErr: string; gUser: { name: string; email: string } | null;
  /** First-visit guide on the worlds slider is showing; coarse: touch-first device (hint wording). */
  hint: boolean; coarse: boolean;
  /** Admin and profile modal states */
  adminOpen: boolean;
  profileOpen: boolean;
  phoneModalOpen: boolean;
  registration: Registration | null;
  user: UserProfile | null;
}

const BAG_KEY = 'innovisionCart';
const SAVED_KEY = 'iv26-schedule-saved';
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

export default class Innovision extends Component<Props, State> {
  rootRef = createRef<HTMLDivElement>();
  state: State = { view: 'loading', index: 0, dIndex: 0, muted: false, about: false, compact: false, narrow: false, menu: false, toastOn: false, toastMsg: '', curtainLabel: 'INNOVISION', curtainKicker: 'NOW ENTERING',
    auth: false, authMode: 'register', step: 0, err: {} as any, busyLbl: '', user: null, files: {} as any, drag: '', copied: false, gIdx: 0, sel: {}, bag: [], bagOpen: false, added: null, schedDay: 0, schedFilter: 'all', saved: [], hudSolid: false, gBusy: false, gErr: '', gUser: null, hint: false, coarse: false,
    adminOpen: false, profileOpen: false, phoneModalOpen: false, registration: null };
  busy = false; pending = false; slideDir = 0;
  authBusy = false; authClosing = false;
  _toast: any; _copy: any; reg: any; pass: any; _rEls: any; _rift: any; authO: any; _warpRaf: any; _warpTw: any; _stars: any;
  // flagship rover ticker; _rvReseq is set when roverPauses changes so the drive sequence is rebuilt
  _rvTick: ((time: number, dms: number) => void) | null = null; _rvReseq = false;
  // schedule timeline: measured list parts, pending scroll frame, day/filter swap in progress
  _sc: SchedParts | null = null; _scRaf = 0; _dayBusy = false;
  // new-visitor guidance: the worlds guide has been seen/dismissed, and its delayed appearance
  hintSeen = false; _hintT?: ReturnType<typeof setTimeout>;
  /** Home section to scroll to once the home view has been prepared. */
  pendingSec: string | null = null;

  // lifecycle bookkeeping
  private alive = false;
  private ctx?: gsap.Context;
  private cleanups: (() => void)[] = [];
  private _toast?: ReturnType<typeof setTimeout>;
  private _added?: ReturnType<typeof setTimeout>;

  // DOM helpers (set in boot)
  $: (s: string) => HTMLElement | null = () => null;
  $$: (s: string) => HTMLElement[] = () => [];
  reduce = false;

  // sound (Howler is fetched after boot: nothing can play before the first tap or key press)
  hw?: typeof import('howler');
  sfx?: Record<string, Howl>;
  music?: Record<MusicKey, Track>;
  unlocked = false; wanted?: MusicKey; curMusic?: MusicKey;

  // gallery page engine
  gEls: HTMLElement[] = []; dEls: HTMLElement[] = [];
  gZ = 0; gTarget = 0; gTy = 0; gDrawn = '';
  dust: { x: number; y: number; z: number }[] = [];
  gBar?: HTMLElement | null; gGlow?: HTMLElement | null; gEnd?: HTMLElement | null; gStars?: HTMLElement | null; gHint?: HTMLElement | null;

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
    let m = !!this.props.startMuted;
    try { const v = localStorage.getItem('innovisionMuted'); if (v !== null) m = v === 'true'; } catch {}
    let bag: BagLine[] = [];
    try { bag = JSON.parse(localStorage.getItem(BAG_KEY) || '[]') || []; } catch {}
    let saved: string[] = [];
    try { const sv = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); if (Array.isArray(sv)) saved = sv; } catch {}
    try { this.hintSeen = localStorage.getItem(HINT_KEY) === '1'; } catch {}
    this.setState({ muted: m, bag, saved, compact: innerWidth < 1100, narrow: innerWidth < 720, coarse: matchMedia('(pointer: coarse)').matches });
    // Resize work forces layout (title fit, map panels), so it runs at most once per frame.
    let rz = 0;
    this.listen(window, 'resize', () => {
      if (rz) return;
      rz = requestAnimationFrame(() => {
        rz = 0;
        const c = innerWidth < 1100, n = innerWidth < 720;
        if (c !== this.state.compact || n !== this.state.narrow) this.setState({ compact: c, narrow: n }, () => { if (this.state.view === 'detail') this.setupDetailScroll(true); });
        this.fitTitle();
        if (this.ctx) this.openMap(this.mapOpen);
        if (this.state.view === 'schedule') this.schedMeasure();
      });
    });
    this.cleanups.push(() => cancelAnimationFrame(rz));
    this.boot();
    this.initSupabaseAuth();
  }

  componentWillUnmount() {
    this.alive = false;
    clearTimeout(this._toast); clearTimeout(this._added); clearTimeout(this._hintT);
    cancelAnimationFrame(this._scRaf); this._scRaf = 0; this._sc = null; this._dayBusy = false;
    this.cleanups.splice(0).forEach((fn) => fn());
    this.io?.disconnect(); this.io = undefined; this.off.clear(); this.amb.clear();
    this.ctx?.revert();
    this.ctx = undefined;
    ScrollTrigger.getAll().forEach((t) => t.kill());
    gsap.globalTimeline.clear();
    this.hw?.Howler.unload();
    this.sfx = undefined; this.music = undefined;
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
      this.magnet();
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
      if (this.props.skipLoader) { this.hideLoader(); this.firstPaint(); return; }
      this.loaderIntro();
    }, R);
    if (!this.props.skipLoader) this.runLoader().then(() => { if (this.alive) this.loaderExit(); });

    // Auth Middleware Route Inspector: Check for middleware redirects (?auth=login, ?required=register, ?open=register, or #register)
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const isAuthRequired = search.get('required') === 'register' || search.get('auth') === 'login';
      const isOpenRegister = search.get('open') === 'register' || window.location.hash === '#register';

      if (isAuthRequired) {
        setTimeout(() => {
          this.openAuth('login');
          this.toast('🔒 Authentication required: Please log in or sign up before registering.');
        }, 1200);
      } else if (isOpenRegister) {
        setTimeout(() => {
          if (!this.state.user) {
            sessionStorage.setItem('inv_pending_action', 'register');
            this.openAuth('login');
            this.toast('🔒 Authentication required: Please log in or sign up before registering.');
          } else {
            this.openAuth('register');
          }
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
    // force3D keeps the line on its own layer, so the opacity half of the loop doesn't repaint the page behind it.
    this.$$('[data-hint-line]').forEach((el) => add(el, () => g.timeline({ repeat: -1 }).fromTo(el, { scaleY: 0, opacity: 1, transformOrigin: 'top' }, { scaleY: 1, duration: 1.1, ease: 'expo.out', force3D: true }).to(el, { opacity: 0, duration: .7 })));
    this.$$('[data-c-spark]').forEach((el) => add(el, () => g.to(el, { rotation: 360, duration: 6, ease: 'none', repeat: -1 })));
    this.waveLoop();
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
      const on = !this.off.has(el) && !el.closest('[data-idle]');
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
  }
  waveLoop() {
    const w = this.$('[data-wave]') as El | null;
    if (w && !w._tw) { w._tw = gsap.to(w, { scaleY: .35, transformOrigin: 'center', duration: 1.1, ease: 'sine.inOut', repeat: -1, yoyo: true }); }
  }
  componentDidUpdate(pp: Props) { if (this.ctx) this.waveLoop(); if (pp.roverPauses !== this.props.roverPauses) this._rvReseq = true; }

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
    gsap.ticker.add(tick);
    this.cleanups.push(() => { gsap.ticker.remove(tick); this._rvTick = null; });
  }

  /* ---------- sound ---------- */
  sound() {
    this.unlocked = false;
    const un = () => { if (this.unlocked) return; this.unlocked = true; if (this.wanted) this.playMusic(this.wanted, true); };
    ['pointerdown', 'keydown'].forEach((ev) => this.listen(window, ev, un, { once: true, capture: true }));
    this.listen(document, 'visibilitychange', () => this.hw?.Howler.mute(this.state.muted || document.hidden));
    // Howler (36 kB) loads as its own chunk after hydration instead of with the critical bundle.
    import('howler').then((hw) => {
      if (!this.alive) return;
      const { Howl, Howler } = hw;
      this.hw = hw;
      const html5 = location.protocol === 'file:';
      const h = (f: string, v: number, o: Partial<ConstructorParameters<typeof Howl>[0]> = {}) => new Howl(Object.assign({ src: [A + f], volume: v, html5 }, o));
      this.sfx = { beep: h('beep.mp3', .05), swoosh: h('swoosh.mp3', .5), thump: h('thump.mp3', .6), thumpSoft: h('thump.mp3', .2), vanish: h('vanish.mp3', .2), fx: h('splash-fx.mp3', .4) };
      // The songs (~7 MB) stream when first needed (playMusic) instead of competing with the loader's images.
      const song = (f: string) => h(f, 0, { loop: true, html5: true, preload: false });
      this.music = {
        home: { h: song('splash.mp3'), vol: .6 },
        takeoff: { h: song('song-takeoff.mp3'), vol: .7 },
        touchdown: { h: song('song-touchdown.mp3'), vol: .9, seek: 4 },
        highpoint: { h: song('song-highpoint.mp3'), vol: .5 },
      };
      Howler.mute(this.state.muted);
      // A track asked for (or an unlock) before Howler arrived starts now.
      if (this.wanted) this.playMusic(this.wanted, true);
    });
  }
  play(n: string) { if (this.unlocked && this.sfx && this.sfx[n]) this.sfx[n].play(); }
  playMusic(key: MusicKey, force?: boolean) {
    this.wanted = key;
    const m = this.music?.[key];
    if (m && m.h.state() === 'unloaded') m.h.load();
    if (!this.unlocked || !this.music || !m || (!force && this.curMusic === key)) return;
    const music = this.music;
    (Object.keys(music) as MusicKey[]).forEach((k) => {
      if (k === key) return;
      const o = music[k].h;
      if (o.playing()) { o.fade(o.volume(), 0, 900); o.once('fade', () => { if (this.curMusic !== k) o.pause(); }); }
    });
    this.curMusic = key;
    // Still buffering: start once it can play, unless another track has been asked for by then.
    if (m.h.state() !== 'loaded') {
      if (!m.waiting) { m.waiting = true; m.h.once('load', () => { m.waiting = false; if (this.curMusic === key) this.playMusic(key, true); }); }
      return;
    }
    if (!m.h.playing()) { if (m.seek && !m.started) m.h.seek(m.seek); m.started = true; m.h.play(); }
    m.h.fade(m.h.volume(), m.vol, 1400);
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
  runLoader() {
    return new Promise<void>((res) => {
      let loaded = 0, shown = 0, last = 0;
      const N = PRELOAD.length;
      PRELOAD.forEach((f) => { const im = new Image(); im.onload = im.onerror = () => { loaded++; }; im.src = A + f; });
      const minMs = (this.props.loaderSeconds ?? 2.8) * 1000;
      const t0 = performance.now();
      const cap9 = setTimeout(() => { loaded = N; }, 9000);
      const cnt = this.$('[data-l-count]')!, prog = this.$('[data-l-progress]')!;
      // The three planets swing in from their start angles and lock onto one line as loading
      // progresses; the dotted link follows them and each locked world lights up below.
      const R = [24, 36, 50], T = [.34, .67, 1], link = this.$('[data-l-link]'), wl = this.$$('[data-l-world]');
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
            if (wl[b.i]) gsap.to(wl[b.i], { opacity: 1, color: '#8a6a2a', duration: .4 });
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
    const to = this.parse();
    this.setStatus('ORBITS ALIGNED');
    g.fromTo(this.$('[data-l-flare]'), { scale: .9, autoAlpha: 1 }, { scale: 2.6, autoAlpha: 0, duration: 1.3, ease: 'expo.out' });
    g.fromTo(this.$('[data-l-link]'), { attr: { 'stroke-width': .45 } }, { attr: { 'stroke-width': 1.4 }, duration: .25, yoyo: true, repeat: 1 });
    await new Promise((r) => setTimeout(r, 380));
    if (!this.alive) return;
    if (to.view !== 'home') {
      await this.prepView(to);
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
    g.set(target, { autoAlpha: 0 });
    const he = this.homeEnter().pause(0);
    const a = disc.getBoundingClientRect(), b = target.getBoundingClientRect();
    g.timeline()
      .to(this.$$('[data-l-fade]'), { autoAlpha: 0, duration: .5, ease: 'power2.in' }, 0)
      .to(this.$$('[data-l-ring]'), { scale: 2.4, autoAlpha: 0, duration: 1.4, ease: 'power3.in', stagger: .06 }, 0)
      .to(disc, { x: (b.left + b.width / 2) - (a.left + a.width / 2), y: (b.top + b.height / 2) - (a.top + a.height / 2), scale: b.width / a.width, duration: 1.6, ease: 'expo.inOut' }, .35)
      .to(this.$('[data-loader-bg]'), { autoAlpha: 0, duration: 1, ease: 'power2.inOut' }, .95)
      .add(() => { this.play('fx'); this.playMusic('home'); he.play(); }, 1.25)
      .add(() => { g.set(target, { autoAlpha: 1 }); this.hideLoader(); }, 1.96);
  }
  async firstPaint() {
    const to = this.parse();
    await this.prepView(to);
    this.enterView(to);
    gsap.to(this.$$('[data-hud]'), { autoAlpha: 1, duration: .6 });
  }
  async prepView(to: Route) {
    if (to.view === 'home') { gsap.set(this.$('[data-hero-disc]'), { autoAlpha: 1, scale: 1 }); this.$('[data-view="home"]')!.scrollTop = 0; }
    else if (to.view === 'merch') this.$('[data-view="merch"]')!.scrollTop = 0;
    else if (to.view === 'schedule') this.$('[data-view="schedule"]')!.scrollTop = 0;
    else if (to.view === 'gallery') { this.gZ = -2600; this.gTarget = -2600; }
    else { await this.setSlide(to.index); if (to.view === 'detail') await this.prepDetail(to.index); }
    await this.showView(to.view);
  }
  enterView(to: Route): gsap.core.Timeline {
    if (to.view === 'home') { this.playMusic('home'); return this.homeEnter(); }
    if (to.view === 'gallery') { this.playMusic('touchdown'); return this.galleryEnter(); }
    if (to.view === 'schedule') { this.playMusic('home'); return this.schedEnter(); }
    if (to.view === 'merch') { this.playMusic('home'); return gsap.timeline().fromTo(this.$$('[data-view="merch"] [data-m-reveal]'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .06 }, .1); }
    this.playMusic(WORLDS[to.index].music);
    if (to.view === 'worlds') this.queueHint();
    return to.view === 'detail' ? this.detailEnter() : this.worldsEnter(to.index);
  }

  /* ---------- gallery page ---------- */
  galleryInit() {
    this.gEls = this.$$('[data-g-item]');
    this.dEls = this.$$('[data-g-dust]');
    this.gZ = 0; this.gTarget = 0;
    this.dust = this.dEls.map((_, k) => ({ x: (((k * 73) % 100) / 100 - .5) * 1.6, y: (((k * 41) % 100) / 100 - .5) * 1.4, z: (k * 997) % 6000 }));
    this.gBar = this.$('[data-g-bar]'); this.gGlow = this.$('[data-g-glow]'); this.gEnd = this.$('[data-g-end]'); this.gStars = this.$('[data-g-stars]'); this.gHint = this.$('[data-g-hint]');
    const tick = () => this.galleryTick();
    gsap.ticker.add(tick);
    this.cleanups.push(() => gsap.ticker.remove(tick));
  }
  galleryTick() {
    if (this.state.view !== 'gallery' || !this.gEls.length) return;
    const dz = this.gTarget - this.gZ;
    this.gZ = Math.abs(dz) < .05 ? this.gTarget : this.gZ + dz * .07;
    const W = innerWidth, H = innerHeight, RX = Math.min(W * .3, 520), RY = Math.min(H * .25, 250);
    // Once the camera has settled the frame is identical to the last one, so skip the 58 style writes.
    const key = this.gZ + '|' + W + '|' + H;
    if (key === this.gDrawn) return;
    this.gDrawn = key;
    this.gEls.forEach((el, i) => {
      const a = i * 2.4 + .7, x = Math.cos(a) * RX, y = Math.sin(a) * RY, z = -i * GAP + this.gZ;
      const o = z < -6200 ? 0 : z < -4000 ? (z + 6200) / 2200 : z < 300 ? 1 : Math.max(0, 1 - (z - 300) / 500);
      el.style.transform = 'translate(-50%,-50%) translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + (-x / RX * 12).toFixed(2) + 'deg)';
      el.style.opacity = o.toFixed(3);
      const vis = o < .01 ? 'hidden' : 'visible', pe = o > .6 ? 'auto' : 'none';
      if (el.style.visibility !== vis) el.style.visibility = vis;
      if (el.style.pointerEvents !== pe) el.style.pointerEvents = pe;
    });
    this.dEls.forEach((el, k) => {
      const d = this.dust[k], z = ((d.z + this.gZ * 1.2) % 6000 + 6000) % 6000 - 5200;
      el.style.transform = 'translate3d(' + (d.x * W).toFixed(1) + 'px,' + (d.y * H).toFixed(1) + 'px,' + z.toFixed(1) + 'px)';
      el.style.opacity = z > 500 ? '0' : Math.min(.9, Math.max(0, (z + 5200) / 2000)).toFixed(3);
    });
    const p = Math.max(0, Math.min(1, this.gZ / G_MAX));
    this.gBar!.style.transform = 'scaleY(' + p.toFixed(4) + ')';
    this.gGlow!.style.transform = 'scale(' + (1 + Math.pow(p, 3) * 14).toFixed(3) + ')';
    this.gGlow!.style.opacity = p.toFixed(3);
    this.gStars!.style.transform = 'scale(' + (1 + p * .25).toFixed(4) + ')';
    const end = p > .94;
    this.gEnd!.style.opacity = end ? '1' : '0';
    this.gEnd!.style.pointerEvents = end ? 'auto' : 'none';
    this.gHint!.style.opacity = this.gTarget > 300 ? '0' : '1';
    const idx = Math.max(0, Math.min(GALLERY.length - 1, Math.round((this.gZ - 200) / GAP)));
    if (idx !== this.state.gIdx) this.setState({ gIdx: idx });
  }
  galleryEnter() {
    return gsap.timeline()
      .call(() => { this.gZ = -2600; this.gTarget = 0; }, undefined, .01)
      .fromTo(this.$$('[data-g-ui]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .1 }, .4)
      .to(this.$$('[data-hud]'), { autoAlpha: 1, duration: .8 }, .2);
  }
  gStep(d: number) { const i = Math.max(0, Math.min(GALLERY.length - 1, Math.round((this.gTarget - 200) / GAP) + d)); this.gTarget = i * GAP + 200; }
  gWheel = (e: WheelEvent) => { this.gTarget = Math.max(0, Math.min(G_MAX, this.gTarget + (e.deltaY + e.deltaX) * 1.6)); };
  gTouchStart = (e: TouchEvent) => { this.gTy = e.touches[0].clientY; };
  gTouchMove = (e: TouchEvent) => { const y = e.touches[0].clientY; this.gTarget = Math.max(0, Math.min(G_MAX, this.gTarget + (this.gTy - y) * 4)); this.gTy = y; };

  /* ---------- store / bag ---------- */
  toast(msg: string) {
    this.setState({ toastOn: true, toastMsg: msg });
    clearTimeout(this._toast);
    this._toast = setTimeout(() => this.setState({ toastOn: false }), 3200);
  }
  saveBag(bag: BagLine[]) { try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch {} }
  setBag(bag: BagLine[]) { this.setState({ bag }); this.saveBag(bag); }
  pick(id: string, patch: Sel) { this.play('beep'); this.setState((st) => ({ sel: { ...st.sel, [id]: { ...(st.sel[id] || {}), ...patch } } })); }
  addToCart(p: Product, size: string | null, color: number) {
    this.play('thumpSoft');
    const c = p.colors ? color : -1, s = size || '', id = p.id + '|' + c + '|' + s;
    const bag = this.state.bag.map((l) => ({ ...l })), f = bag.find((l) => l.id === id);
    if (f) f.qty += 1; else bag.push({ id, key: p.id, c, s, qty: 1 });
    this.setBag(bag);
    this.setState({ added: p.id });
    clearTimeout(this._added);
    this._added = setTimeout(() => this.setState({ added: null }), 1400);
  }
  setQty(id: string, d: number) { this.setBag(this.state.bag.map((l) => (l.id === id ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0)); }

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
      .fromTo($('[data-h-scroll]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1.4)
      .to($$('[data-hud]'), { autoAlpha: 1, duration: 1 }, .8);
  }
  homeLeave() {
    const g = gsap, $ = this.$, $$ = this.$$;
    return g.timeline()
      .to($$('[data-h-ch]'), { yPercent: -60, autoAlpha: 0, duration: .8, ease: 'power3.in', stagger: .03 }, 0)
      .to([...$$('[data-h-kicker]'), ...$$('[data-h-sub]'), ...$$('[data-h-cta]'), $('[data-h-scroll]')], { autoAlpha: 0, y: -20, duration: .5, ease: 'power2.in' }, 0)
      .to($('[data-hero-disc]'), { scale: 1.3, duration: 1.8, ease: 'power3.in' }, 0)
      .to($('[data-h-astro]'), { x: 220, y: -220, rotation: 30, autoAlpha: 0, duration: 1.6, ease: 'power3.in' }, 0)
      .to($('[data-h-planet]'), { yPercent: 40, duration: 1.6, ease: 'power3.in' }, 0)
      .to($$('[data-h-ring]'), { scale: 1.3, autoAlpha: 0, duration: 1.6, ease: 'power3.in', stagger: .05 }, 0);
  }
  homeScroll() {
    const sc = this.$('[data-view="home"]');
    gsap.timeline({ scrollTrigger: { trigger: this.$('[data-hero-wrap]'), scroller: sc, start: 'top top', end: 'bottom top', scrub: true } })
      .fromTo(this.$('[data-h-par]'), { scale: 1, yPercent: 0 }, { scale: .93, yPercent: 6, ease: 'none' }, 0)
      .fromTo(this.$('[data-h-dim]'), { opacity: 0 }, { opacity: .3, ease: 'none' }, 0)
      .to(this.$('[data-h-scroll]'), { autoAlpha: 0, duration: .15, ease: 'none' }, 0);
    const tun = this.$('[data-tunnel]');
    if (tun) {
      const fr = this.$$('[data-t-frame]'), N = fr.length, TGAP = 1000, cnt = this.$('[data-t-count]');
      fr.forEach((f, i) => { f.style.zIndex = String(N - i); });
      // Only write what changed: replacing the counter's text every scroll update invalidates layout.
      const upd = (p: number) => {
        const travel = p * (N * TGAP - 200);
        fr.forEach((f, i) => {
          const z = -(i + 1) * TGAP + travel + 300;
          const o = String(z > 250 ? Math.max(0, 1 - (z - 250) / 450) : z < -TGAP * 3 ? Math.max(0, 1 - (-TGAP * 3 - z) / TGAP) : 1), pe = +o > .6 ? 'auto' : 'none';
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
    const ls = this.$('[data-launch-sec]');
    if (ls) {
      gsap.fromTo(this.$('[data-launch]'), { y: innerHeight * .3 }, { y: -innerHeight * 1.15, ease: 'power2.in', scrollTrigger: { trigger: ls, scroller: sc, start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.fromTo(ls, { y: 0 }, { y: innerHeight * 0.4, ease: 'none', scrollTrigger: { trigger: ls, scroller: sc, start: 'bottom bottom', end: '+=40%', scrub: true } });
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
    this.hudSync();
  }
  /** Puts the HUD on its frosted bar once the active view's page has scrolled under it. */
  hudSync() {
    const v = this.state.view;
    const sc = v === 'detail' ? this.$('[data-d-scroller]') : v === 'home' || v === 'merch' || v === 'schedule' ? this.$('[data-view="' + v + '"]') : null;
    const solid = !!sc && sc.scrollTop > 24;
    if (solid !== this.state.hudSolid) this.setState({ hudSolid: solid });
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
    this.play('swoosh'); this.play('thumpSoft');
    this.playMusic(WORLDS[to].music);
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
    await this.set({ index: i, dIndex: i });
    this.setupDetailScroll();
  }
  setupDetailScroll(keep?: boolean) {
    const g = gsap, root = this.$('[data-view="detail"]')!, sc = this.$('[data-d-scroller]')!;
    this.dTriggers.forEach((t) => t && t.kill());
    if (this.dtl) { if (this.dtl.scrollTrigger) this.dtl.scrollTrigger.kill(); this.dtl.kill(); }
    if (!keep) sc.scrollTop = 0;
    const q = (s: string) => [...root.querySelectorAll<HTMLElement>(s)];
    g.set(q('[data-speed],[data-d-titleblock],[data-d-hint],[data-d-word],[data-d-intro],[data-d-spec],[data-d-fade],[data-d-card]'), { clearProps: 'transform,opacity,visibility,filter' });
    const H = () => innerHeight;
    // smoothWheel already eases the scroll itself, so the scene follows it directly: a trailing scrub
    // drifted out of step with the page, most visibly where the sticky scene hands over to the manifest.
    const tl = g.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root.querySelector('[data-d-track]'), scroller: sc, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    q('[data-speed]').forEach((el) => { const sp = parseFloat(el.dataset.speed || '') || 0; tl.to(el, { y: () => H() * sp * 2, duration: 1 }, 0); });
    q('[data-thrust]').forEach((el) => tl.fromTo(el, { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: 0.15 }, 0));
    q('[data-lander]').forEach((el) => tl.to(el, { y: () => -H() * 0.25, duration: 0.35, ease: 'power1.out' }, 0));
    tl.to(root.querySelector('[data-d-titleblock]'), { scale: 1.25, autoAlpha: 0, y: () => -H() * .08, duration: .3 }, 0)
      .to(root.querySelector('[data-d-hint]'), { autoAlpha: 0, duration: .08 }, 0);
    // One tween per word (equivalent to stagger: .03): with GSAP 3.13+, a staggered fromTo inside a
    // scrubbed timeline that is invalidated on refresh reverts not-yet-started targets to visible.
    q('[data-d-word]').forEach((el, k) => tl.fromTo(el, { autoAlpha: 0, y: 40, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .12 }, .24 + k * .03));
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
    gsap.ticker.add(tick, false, true);
    this.cleanups.push(() => gsap.ticker.remove(tick));
  }
  detailEnter() {
    const root = this.$('[data-view="detail"]')!;
    return gsap.timeline()
      .fromTo(root.querySelectorAll('[data-d-ch]'), { yPercent: 70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.4, ease: 'expo.out', stagger: .05 }, .1)
      .fromTo(root.querySelector('[data-d-stats]'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out' }, .5)
      .fromTo(root.querySelectorAll('[data-speed] > img, [data-speed] > div'), { scale: 1.08 }, { scale: 1, duration: 2.4, ease: 'expo.out' }, 0)
      .fromTo(root.querySelector('[data-d-hint]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1);
  }
  fitTitle() {
    const el = this.$('[data-d-title]');
    if (!el) return;
    el.style.fontSize = 'clamp(56px, 13vw, 250px)';
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
    return gsap.timeline({ onStart: () => this.schedMeasure() })
      .fromTo(v.querySelectorAll('[data-sc-reveal]'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .08 }, 0)
      .fromTo(v.querySelectorAll('[data-sc-tab]'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .08 }, .2)
      .fromTo(v.querySelector('[data-sc-planet]'), { scale: .8, rotation: -12, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 2, ease: 'expo.out' }, 0)
      .fromTo(v.querySelectorAll('[data-sc-row]'), { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .05 }, .35);
  }
  /** Fades the list out, applies a day/filter change, then slides the new list in (dir: -1, 0 or 1). */
  schedSwap(patch: Partial<State>, dir: number) {
    if (this._dayBusy) return;
    this._dayBusy = true;
    this.play('thumpSoft');
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
    (this._sc?.nodes || []).forEach((n) => { n._on = false; });
    this.schedMeasure();
    if (this.reduce) { gsap.set([title, ...rows], { autoAlpha: 1, x: 0, y: 0 }); return; }
    gsap.fromTo(title, { autoAlpha: 0, x: 40 * dir, y: dir ? 0 : 16 }, { autoAlpha: 1, x: 0, y: 0, duration: .8, ease: 'expo.out' });
    gsap.fromTo(rows, { autoAlpha: 0, x: 52 * dir, y: dir ? 0 : 24 }, { autoAlpha: 1, x: 0, y: 0, duration: .85, ease: 'expo.out', stagger: .04, delay: .05 });
  }
  pickDay(k: number) { const d = this.state.schedDay; if (k !== d) this.schedSwap({ schedDay: k }, k > d ? 1 : -1); }
  pickFilter(f: string) { if (f !== this.state.schedFilter) this.schedSwap({ schedFilter: f }, 0); }
  toggleSave(id: string, e?: MouseEvent<HTMLButtonElement>) {
    const on = this.state.saved.includes(id), saved = on ? this.state.saved.filter((x) => x !== id) : [...this.state.saved, id];
    this.play(on ? 'beep' : 'thumpSoft');
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch {}
    const svg = e?.currentTarget?.querySelector('svg');
    if (svg && !this.reduce) gsap.fromTo(svg, { scale: on ? .8 : .4, rotation: on ? 0 : -72 }, { scale: 1, rotation: 0, duration: .7, ease: 'elastic.out(1,.45)' });
    this.setState({ saved }, () => { if (this.state.schedFilter === 'saved') this.schedMeasure(); });
  }
  schedMeasure() {
    const list = this.$('[data-sc-list]'); if (!list) return;
    this._sc = { list, rows: this.$$('[data-sc-list] article[data-sc-row]'), nodes: this.$$('[data-sc-node]'), fill: this.$('[data-sc-fill]'), rocket: this.$('[data-sc-rocket]') };
    this.schedPaint();
  }
  schedScroll = () => { if (this._scRaf) return; this._scRaf = requestAnimationFrame(() => { this._scRaf = 0; this.schedPaint(); }); };
  /** Fills the timeline and moves the rocket down to the reading line (62% of the viewport); passed nodes light up. */
  schedPaint() {
    const S = this._sc; if (!S || !S.list.isConnected) return;
    const r = S.list.getBoundingClientRect(), H = Math.max(1, r.height), y = Math.max(0, Math.min(H, innerHeight * .62 - r.top));
    S.fill.style.transform = 'scaleY(' + (y / H).toFixed(4) + ')';
    S.rocket.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
    S.rocket.style.opacity = y > 2 && y < H - 2 ? '1' : '0';
    S.rows.forEach((row, i) => {
      const n = S.nodes[i]; if (!n) return;
      const on = row.offsetTop + 30 <= y;
      if (n._on === on) return;
      n._on = on;
      if (this.reduce) { n.style.background = on ? 'oklch(0.8 0.12 85)' : '#ECE8DF'; return; }
      gsap.to(n, { backgroundColor: on ? 'oklch(0.8 0.12 85)' : '#ECE8DF', scale: on ? 1.3 : 1, duration: on ? .55 : .3, ease: on ? 'back.out(3)' : 'power2.out' });
    });
  }
  schedVals(s: State) {
    const day = s.schedDay, f = s.schedFilter, list = SCHED[day].map((e, i) => ({ e, id: 'd' + (day + 1) + '-' + i }));
    const rows = list.filter(({ e, id }) => f === 'all' || (f === 'saved' ? s.saved.includes(id) : e[3] === +f));
    const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); return [(h % 12 || 12) + ':' + String(m).padStart(2, '0'), h < 12 ? 'AM' : 'PM']; };
    const dur = (m: number) => m >= 600 ? Math.round(m / 60) + ' HRS' : m >= 120 && m % 60 === 0 ? m / 60 + ' HRS' : m + ' MIN';
    const names = ['FLAGSHIP', 'MAIN', 'DTS & FUN'];
    const nar = s.narrow;
    const chips = [['all', 'All', ''], ['0', 'Flagship', WORLDS[0].accent], ['1', 'Main', WORLDS[1].accent], ['2', 'DTS & Fun', WORLDS[2].accent], ['saved', 'Starred', '']].map(([k, label, dot]) => {
      const n = k === 'all' ? list.length : k === 'saved' ? list.filter((x) => s.saved.includes(x.id)).length : list.filter((x) => x.e[3] === +k).length, on = f === k;
      return { label, n: String(n), on, bg: on ? '#141312' : 'transparent', fg: on ? '#ECE8DF' : '#141312', dot: dot || 'transparent', dotD: dot ? 'block' : 'none', pick: () => this.pickFilter(k) };
    });
    return {
      schedScroll: this.schedScroll,
      schedDays: SCHED_DAYS.map(([theme, img], k) => {
        const on = k === day;
        return {
          no: 'DAY ' + String(k + 1).padStart(2, '0'), theme, img: A + img, meta: nar ? SCHED[k].length + ' events' : SCHED[k].length + ' events · from ' + fmt(SCHED[k][0][0]).join(' '),
          sel: on, o: on ? 1 : .55, ps: on ? 1.12 : .86, pr: on ? '-14deg' : '0deg', bar: on ? 1 : 0, barO: k > day ? 'left' : 'right', sep: k ? 'rgba(236,232,223,.18)' : 'transparent', imgD: nar ? 'none' : 'block',
          pick: () => this.pickDay(k),
        };
      }),
      schedKicker: 'DAY ' + String(day + 1).padStart(2, '0') + ' · ' + rows.length + (rows.length === 1 ? ' EVENT' : ' EVENTS'),
      schedHeading: SCHED_DAYS[day][0],
      schedDayName: 'Day ' + (day + 1),
      schedChips: chips,
      schedEmpty: !rows.length,
      schedRows: rows.map(({ e, id }) => {
        const [t, ap] = fmt(e[0]), on = s.saved.includes(id);
        return { id, t, ap, dur: dur(e[1]), title: e[2], wn: names[e[3]], wc: WORLDS[e[3]].accent, venue: e[4], on, star: on ? 'oklch(0.8 0.12 85)' : 'transparent', aria: (on ? 'Remove ' : 'Star ') + e[2], toggle: (ev: MouseEvent<HTMLButtonElement>) => this.toggleSave(id, ev) };
      }),
      rowCols: nar ? '78px 26px minmax(0,1fr) 44px' : '132px 40px minmax(0,1fr) minmax(0,280px) 56px',
      lineL: nar ? '91px' : '152px',
      timeFs: nar ? '19px' : 'clamp(26px,2.4vw,34px)',
      venueColD: nar ? 'none' : 'flex', venueInD: nar ? 'flex' : 'none',
    };
  }

  /* ---------- curtain ---------- */
  async curtain(kicker: string, label: string, { delay = 0, covered, reveal }: { delay?: number; covered?: () => Promise<void> | void; reveal?: () => void } = {}) {
    await this.set({ curtainKicker: kicker, curtainLabel: label });
    const g = gsap, L = this.$$('[data-c-layer]'), c = this.$('[data-curtain]');
    return new Promise<void>((resolve) => {
      g.set(c, { pointerEvents: 'auto' });
      g.set(L, { y: 0, yPercent: 100 / 3 });
      c?.removeAttribute('data-idle'); this.syncLoops();
      const tl = g.timeline({ delay, onComplete: () => { g.set(c, { pointerEvents: 'none' }); c?.setAttribute('data-idle', ''); this.syncLoops(); resolve(); } });
      tl.to(L, { yPercent: -100 / 3, duration: 1.3, ease: 'power3.inOut', stagger: .09 })
        .add(() => {
          this.play('thump');
          tl.pause();
          Promise.resolve(covered && covered()).then(() => requestAnimationFrame(() => tl.resume()));
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
    if (v === 'gallery' || v === 'merch' || v === 'schedule') return { view: v, index: idx };
    if (v === 'sponsors') return { view: 'home', section: 'sponsors', index: idx };
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
    if (s.about || s.menu || s.bagOpen) this.setState({ about: false, menu: false, bagOpen: false });
    if (to.view === s.view && to.view === 'home') { if (to.section) this.scrollHome(to.section, true); return; }
    if (to.view === s.view && to.view === 'gallery') { this.gTarget = 0; return; }
    if (to.view === s.view && (to.view === 'merch' || to.view === 'schedule' || to.index === s.index)) return;
    this.busy = true;
    try { await this.transition(to); } finally { this.busy = false; this.slideDir = 0; }
    if (this.pending) { this.pending = false; this.route(); }
  }
  async transition(to: Route) {
    const from = this.state.view, w = WORLDS[to.index];
    if (to.view === 'detail') this.dismissHint();
    if (to.view === 'home') {
      this.play('vanish');
      if (to.section) this.pendingSec = to.section;
      let he: gsap.core.Timeline | undefined;
      await this.curtain('RETURNING TO', 'INNOVISION', {
        covered: async () => { await this.prepView(to); if (this.pendingSec) { this.scrollHome(this.pendingSec); this.pendingSec = null; } he = this.homeEnter().pause(0); },
        reveal: () => { this.playMusic('home'); if (he) he.play(); },
      });
      return;
    }
    if (to.view === 'worlds' && from === 'worlds') {
      await this.slideTo(to.index, this.slideDir || (to.index > this.state.index ? 1 : -1));
      return;
    }
    const label = to.view === 'worlds' ? 'THE WORLDS' : to.view === 'merch' ? 'THE STORE' : to.view === 'gallery' ? 'THE GALLERY' : to.view === 'schedule' ? 'THE SCHEDULE' : w.name.toUpperCase();
    if (from === 'home') this.homeLeave(); else this.play('vanish');
    let tlIn: gsap.core.Timeline | undefined;
    await this.curtain('NOW ENTERING', label, {
      delay: from === 'home' ? .55 : 0,
      covered: async () => { await this.prepView(to); tlIn = this.enterView(to); tlIn.pause(0); },
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
    this.go('#/worlds/' + WORLDS[(this.state.index + d + 3) % 3].slug, true);
  }
  navTo(k: number) {
    const key = WORLDS[k].slug;
    if (this.state.view === 'detail') this.go('#/world/' + key);
    else { if (k !== this.state.index) this.slideDir = k > this.state.index ? 1 : -1; this.go('#/worlds/' + key, this.state.view === 'worlds'); }
  }
  onKey(e: KeyboardEvent) {
    const s = this.state;
    if (e.key === 'Escape' && (s.about || s.menu || s.bagOpen)) { this.setState({ about: false, menu: false, bagOpen: false }); return; }
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
  /** Custom cursor ring/dot plus magnetic pull on [data-magnet] links (home page and HUD). */
  magnet() {
    if (matchMedia('(pointer: coarse)').matches) return;
    const g = gsap, ring = this.$('[data-cursor]')!, dot = this.$('[data-cursor-dot]')!;
    const rx = g.quickTo(ring, 'x', { duration: .45, ease: 'power3' }), ry = g.quickTo(ring, 'y', { duration: .45, ease: 'power3' });
    const dx = g.quickTo(dot, 'x', { duration: .1, ease: 'power3' }), dy = g.quickTo(dot, 'y', { duration: .1, ease: 'power3' });
    const els = this.$$('[data-view="home"] [data-magnet], [data-hud] [data-magnet]');
    let active: HTMLElement | null = null, shown = false;
    const release = () => { if (active) { g.to(active, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)' }); active = null; g.to(ring, { scale: 1, duration: .5, ease: 'expo.out' }); } };
    const move = (ev: Event) => {
      const e = ev as globalThis.MouseEvent;
      const home = this.state.view === 'home', x = e.clientX, y = e.clientY;
      if (home !== shown) { shown = home; g.to([ring, dot], { autoAlpha: home ? 1 : 0, duration: .4 }); }
      dx(x); dy(y);
      if (!home) { release(); rx(x); ry(y); return; }
      let hit: { el: HTMLElement; cx: number; cy: number; ox: number; oy: number } | null = null;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const cx = r.left + r.width / 2 - (Number(g.getProperty(el, 'x')) || 0), cy = r.top + r.height / 2 - (Number(g.getProperty(el, 'y')) || 0);
        const ox = x - cx, oy = y - cy;
        if (Math.abs(ox) < r.width / 2 + 40 && Math.abs(oy) < r.height / 2 + 40) { hit = { el, cx, cy, ox, oy }; break; }
      }
      if (active && (!hit || hit.el !== active)) release();
      if (hit) {
        if (!active) g.to(ring, { scale: 1.9, duration: .5, ease: 'expo.out' });
        active = hit.el;
        g.to(hit.el, { x: hit.ox * .3, y: hit.oy * .4, duration: .6, ease: 'power3.out', overwrite: 'auto' });
        rx(hit.cx + hit.ox * .5); ry(hit.cy + hit.oy * .5);
      } else { rx(x); ry(y); }
    };
    const out = () => { release(); shown = false; g.to([ring, dot], { autoAlpha: 0, duration: .3 }); };
    this.listen(window, 'mousemove', move, { passive: true });
    this.listen(document.documentElement, 'mouseleave', out);
  }
  /** Elements marked [data-attract] on the home page drift toward the cursor when it is near. */
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
    gsap.ticker.add(tick);
    this.cleanups.push(() => { gsap.ticker.remove(tick); els.forEach((el) => { el.style.translate = ''; }); });
  }
  refreshParallax() {
    const v = this.$('[data-view="' + this.state.view + '"]');
    this.pEls = v ? [...v.querySelectorAll<HTMLElement>('[data-depth]')].filter((el) => { const s = el.closest<HTMLElement>('[data-slide]'); return !s || +(s.dataset.slide || 0) === this.state.index; }) : [];
  }
  hover = (e: MouseEvent<HTMLElement>) => {
    this.play('beep');
    if (this.reduce || !this.ctx) return;
    const sp = e.currentTarget.querySelector<HTMLElement>('[data-scr]');
    if (!sp) return;
    sp.dataset.text = sp.dataset.text || sp.textContent || '';
    gsap.to(sp, { duration: .5, scrambleText: { text: sp.dataset.text, chars: SCRAMBLE, speed: .6 }, overwrite: true });
  };
  beep = () => this.play('beep');
  /* ---------- auth: register / login ---------- */
  RN = 22;
  // @ts-ignore
  register = (e) => { 
    if (e && e.preventDefault) e.preventDefault();
    if (!this.state.user) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('inv_pending_action', 'register');
      }
      this.openAuth('login');
      this.toast('🔒 Authentication required: Please log in or sign up before registering.');
      return;
    }
    if (this.state.registration) {
      this.openAuth('pass');
      return;
    }
    const t = e && e.currentTarget, disc = t && t.closest && t.closest('[data-hero]') ? this.$('[data-hero-disc]') : null;
    this.openAuth('register', disc || t, !!disc);
  };
  // @ts-ignore
  loginClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (this.state.user) {
      this.setState({ profileOpen: true });
      return;
    }
    const src = e && e.currentTarget;
    if (this.state.about) this.setState({ about: false });
    this.openAuth('login', src);
  };

  /* ---------- Supabase Auth & Google OAuth (Cookie-Backed Sessions) ---------- */
  initSupabaseAuth = async () => {
    try {
      purgeLocalStorageTokens();
      const supabase = getSupabase();

      // 1. Exchange PKCE code if returning from Google OAuth redirect
      if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        if (code) {
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.warn('PKCE exchange warning:', error.message);
            }
          } catch (e) {
            console.warn('exchangeCodeForSession error:', e);
          } finally {
            cleanAuthUrl();
          }
        }
      } else {
        cleanAuthUrl();
      }

      // 2. Check active session from cookies / client
      const { data: { session } } = await supabase.auth.getSession();
      purgeLocalStorageTokens();

      if (session?.user) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.warn('Cached session is invalid or user was removed. Signing out...');
          await signOutUser();
          return;
        }
        await saveSessionToDatabase(session);
        await this.handleUserSession(user);
      } else {
        // 3. Fall back to Server/Database session via cookies (ZERO localStorage)
        const dbAuth = await fetchSessionFromDatabase();
        if (dbAuth.user) {
          if (dbAuth.tokens?.access_token) {
            try {
              await supabase.auth.setSession({
                access_token: dbAuth.tokens.access_token,
                refresh_token: dbAuth.tokens.refresh_token || '',
              });
            } catch (e) {
              console.warn('setSession failed:', e);
            }
          }
          await this.handleUserSession(dbAuth.user);
        }
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        cleanAuthUrl();
        purgeLocalStorageTokens();
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          await saveSessionToDatabase(session);
          await this.handleUserSession(session.user);
        } else if (event === 'SIGNED_OUT') {
          this.reg = null;
          this.pass = null;
          purgeLocalStorageTokens();
          this.setState({
            user: null,
            registration: null,
            adminOpen: false,
            profileOpen: false,
            phoneModalOpen: false,
          });
        }
      });
      this.cleanups.push(() => subscription.unsubscribe());
    } catch (err) {
      console.warn('initSupabaseAuth error:', err);
    }
  };

  handleUserSession = async (authUser: any) => {
    const intent = typeof window !== 'undefined' ? sessionStorage.getItem('inv_login_intent') : null;
    const isNitEmail = authUser.email?.toLowerCase().endsWith('@nitrkl.ac.in');

    if (intent === 'internal' && !isNitEmail) {
      if (typeof window !== 'undefined') sessionStorage.removeItem('inv_login_intent');
      await signOutUser();
      this.setState({
        user: null,
        gErr: 'Internal login requires an official @nitrkl.ac.in institute email address. Please select External student login or use your NIT RKL account.',
        auth: true,
        authMode: 'login',
      });
      return;
    }

    const profile = await getOrCreateUserProfile(authUser);
    if (!profile) {
      this.setState({ user: null, registration: null });
      return;
    }

    const registration = await fetchUserRegistration(authUser.id);

    if (registration) {
      this.pass = {
        name: registration.name,
        college: registration.college,
        id: registration.registration_id,
        email: registration.email,
        status: registration.status.toUpperCase(),
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
    if (pendingAction === 'register') {
      if (typeof window !== 'undefined') sessionStorage.removeItem('inv_pending_action');
      if (registration) {
        this.closeAuth(() => this.toast(`Welcome back, ${profile.full_name?.split(' ')[0] || 'Explorer'}! You are already registered.`));
      } else {
        this.toast(`Authenticated as ${profile.email}. Let's complete your registration.`);
        setTimeout(() => this.openAuth('register'), 300);
      }
      return;
    }

    if (this.state.auth && this.state.authMode === 'login') {
      if (registration) {
        this.closeAuth(() => this.toast(`Welcome back, ${profile.full_name?.split(' ')[0] || 'Explorer'}.`));
      } else {
        this.setState({ authMode: 'register', step: 0 });
      }
    }
  };

  refreshUserProfile = async (userId: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        this.setState({ user: data as UserProfile });
      }
    } catch (err) {
      console.warn('refreshUserProfile error:', err);
    }
  };

  handleUpdatePhone = async (phone: string) => {
    if (!this.state.user) return;
    const res = await updateUserProfile(this.state.user.id, { phone });
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
    this.play('thumpSoft');
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
    this.play('beep');
    this.setState({ gErr: msg });
    const b = this.$('[data-g-btn]');
    if (b && !this.reduce) gsap.fromTo(b, { x: -10 }, { x: 0, duration: .6, ease: 'elastic.out(1,.3)' });
  }

  logout = async () => {
    this.reg = null;
    this.pass = null;
    this.dropFiles();
    await signOutUser();
    const f = this.$ && this.$('[data-auth-form]');
    if (f) f.reset();
    this.setState({
      user: null,
      registration: null,
      adminOpen: false,
      profileOpen: false,
      phoneModalOpen: false,
      authMode: 'register',
      step: 0,
      err: {},
      files: {},
      about: false,
      gUser: null,
      gErr: '',
    });
    this.play('thumpSoft');
    this.toast('Logged out. See you in orbit.');
  };
  // @ts-ignore
  emailOk(x) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x); }
  nameFrom(em) { return em.split('@')[0].replace(/\d+/g, '').replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || 'Explorer'; }
  // @ts-ignore
  newId() { return 'IV26-' + (Math.floor(Math.random() * 9000) + 1000); }
  drop(err, k) { const e = { ...err }; delete e[k]; return e; }
  fee() { const n = Math.round(Number(this.props.regFee ?? 499)); return n > 0 ? n : 499; }
  // @ts-ignore
  upi() { return String(this.props.upiId || 'innovision@sbi').trim(); }
  speed() { const n = Number(this.props.riftSpeed ?? 1); return n > 0 ? n : 1; }
  // @ts-ignore
  fmtSize(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  livePage() { return [...this.$$('[data-view]').filter((el) => getComputedStyle(el).visibility !== 'hidden'), this.$('[data-hud]')].filter(Boolean); }
  // @ts-ignore
  pagePush(z) {
    const sc = z ? String(1 + .12 * z) : '', o = this.authO, to = z && o ? o.x.toFixed(0) + 'px ' + o.y.toFixed(0) + 'px' : '';
  // @ts-ignore
    (this.page || []).forEach((el) => { el.style.scale = sc; el.style.transformOrigin = to; });
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

    // Strict Auth Middleware Guard: Block access to registration if unauthenticated
    if (mode === 'register' && !this.state.user) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('inv_pending_action', 'register');
      }
      mode = 'login';
      this.toast('🔒 Authentication required: Please log in or sign up before registering.');
    }

    if (this.state.auth) { this.switchMode(mode); return; }
    this.authBusy = true;
    const g = gsap, root = this.$('[data-auth-root]'), sec = this.$('[data-auth]');
    this.page = this.livePage(); this.authO = this.originOf(src, fromDisc);
    await this.set({ auth: true, authMode: mode, err: {}, gErr: '' });
    const sc = this.$('[data-auth-scroll]'); if (sc) sc.scrollTop = 0;
    const ins = this.$$('[data-a-in]'), ui = this.$('[data-a-ui]'), planet = this.$('[data-a-planet-wrap]');
    g.set(root, { autoAlpha: 1, pointerEvents: 'auto' });
    this.play('swoosh');
    this.authSpin(true);
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
    const r = this._rift = this.riftNew(0, 0, 1, 0);
    this.riftDraw();
    const k = this.speed();
    this.warp(2.4 / k);
  // @ts-ignore
    this.authTl = g.timeline({ onUpdate: () => this.riftDraw(), onComplete: () => {
      this._rift = null; sec.style.clipPath = 'none';
      this.pagePush(0); this.authBusy = false; this.focusAuth();
    } })
      .fromTo(sec, { autoAlpha: fromDisc ? 0 : 1 }, { autoAlpha: 1, duration: fromDisc ? .35 : .01, ease: 'power1.out' }, 0)
      .to(r, { p: 1, duration: 1.3, ease: fromDisc ? 'power3.inOut' : 'expo.inOut' }, fromDisc ? .15 : 0)
      .to(r, { z: 1, duration: 1.3, ease: 'power2.inOut' }, 0)
      .add(() => this.play('thumpSoft'), .6)
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
      this._rift = null;
      g.set(root, { autoAlpha: 0, pointerEvents: 'none' }); g.set(sec, { autoAlpha: 1 }); sec.style.clipPath = 'none';
      this.pagePush(0);
      this.authSpin(false); this.authClosing = false; this.authBusy = false;
      this.setState({ auth: false, err: {}, busyLbl: '', drag: '' });
      if (after) after();
    };
    this.play('vanish');
    if (this.reduce) { g.to(sec, { autoAlpha: 0, duration: .3, onComplete: () => { g.set(sec, { autoAlpha: 1 }); done(); } }); return; }
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
    gsap.set(this.$('[data-auth-root]'), { autoAlpha: 0, pointerEvents: 'none' });
    this.pagePush(0);
    this.authSpin(false); this.authBusy = false; this.authClosing = false;
    this.setState({ auth: false, busyLbl: '', drag: '' });
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
    const s = this.state, m = typeof mode === 'string' ? mode : (s.authMode === 'login' ? 'register' : 'login');
    if (m === s.authMode || s.busyLbl) return;

    // Strict Auth Middleware: Intercept switching to register without login
    if (m === 'register' && !s.user) {
      this.play('beep');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('inv_pending_action', 'register');
      }
      this.toast('🔒 Authentication required: Please log in or sign up first to access registration.');
      return;
    }

    this.play('thumpSoft');
    this.setState({ authMode: m, err: {}, gErr: '' }, () => { this.animPane(1, true); this.focusAuth(); });
  };
  // @ts-ignore
  toStep(n) {
    const dir = n > this.state.step ? 1 : -1;
    this.play('thumpSoft');
    this.setState({ step: n, err: {} }, () => {
      const sc = this.$('[data-auth-scroll]'); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
      this.animPane(dir); this.focusAuth();
      if (this.reduce) return;
      gsap.to(this.$('[data-a-planet-wrap]'), { rotation: -n * 26, duration: 1.8, ease: 'expo.out' });
      const node = this.$$('[data-rail-node]')[n];
      if (node) gsap.fromTo(node, { scale: .5 }, { scale: 1, duration: .8, ease: 'back.out(3)' });
      if (n === 2) setTimeout(() => this.scan('qr'), 380);
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
    this.play('beep');
    if (k !== 'idfile' && k !== 'payfile') { const el = this.$('[data-auth] [name="' + k + '"]'); if (el && el.offsetParent) el.focus(); }
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
    const ek = kind === 'id' ? 'idfile' : 'payfile';
    const isImg = /^image\//.test(f.type);
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

    if (kind === 'pay' ? !isImg : !(isImg || isPdf)) {
      this.fail({ [ek]: kind === 'pay' ? 'Upload the screenshot as an image (JPG or PNG).' : 'Use a JPG, PNG or PDF file.' });
      return;
    }

    // 2MB max size limit requirement
    const MAX_SIZE = 2 * 1024 * 1024;
    if (f.size > MAX_SIZE) {
      this.fail({ [ek]: 'That file exceeds 2 MB. Please select a smaller photo or PDF (max 2MB).' });
      return;
    }

    const old = (this.state.files || {})[kind];
    if (old && old.url && old.url.startsWith('blob:')) URL.revokeObjectURL(old.url);

    const previewUrl = isImg ? URL.createObjectURL(f) : '';
    this.play('beep');
    this.setState(
      (st) => ({
        files: { ...st.files, [kind]: { name: f.name, size: f.size, url: previewUrl, pdf: !isImg, status: 'up' } },
        err: this.drop(st.err, ek),
      }),
      () => this.runUpload(kind)
    );

    // Upload to ImageKit via /api/upload Route Handler
    try {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('folder', kind === 'id' ? '/innovision/id_cards' : '/innovision/payments');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload image to ImageKit');
      }

      this.setState((st) => ({
        files: {
          ...st.files,
          [kind]: {
            name: f.name,
            size: f.size,
            url: data.url, // Real ImageKit CDN URL
            fileId: data.fileId,
            pdf: !isImg,
            status: 'done',
          },
        },
      }));
    } catch (err: any) {
      this.setState((st) => ({
        files: { ...st.files, [kind]: null },
      }));
      this.fail({ [ek]: err?.message || 'Upload to ImageKit failed. Please try again.' });
    }
  };
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
      this.play('thumpSoft');
      this.setState((st) => (st.files[kind] ? { files: { ...st.files, [kind]: { ...st.files[kind], status: 'done' } } } : null), () => this.scan(kind));
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
    this.play('beep');
    this.setState((st) => ({ files: { ...st.files, [kind]: null } }));
  }
  replaceFile(kind) { const i = this.$('[data-auth] [name="' + (kind === 'id' ? 'idfile' : 'payfile') + '"]'); if (i) i.click(); }
  dropFiles() { Object.values(this.state.files || {}).forEach((f: any) => { if (f && f.url && f.url.startsWith('blob:')) URL.revokeObjectURL(f.url); }); }
  // @ts-ignore
  copyUpi = () => {
    const t = this.upi();
  // @ts-ignore
    const ok = () => { this.play('beep'); this.setState({ copied: true }); clearTimeout(this._copy); this._copy = setTimeout(() => this.setState({ copied: false }), 1600); };
  // @ts-ignore
    const no = () => this.toast('UPI ID: ' + t);
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, no); else no(); } catch (e) { no(); }
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
          this.pass = { name: this.nameFrom(em), college: '', id: id.replace(/^IV26-?/, 'IV26-'), email: em, status: 'CONFIRMED' };
          this.closeAuth(() => this.toast(`Welcome back, ${this.pass.name.split(' ')[0]}.`));
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
      const college = isInternal ? 'National Institute of Technology, Rourkela' : v('college').replace(/\s+/g, ' ');
      const email = user.email; // LOCKED - CANNOT BE ALTERED
      const phone = v('phone').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
      const enrollment_no = v('enrollment_no');

      if (name.length < 2) err.name = 'Tell us your full name.';
      if (!isInternal && college.length < 3) err.college = 'Which college are you from?';
      if (!/^[6-9]\d{9}$/.test(phone)) err.phone = 'Use a 10-digit Indian mobile number.';
      if (isInternal && !enrollment_no) err.enrollment_no = 'Enter your NIT Rourkela Roll / Enrollment number.';

      if (this.fail(err)) return;
      this.reg = { name, college, email, phone, enrollment_no };

      // INTERNAL NIT RKL STUDENTS: NO ID CARD NEEDED & AUTO-CONFIRMED (NO ADMIN APPROVAL)
      if (isInternal) {
        this.wait('CONFIRMING', 1000).then(async () => {
          const regId = this.newId();
          const regPayload = {
            registration_id: regId,
            user_id: user.id,
            name,
            email: user.email,
            college: 'National Institute of Technology, Rourkela',
            phone,
            enrollment_no,
            student_type: 'internal' as const,
            id_card_url: '', // Zero ID card required for internal students!
            amount: 0,
            status: 'confirmed' as const, // Auto-confirmed! No approval needed!
          };

          const saveRes = await createRegistration(regPayload);
          const savedReg = saveRes.registration || regPayload;

          this.pass = {
            name,
            college: 'National Institute of Technology, Rourkela',
            id: regId,
            email: user.email,
            status: 'CONFIRMED',
          };
          this.play('fx');
          this.toast('🎉 Registration confirmed! Welcome to Innovision 2026.');
          this.setState(
            {
              authMode: 'pass',
              step: 4,
              registration: savedReg as Registration,
            },
            () => this.passReveal()
          );
        });
        return;
      }

      // External students proceed to Step 1 (ID card upload)
      this.toStep(1);
    } else if (s.step === 1) {
      const fi = files.id;
      if (!fi) err.idfile = 'Upload your college ID to continue.';
      else if (fi.status !== 'done') err.idfile = 'Hold on, your ID is still uploading to ImageKit.';
      if (this.fail(err)) return;

      // External students proceed to payment
      this.toStep(2);
    } else if (s.step === 2) {
      this.toStep(3);
    } else if (s.step === 3) {
      const fp = files.pay, utr = v('utr').replace(/\s+/g, '');
      if (!fp) err.payfile = 'Upload the screenshot of your payment.';
      else if (fp.status !== 'done') err.payfile = 'Hold on, your screenshot is still uploading to ImageKit.';
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
          student_type: 'external' as const,
          id_card_url: files.id.url,
          payment_screenshot_url: fp.url,
          utr,
          amount: 499,
          status: 'pending' as const, // PENDING FOR EXTERNAL
        };

        const saveRes = await createRegistration(regPayload);
        const savedReg = saveRes.registration || regPayload;

        this.pass = {
          name: r.name,
          college: r.college,
          id: regId,
          email: user.email,
          status: 'PAYMENT UNDER REVIEW',
          utr,
        };
        this.play('fx');
        this.setState(
          {
            authMode: 'pass',
            step: 4,
            registration: savedReg as Registration,
          },
          () => this.passReveal()
        );
      });
    }
  };
  // @ts-ignore
  passReveal() {
    const sc = this.$('[data-auth-scroll]'); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
    this.animPane(1, true);
    if (this.reduce) return;
    this.warp(1.8 / this.speed());
    gsap.to(this.$('[data-a-planet-wrap]'), { rotation: -4 * 26, duration: 1.8, ease: 'expo.out' });
    const w = this.$('[data-pass-wrap]');
    if (w) gsap.fromTo(w, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out', delay: .1, onComplete: () => gsap.set(w, { clearProps: 'clipPath' }) });
    setTimeout(() => this.scan('pass'), 260);
  }
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
    const am = s.authMode, st = s.step, reg = am === 'register', show = (b) => (b ? 'flex' : 'none'), gold = 'oklch(0.8 0.12 85)', cream = '#ECE8DF', bad = 'oklch(0.74 0.15 35)';
    const E = Object.assign({ name: '', college: '', email: '', phone: '', enrollment_no: '', idfile: '', payfile: '', utr: '', lemail: '', lid: '' }, s.err);
    const bc = {}, inv = {};
  // @ts-ignore
    Object.keys(E).forEach((k) => { bc[k] = E[k] ? bad : 'rgba(236,232,223,.28)'; inv[k] = String(!!E[k]); });
    const P = this.pass || s.registration || {}, fee = this.fee(), upi = this.upi(), R = this.reg || {}, files = s.files || {};
    const user = s.user;
    const isInternal = (user?.student_type === 'internal') || (user?.email?.toLowerCase().endsWith('@nitrkl.ac.in'));
    const regVals = {
      name: user?.full_name || R.name || '',
      college: isInternal ? 'National Institute of Technology, Rourkela' : (R.college || ''),
      email: user?.email || '',
      phone: user?.phone || R.phone || '',
      enrollment_no: user?.enrollment_no || s.registration?.enrollment_no || R.enrollment_no || '',
    };
  // @ts-ignore
    const up = (kind, ek, prompt) => {
      const f = files[kind], dz = s.drag === kind;
      return {
        emptyD: show(!f), prevD: f ? 'block' : 'none', busyD: show(!!f && f.status === 'up'), rowD: show(!!f && f.status === 'done'), hasImg: !!(f && f.url), pdfD: show(!!f && f.pdf),
        url: (f && f.url) || '', name: f ? f.name : '', size: f ? this.fmtSize(f.size) : '',
        bc: dz ? gold : E[ek] ? bad : 'rgba(236,232,223,.32)', bg: dz ? 'rgba(220,183,106,.1)' : 'rgba(236,232,223,.03)', prompt: dz ? 'Release to upload' : prompt,
        pick: this.pickFile(kind), over: this.dragOver(kind), leave: this.dragLeave(kind), drop: this.dropFile(kind), remove: () => this.removeFile(kind), replace: () => this.replaceFile(kind),
      };
    };
    const showRail = reg || (am === 'pass' && st === 4);
    const notes = [regVals.name, files.id && files.id.name, 'by UPI', 'Submitted'];

    // Rail steps differ for internal vs external students:
    // Internal students do not require an ID card or admin approval (1 direct step)
    const railSteps = isInternal
      ? [['DETAILS', 'Roll no & phone number', 'DETAILS']]
      : [['DETAILS', 'Name, college, email, phone', 'DETAILS'], ['COLLEGE ID', 'Photo or PDF of your ID card', 'ID'], ['PAYMENT', 'by UPI', 'PAY'], ['CONFIRM', 'Screenshot and transaction ID', 'CONFIRM']];

    return {
      noUser: !s.user, hasUser: !!s.user, showLogin: !s.narrow, loginClick: this.loginClick, noDrop: (e) => e.preventDefault(),
      authHidden: String(!s.auth),
      authAria: reg ? 'Register for Innovision 2026' : am === 'login' ? 'Log in to Innovision' : 'Your boarding pass',
      authCols: s.narrow ? 'minmax(0,1fr)' : 'minmax(0,.9fr) minmax(0,1fr)',
      authTitle: reg ? 'CLAIM YOUR SEAT' : am === 'login' ? 'WELCOME BACK' : "YOU'RE ON BOARD",
      authSub: reg
        ? (isInternal ? 'NIT Rourkela student registration: Instant auto-confirmed entry (Free).' : 'Four short stops to register for Innovision 2026 at NIT Rourkela.')
        : am === 'login' ? 'Sign in using your Google account or institute webmail.' : 'Your boarding pass is ready. See you at NIT Rourkela.',
      railD: show(showRail && !s.narrow && !isInternal), hprogD: showRail && s.narrow && !isInternal ? 'grid' : 'none',
      prog: railSteps.map(([label, hint, short], k) => {
        const done = k < st, cur = k === st && reg, back = done && reg;
        return {
          label, short, note: done ? (k === 2 ? 'by UPI' : notes[k] || hint) : hint, cur: cur ? 'step' : 'false',
          c: done || cur ? cream : 'rgba(236,232,223,.6)', bc: done || cur ? gold : 'rgba(236,232,223,.3)', fill: done ? gold : 'transparent', chk: done ? 1 : 0, dot: cur ? 1 : 0, dotS: cur ? 1 : .2,
          lineD: k < railSteps.length - 1 ? 'block' : 'none', lineS: done ? 1 : 0, segS: done ? 1 : cur ? .5 : 0,
          lock: !back || !!s.busyLbl, cursor: back ? 'pointer' : 'default', go: () => this.railGo(k), aria: label + (done ? ', done. Go back to edit' : cur ? ', current step' : ''),
        };
      }),
      d: { s0: show(reg && st === 0 && !!s.user), s1: show(reg && st === 1 && !isInternal && !!s.user), s2: show(reg && st === 2 && !isInternal && !!s.user), s3: show(reg && st === 3 && !isInternal && !!s.user), login: show(am === 'login' || (reg && !s.user)), pass: show(am === 'pass'), act: show(reg && !!s.user) },
      err: E, bc, inv,
      upId: up('id', 'idfile', 'Drop your ID card here or browse (Max 2MB)'), upPay: up('pay', 'payfile', 'Drop the screenshot here or browse (Max 2MB)'),
      fee, upi, copyUpi: this.copyUpi, copyLbl: s.copied ? 'COPIED' : 'COPY',
      upiLink: 'upi://pay?pa=' + encodeURIComponent(upi) + '&pn=' + encodeURIComponent('Innovision NIT Rourkela') + '&am=' + fee + '&cu=INR&tn=' + encodeURIComponent('Innovision 2026 registration'),
      upiAppD: s.narrow ? 'inline-flex' : 'none',
      authSubmit: this.authSubmit, clearErr: this.clearErr, switchMode: this.switchMode, closeAuthH: () => this.closeAuth(),
      showSwitch: am !== 'pass' && !!s.user,
      switchQ: !s.user ? 'Authentication required' : (reg ? 'Already registered?' : 'Need to register?'),
      switchLbl: !s.user ? 'SIGN IN' : (reg ? 'LOG IN' : 'REGISTER'),
      switchQD: s.narrow ? 'none' : 'inline',
      canBack: reg && st > 0 && !isInternal, stepBack: this.stepBack,
      submitLbl: s.busyLbl || (am === 'login' ? 'LOG IN' : isInternal ? 'CONFIRM REGISTRATION (FREE)' : ['CONTINUE', 'CONTINUE TO PAYMENT', "I'VE PAID", 'SUBMIT REGISTRATION'][st] || 'CONTINUE'),
      busy: !!s.busyLbl, busyO: s.busyLbl ? .72 : 1,
      passName: P.name || '', passCollege: P.college || '', passCollegeD: P.college ? 'block' : 'none', passId: P.id || P.registration_id || '', passStatus: P.status ? P.status.toUpperCase() : (isInternal ? 'CONFIRMED' : 'PAYMENT UNDER REVIEW'),
      passNote: (P.status === 'CONFIRMED' || (isInternal && !P.status)) ? 'Show this pass at the registration desk when you arrive at NIT Rourkela.' : (P.status === 'REJECTED' ? 'Your registration was declined. Please contact the helpdesk.' : 'We will email ' + (P.email || 'you') + ' once your payment is verified by the IT-Team.'),
      exploreFromPass: this.exploreFromPass,
      googleLogin: this.googleLogin, gBusy: s.gBusy, gErr: s.gErr, gLbl: s.gBusy ? 'Waiting for Google…' : 'Continue with Google',
      gNote: reg && st === 0 && s.user ? 'Signed in as ' + s.user.email + (isInternal ? ' (NIT RKL Student)' : '') + '.' : '',
      regVals,
      isInternal,
      user: s.user,
    };
  }
  checkout = () => { this.play('thumpSoft'); this.toast('Pre-orders open with registrations. Stay in orbit.'); };
  linkGo = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const href = e.currentTarget.getAttribute('href') || '#/';
    this.setState({ menu: false, about: false, bagOpen: false });
    this.go(href);
  };
  toggleSound = () => {
    const m = !this.state.muted;
    this.hw?.Howler.mute(m);
    try { localStorage.setItem('innovisionMuted', String(m)); } catch {}
    this.setState({ muted: m });
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
    const s = this.state, i = s.index, w = WORLDS[i], dw = WORLDS[s.dIndex], nx = WORLDS[(s.dIndex + 1) % 3];
    const navOn = s.view === 'worlds' || s.view === 'detail';
    const act = s.view === 'merch' ? 'merch' : s.view === 'gallery' ? 'gallery' : s.view === 'schedule' ? 'schedule' : navOn ? 'events' : 'home';
    const routed = (k: string) => k === 'events' || k === 'merch' || k === 'gallery' || k === 'schedule';
    const navLinks = LINKS.map(([label, k]) => ({
      label: label.toUpperCase(), name: label, cur: String(k === act) as 'true' | 'false', o: k === act ? 1 : .68, bar: k === act ? 1 : 0, dc: k === act ? 'oklch(0.8 0.12 85)' : '#ECE8DF',
      href: k === 'events' ? '#/worlds/' + w.slug : k === 'merch' ? '#/merch' : k === 'gallery' ? '#/gallery' : k === 'schedule' ? '#/schedule' : '#/',
      onClick: (e: MouseEvent<HTMLAnchorElement>) => {
        if (routed(k)) { if (this.state.about || this.state.menu) this.setState({ about: false, menu: false }); return; }
        e.preventDefault(); this.goSection(k === 'home' ? null : k);
      },
    }));
    const lines = s.bag.map((l) => ({ ...l, p: PRODUCTS.find((x) => x.id === l.key) })).filter((l): l is BagLine & { p: Product } => !!l.p);
    const count = lines.reduce((a, l) => a + l.qty, 0), total = lines.reduce((a, l) => a + l.qty * l.p.price, 0);
    const cartOn = s.view === 'merch' && count > 0;
    return {
      navLinks, footLinks: navLinks.slice(0, 5), wide: !s.compact,
      // Wide screens open the About drawer; compact screens open the full-screen menu.
      // The MENU button only exists on compact screens; wide screens show LOG IN in its place.
      menuButton: () => { this.play('thumpSoft'); this.setState({ menu: true }); },
      menuExpanded: s.menu,
      menuLogin: (e: MouseEvent<HTMLAnchorElement>) => { this.setState({ menu: false }); this.loginClick(e); },
      goHome: (e: MouseEvent) => { e.preventDefault(); this.goSection(null); },
      topNav: navLinks.map((l) => ({ label: l.label, labelCap: l.name, href: l.href, menuColor: l.dc, cur: l.cur === 'true', onClick: l.onClick })),
      linkGo: this.linkGo,
      menuVis: (s.menu ? 'visible' : 'hidden') as 'visible' | 'hidden', menuDelay: s.menu ? '0s' : '.9s', menuClip: s.menu ? 'circle(150% at 100% 0%)' : 'circle(0% at 100% 0%)', menuHidden: !s.menu,
      closeMenu: () => this.setState({ menu: false }),
      tunnel: TUNNEL.map(([cap, x, y, ar], k) => ({ id: 'gallery-' + (k + 1), ph: cap + ' photo', capU: cap.toUpperCase(), no: String(k + 1).padStart(2, '0'), x, y, ar, c: TUNNEL_C[k % 3] })),
      tunnelTotal: String(TUNNEL.length).padStart(2, '0'),
      titleSponsor: TITLE_SPONSOR,
      sponsorTiers: SPONSOR_TIERS.map((t) => ({
        key: t.key, title: t.title, lg: t.size === 'lg', countL: t.items.length + (t.items.length === 1 ? ' partner' : ' partners'),
        cards: t.items.map((it, k) => ({ ...it, slot: 'sponsor-' + t.key + '-' + (k + 1), ph: t.key === 'main' ? 'Sponsor logo' : t.key === 'media' ? 'Media partner logo' : 'Food partner logo' })),
      })).map((t) => {
        // The ticker repeats a short tier until one pass is wider than any screen, so the loop never shows a gap;
        // its duration grows with the pass so every row drifts at the same gentle speed.
        const loop = t.cards.length ? Array.from({ length: Math.max(8, t.cards.length) }, (_, k) => t.cards[k % t.cards.length]) : [];
        return { ...t, loop, dur: (loop.length * (t.lg ? 3.6 : 3)).toFixed(1) + 's' };
      }),
      merchTeaser: PRODUCTS.slice(0, 3).map((p) => ({ slot: 'merch-' + p.id, ph: p.name, name: p.name, priceL: '₹' + p.price })),
      products: PRODUCTS.map((p) => {
        const sl = s.sel[p.id] || {}, size = sl.size || (p.sizes ? 'M' : null), color = sl.color || 0;
        return {
          ...p, slot: 'merch-' + p.id, ph: p.name + ' product photo', priceL: inr(p.price), hasTag: !!p.tag, tagU: (p.tag || '').toUpperCase(),
          hasSizes: !!p.sizes, hasColors: !!p.colors, colorName: p.colors ? p.colors[color][0] : '',
          sizes: (p.sizes || []).map((z) => ({ z, on: z === size, bg: z === size ? '#141312' : 'transparent', fg: z === size ? '#ECE8DF' : '#141312', onClick: () => this.pick(p.id, { size: z }) })),
          colors: (p.colors || []).map(([n, c], k) => ({ n, c, on: k === color, ring: k === color ? '#141312' : 'transparent', onClick: () => this.pick(p.id, { color: k }) })),
          add: () => this.addToCart(p, size, color), addLabel: s.added === p.id ? 'ADDED ✓' : 'ADD TO CART', addBg: s.added === p.id ? '#8a6a2a' : '#141312',
        };
      }),
      cartO: cartOn ? 1 : 0, cartY: cartOn ? '0px' : '24px', cartPE: (cartOn ? 'auto' : 'none') as 'auto' | 'none',
      cartCountL: count + (count === 1 ? ' item' : ' items'), cartTotal: inr(total),
      clearCart: () => this.setBag([]),
      checkout: this.checkout,
      bagLines: lines.map((l) => ({ name: l.p.name, meta: [l.c >= 0 && l.p.colors ? l.p.colors[l.c][0] : '', l.s].filter(Boolean).join(' · '), qty: l.qty, lineStr: inr(l.qty * l.p.price), inc: () => this.setQty(l.id, 1), dec: () => this.setQty(l.id, -1), remove: () => this.setQty(l.id, -l.qty) })),
      bagCountStr: String(count), subtotalStr: inr(total), bagEmpty: count === 0,
      bagVis: (s.bagOpen ? 'visible' : 'hidden') as 'visible' | 'hidden', bagDelay: s.bagOpen ? '0s' : '.8s', bagO: s.bagOpen ? 1 : 0, bagX: s.bagOpen ? '0%' : '100%', bagHidden: !s.bagOpen,
      openBag: () => { this.play('thumpSoft'); this.setState({ bagOpen: true }); },
      closeBag: () => this.setState({ bagOpen: false }),
      subscribe: (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = e.currentTarget, email = f.elements.namedItem('email') as HTMLInputElement | null;
        if (!email || !email.value) return;
        f.reset(); this.play('thumpSoft'); this.toast("You're on the mission list.");
      },
      sponsorCta: (e: MouseEvent) => { e.preventDefault(); this.play('thumpSoft'); this.toast('Partnership deck drops soon. Reach us on Instagram.'); },
      toastMsg: s.toastMsg,
      bandA: Array.from({ length: 6 }, () => ({ t: "EASTERN INDIA'S LARGEST TECH FEST" })),
      bandB: Array.from({ length: 6 }, () => ({ t: 'INNOVISION 2026 · NIT ROURKELA' })),
      heroChars: 'INNOVISION'.split('').map((ch) => ({ ch })),
      briefWords: BRIEF.split(' ').map((t) => { const m = t.match(/^\[(\w+)\]$/); return m ? { isImg: true as const, img: A + PILLS[m[1]][0], pos: PILLS[m[1]][1], t: '' } : { isImg: false as const, img: '', pos: '', t }; }),
      heroSparks: HERO_SPARKS,
      loaderSparks: LOADER_SPARKS,
      worlds: WORLDS.map((x, k) => ({
        ...x, secNo: String(k + 1).padStart(2, '0'), sealText: x.statL.toUpperCase() + ' · ' + x.category.toUpperCase() + ' · ',
        href: '#/world/' + x.slug, stroke: 'color-mix(in oklab, ' + x.ink + ' 36%, transparent)', statLU: x.statL.toUpperCase(), categoryU: x.category.toUpperCase(),
        astroBottom: x.astroSit ? 'calc(100% - 7vh)' : 'calc(100% - 3.5vh)', astroH: x.astroSit ? (s.narrow ? '32vh' : '42vh') : (s.narrow ? '30vh' : '40vh'),
        onExplore: () => this.go('#/world/' + x.slug),
        onEnter: () => { if (this.mapOpen !== k) this.play('beep'); this.openMap(k); },
      })),
      cw: {
        ...dw, categoryU: dw.category.toUpperCase(), statLU: dw.statL.toUpperCase(), serial: 'IV26-0' + (s.dIndex + 1),
        stampText: 'BOARDING SOON · ' + dw.statL.toUpperCase() + ' · ', frame: 'color-mix(in oklab, ' + dw.ink + ' 50%, transparent)',
        ticker: [0, 1, 2, 3].flatMap(() => ['Now boarding · ' + dw.name, ...dw.missions.map((m) => m[0])]).map((t) => ({ t })),
        chars: [...dw.name.toUpperCase()].map((ch) => ({ ch: ch === ' ' ? ' ' : ch })),
        words: dw.tagline.split(' ').map((t) => ({ t })),
        specs: dw.specs.map(([k, v], j) => ({ k, v, i: String(j + 1).padStart(2, '0') })), missionCount: String(dw.missions.length).padStart(2, '0'),
        missions: dw.missions.map(([name, text, format, dur], k) => ({ no: String(k + 1).padStart(2, '0'), name, text, format, dur, img: A + dw.gates[k % dw.gates.length] })),
      },
      nw: { href: '#/world/' + nx.slug, nameU: nx.name.toUpperCase(), planet: nx.planet },
      titleShadow: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${n}px ${n}px 0 ${dw.accent}`).join(', '),
      isTakeoff: dw.key === 'takeoff', isTouchdown: dw.key === 'touchdown', isHighpoint: dw.key === 'highpoint',
      isDetail: s.view === 'detail',
      compact: s.compact, notCompact: !s.compact,
      taglineW: s.compact ? '88vw' : 'min(640px, 34vw)',
      arrowsDisplay: s.narrow ? 'none' : 'grid',
      backHref: '#/worlds/' + w.slug,
      nav: WORLDS.map((x, k) => ({ no: String(k + 1).padStart(2, '0'), label: x.name.toUpperCase(), current: k === i, color: k === i ? '#ECE8DF' : 'rgba(20,19,18,.72)', onClick: () => this.navTo(k) })),
      navX: (i * 100) + '%',
      navGlow: '#141312',
      navO: navOn ? 1 : 0, navY: navOn ? '0px' : '30px', navPE: (navOn ? 'auto' : 'none') as 'auto' | 'none',
      navBottom: s.narrow ? 'calc(clamp(16px,2.6vw,44px) + 40px)' : 'clamp(16px,2.6vw,44px)',
      hudSolid: s.hudSolid,
      scrollNext: () => {
        const sc = this.$('[data-view="home"]'), hw = this.$('[data-hero-wrap]');
        if (sc && hw) sc.scrollTo({ top: hw.offsetTop + hw.offsetHeight, behavior: this.reduce ? 'auto' : 'smooth' });
      },
      hintOn: s.hint && s.view === 'worlds' && !s.auth && !s.menu,
      // Entering is spelled out by the world's Enter button; the guide covers what isn't on screen: there are three worlds.
      // Name only the controls this screen shows: no side arrows on narrow screens, no keys on touch.
      hintMain: s.coarse ? 'Swipe left or right to visit all three worlds' : s.narrow ? 'Use the ← → keys or the switcher below to visit all three worlds' : 'Use the side arrows or ← → keys to visit all three worlds',
      hintSub: s.coarse ? 'Tap Enter, or the planet itself, to step inside one.' : 'Hover over a planet, then click Enter to step inside.',
      dismissHint: this.dismissHint,
      muted: s.muted, soundOn: !s.muted, soundLabel: s.muted ? 'Turn sound on' : 'Turn sound off', toggleSound: this.toggleSound,
      aboutVis: (s.about ? 'visible' : 'hidden') as 'visible' | 'hidden', aboutDelay: s.about ? '0s' : '.8s', aboutO: s.about ? 1 : 0, aboutX: s.about ? '0%' : '100%',
      aboutHidden: !s.about,
      openAbout: (e?: MouseEvent) => { if (e) e.preventDefault(); this.play('thumpSoft'); this.setState({ about: true, menu: false }); },
      closeAbout: () => this.setState({ about: false }),
      toTop: (e: MouseEvent) => { e.preventDefault(); const h = this.$('[data-view="home"]'); if (h) h.scrollTo({ top: 0, behavior: 'smooth' }); },
      toastO: s.toastOn ? 1 : 0, toastY: s.toastOn ? '0px' : '16px',
      register: this.register, hover: this.hover, beep: this.beep,
      openProfile: (e?: any) => {
        if (e) e.preventDefault();
        if (s.user?.id) this.refreshUserProfile(s.user.id);
        this.setState({ profileOpen: true });
      },
      openAdmin: (e?: any) => {
        if (e) e.preventDefault();
        if (s.user?.id) this.refreshUserProfile(s.user.id);
        this.setState({ adminOpen: true, profileOpen: false });
      },
      isStaff: !!(s.user && (s.user.role === 'admin' || s.user.role === 'it-team')),
      hasRegistered: !!s.registration,
      // @ts-ignore
      ...this.authVals(s),
      curtainLabel: s.curtainLabel, curtainKicker: s.curtainKicker,
      prevSlide: () => this.stepSlide(-1), nextSlide: () => this.stepSlide(1),
      onWheel: this.onWheel, onTouchStart: this.onTouchStart, onTouchEnd: this.onTouchEnd,
      // gallery page
      gallery: GALLERY.map((g, k) => ({ ...g, onFocus: () => { this.play('beep'); this.gTarget = k * GAP + 200; } })),
      gDust: Array.from({ length: 46 }, (_, k) => ({ s: (k % 3 === 0 ? 3 : 2) + 'px' })),
      gCur: GALLERY[s.gIdx], gTotal: String(GALLERY.length).padStart(2, '0'),
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
      <div ref={this.rootRef} data-booting="" style={{ position: 'fixed', inset: '0', overflow: 'hidden', background: '#ECE8DF', color: '#141312', fontFamily: "var(--font-grotesk),'Segoe UI',system-ui,sans-serif" }}>
        <LiveV value={v}>
        <HomeV v={v} deps={[]} />
        <WorldsV v={v} deps={[s.narrow, s.compact]} />
        <DetailV v={v} deps={[s.dIndex, s.compact]} />
        <GalleryV v={v} deps={[s.gIdx]} />
        <MerchV v={v} deps={[s.sel, s.added]} />
        <ScheduleV v={v} deps={[s.schedDay, s.schedFilter, s.saved, s.narrow]} />
        <Hud v={v} />
        <WorldNav v={v} />
        <WorldHint v={v} />
        <Curtain v={v} />
        <AboutPanel v={v} />
        <MenuOverlay v={v} />
        <AuthOverlay v={v} />
        <ProfileOverlay
          isOpen={s.profileOpen}
          onClose={() => this.setState({ profileOpen: false })}
          user={s.user}
          registration={s.registration}
          onOpenPass={() => this.openAuth('pass')}
          onOpenRegister={() => this.openAuth('register')}
          onOpenAdmin={() => this.setState({ adminOpen: true, profileOpen: false })}
          onLogout={this.logout}
          onUpdatePhone={this.handleUpdatePhone}
        />
        <PhoneModal
          isOpen={s.phoneModalOpen}
          onSave={this.handleUpdatePhone}
          onClose={() => this.setState({ phoneModalOpen: false })}
          userEmail={s.user?.email}
        />
        {s.user && (s.user.role === 'admin' || s.user.role === 'it-team') && (
          <AdminDashboard
            isOpen={s.adminOpen}
            onClose={() => this.setState({ adminOpen: false })}
            currentUser={s.user}
          />
        )}
        <BagPanel v={v} />
        <CartPill v={v} />
        <Toast v={v} />
        <Cursor />
        <LoaderV v={v} deps={[]} />
        </LiveV>
      </div>
    );
  }
}

