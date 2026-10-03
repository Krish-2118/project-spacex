'use client';

import { Component, createRef, memo, type ComponentType, type FormEvent, type MouseEvent, type TouchEvent, type WheelEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import type { Howl } from 'howler';
import {
  A, WORLDS, PRELOAD, HERO_SPARKS, LOADER_SPARKS, STATUS, SCRAMBLE, GAP, GALLERY, G_MAX,
  LINKS, TUNNEL, TUNNEL_C, PRODUCTS, BRIEF, PILLS, inr, type Product, type WorldKey,
} from './data';
import HomeView from './HomeView';
import WorldsView from './WorldsView';
import DetailView from './DetailView';
import GalleryView from './GalleryView';
import MerchView from './MerchView';
import Hud from './Hud';
import WorldNav from './WorldNav';
import Curtain from './Curtain';
import AboutPanel from './AboutPanel';
import MenuOverlay from './MenuOverlay';
import BagPanel from './BagPanel';
import CartPill from './CartPill';
import Toast from './Toast';
import Cursor from './Cursor';
import Loader from './Loader';
import { LiveV } from './SiteFooter';
import type { V } from './types';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

type PureProps = { v: V; deps: readonly unknown[] };
/**
 * Wraps a large view so it re-renders only when one of its deps changes. Every handler in v reads
 * live state, so a view keeping an older v stays correct; deps list the state its markup shows.
 */
const pure = (View: ComponentType<{ v: V }>) => memo(function Pure({ v }: PureProps) { return <View v={v} />; },
  (a, b) => a.deps.length === b.deps.length && a.deps.every((d, k) => Object.is(d, b.deps[k])));
const HomeV = pure(HomeView), WorldsV = pure(WorldsView), DetailV = pure(DetailView), GalleryV = pure(GalleryView), MerchV = pure(MerchView), LoaderV = pure(Loader);

type ViewName = 'loading' | 'home' | 'worlds' | 'detail' | 'gallery' | 'merch';
type Route = { view: Exclude<ViewName, 'loading'>; index: number; section?: string };
/** A bag line: product id, colour index (-1 if none), size ('' if none), quantity. */
type BagLine = { id: string; key: string; c: number; s: string; qty: number };
type Sel = { color?: number; size?: string };
type MusicKey = 'home' | WorldKey;
type Track = { h: Howl; vol: number; seek?: number; started?: boolean; waiting?: boolean };
type SlideParts = { hero: HTMLElement | null; rot: HTMLElement | null; astro: HTMLElement | null; outline: HTMLElement | null; labels: HTMLElement[] };
type El = HTMLElement & { _tw?: gsap.core.Tween };
type Attracted = HTMLElement & { _a: { x: number; y: number; tx: number; ty: number; s: number; on: boolean } };

interface Props {
  /** Minimum loader duration in seconds. */
  loaderSeconds?: number;
  startMuted?: boolean;
  skipLoader?: boolean;
}

interface State {
  /** dIndex: world shown by the detail page; it only follows index when that page is prepared. */
  view: ViewName; index: number; dIndex: number; muted: boolean; about: boolean; compact: boolean; narrow: boolean;
  menu: boolean; toastOn: boolean; toastMsg: string; curtainLabel: string; curtainKicker: string;
  gIdx: number; sel: Record<string, Sel>; bag: BagLine[]; bagOpen: boolean; added: string | null;
}

const BAG_KEY = 'innovisionCart';

const parts = (s: Element): SlideParts => ({
  hero: s.querySelector<HTMLElement>('[data-s-hero]'), rot: s.querySelector<HTMLElement>('[data-s-rot]'),
  astro: s.querySelector<HTMLElement>('[data-s-astro]'), outline: s.querySelector<HTMLElement>('[data-s-outline]'),
  labels: [...s.querySelectorAll<HTMLElement>('[data-s-label]')],
});
const partList = (p: SlideParts) => [p.hero, p.rot, p.astro, p.outline, ...p.labels];

export default class Innovision extends Component<Props, State> {
  rootRef = createRef<HTMLDivElement>();
  state: State = { view: 'loading', index: 0, dIndex: 0, muted: false, about: false, compact: false, narrow: false, menu: false, toastOn: false, toastMsg: '', curtainLabel: 'INNOVISION', curtainKicker: 'NOW ENTERING', gIdx: 0, sel: {}, bag: [], bagOpen: false, added: null };
  busy = false; pending = false; slideDir = 0;
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
    this.setState({ muted: m, bag, compact: innerWidth < 1100, narrow: innerWidth < 720 });
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
      });
    });
    this.cleanups.push(() => cancelAnimationFrame(rz));
    this.boot();
  }

  componentWillUnmount() {
    this.alive = false;
    clearTimeout(this._toast); clearTimeout(this._added);
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
      this.attract();
      this.homeScroll();
      this.galleryInit();
      this.smoothWheel(this.$('[data-d-scroller]'));
      this.listen(window, 'hashchange', () => this.route());
      this.listen(window, 'keydown', (e) => this.onKey(e as KeyboardEvent));
      if (this.props.skipLoader) { this.hideLoader(); this.firstPaint(); return; }
      this.loaderIntro();
    }, R);
    this.cleanups.push(() => { R.setAttribute('data-booting', ''); R.querySelectorAll('[data-idle]').forEach((el) => el.removeAttribute('data-idle')); });
    if (!this.props.skipLoader) this.runLoader().then(() => { if (this.alive) this.loaderExit(); });
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
  componentDidUpdate() { if (this.ctx) this.waveLoop(); }

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
    else if (to.view === 'gallery') { this.gZ = -2600; this.gTarget = -2600; }
    else { await this.setSlide(to.index); if (to.view === 'detail') await this.prepDetail(to.index); }
    await this.showView(to.view);
  }
  enterView(to: Route): gsap.core.Timeline {
    if (to.view === 'home') { this.playMusic('home'); return this.homeEnter(); }
    if (to.view === 'gallery') { this.playMusic('touchdown'); return this.galleryEnter(); }
    if (to.view === 'merch') { this.playMusic('home'); return gsap.timeline().fromTo(this.$$('[data-view="merch"] [data-m-reveal]'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .06 }, .1); }
    this.playMusic(WORLDS[to.index].music);
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
    if (ls) gsap.fromTo(this.$('[data-launch]'), { y: innerHeight * .3 }, { y: -innerHeight * 1.15, ease: 'power2.in', scrollTrigger: { trigger: ls, scroller: sc, start: 'top bottom', end: 'bottom top', scrub: true } });
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
      .fromTo(p.labels, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .1 }, .7);
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
        .to([pa.outline, ...pa.labels], { autoAlpha: 0, duration: .5 }, 0)
        .to(b, { autoAlpha: 1, duration: 1, ease: 'power2.inOut' }, .2)
        .fromTo(pb.hero, { x: W * .7 * dir, yPercent: 12 }, { x: 0, yPercent: 0, duration: 1.5, ease: 'expo.out' }, .55)
        .fromTo(pb.rot, { rotation: 70 * dir }, { rotation: 0, duration: 1.8, ease: 'expo.out' }, .55)
        .fromTo(pb.astro, { y: -H * .4, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.5, ease: 'expo.out' }, .95)
        .fromTo(pb.outline, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, .8)
        .fromTo(pb.labels, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .08 }, 1);
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
    const [v, k] = location.hash.replace(/^#\/?/, '').split('/');
    const f = WORLDS.findIndex((w) => w.slug === k || w.key === k), idx = this.state.index;
    if (v === 'worlds') return { view: 'worlds', index: f >= 0 ? f : idx };
    if (v === 'world' && f >= 0) return { view: 'detail', index: f };
    if (v === 'gallery' || v === 'merch') return { view: v, index: idx };
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
    if (to.view === s.view && (to.view === 'merch' || to.index === s.index)) return;
    this.busy = true;
    try { await this.transition(to); } finally { this.busy = false; this.slideDir = 0; }
    if (this.pending) { this.pending = false; this.route(); }
  }
  async transition(to: Route) {
    const from = this.state.view, w = WORLDS[to.index];
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
    const label = to.view === 'worlds' ? 'THE WORLDS' : to.view === 'merch' ? 'THE STORE' : to.view === 'gallery' ? 'THE GALLERY' : w.name.toUpperCase();
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
  register = (e?: MouseEvent) => { if (e) e.preventDefault(); this.play('thumpSoft'); this.toast('Registrations open soon. Stay in orbit.'); };
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
    const act = s.view === 'merch' ? 'merch' : s.view === 'gallery' ? 'gallery' : navOn ? 'events' : 'home';
    const routed = (k: string) => k === 'events' || k === 'merch' || k === 'gallery';
    const navLinks = LINKS.map(([label, k]) => ({
      label: label.toUpperCase(), name: label, cur: String(k === act) as 'true' | 'false', o: k === act ? 1 : .68, bar: k === act ? 1 : 0, dc: k === act ? 'oklch(0.8 0.12 85)' : '#ECE8DF',
      href: k === 'events' ? '#/worlds/' + w.slug : k === 'merch' ? '#/merch' : k === 'gallery' ? '#/gallery' : '#/',
      onClick: (e: MouseEvent<HTMLAnchorElement>) => {
        if (routed(k)) { if (this.state.about || this.state.menu) this.setState({ about: false, menu: false }); return; }
        e.preventDefault(); this.goSection(k === 'home' ? null : k);
      },
    }));
    const lines = s.bag.map((l) => ({ ...l, p: PRODUCTS.find((x) => x.id === l.key) })).filter((l): l is BagLine & { p: Product } => !!l.p);
    const count = lines.reduce((a, l) => a + l.qty, 0), total = lines.reduce((a, l) => a + l.qty * l.p.price, 0);
    const cartOn = s.view === 'merch' && count > 0;
    return {
      navLinks, footLinks: navLinks.slice(0, 5), wide: !s.compact, menuLabel: s.compact ? 'MENU' : 'ABOUT',
      // Wide screens open the About drawer; compact screens open the full-screen menu.
      menuButton: () => { this.play('thumpSoft'); if (this.state.compact) this.setState({ menu: true }); else this.setState({ about: !this.state.about }); },
      menuExpanded: s.compact ? s.menu : s.about,
      goHome: (e: MouseEvent) => { e.preventDefault(); this.goSection(null); },
      topNav: navLinks.map((l) => ({ label: l.label, labelCap: l.name, href: l.href, menuColor: l.dc, onClick: l.onClick })),
      linkGo: this.linkGo,
      menuVis: (s.menu ? 'visible' : 'hidden') as 'visible' | 'hidden', menuDelay: s.menu ? '0s' : '.9s', menuClip: s.menu ? 'circle(150% at 100% 0%)' : 'circle(0% at 100% 0%)', menuHidden: !s.menu,
      closeMenu: () => this.setState({ menu: false }),
      tunnel: TUNNEL.map(([cap, x, y, ar], k) => ({ id: 'gallery-' + (k + 1), ph: cap + ' photo', capU: cap.toUpperCase(), no: String(k + 1).padStart(2, '0'), x, y, ar, c: TUNNEL_C[k % 3] })),
      tunnelTotal: String(TUNNEL.length).padStart(2, '0'),
      sponsors: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: 'sponsor-' + n })),
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
      labelRight: s.narrow ? '8%' : (s.compact ? '10%' : '26%'),
      arrowsDisplay: s.narrow ? 'none' : 'grid',
      backHref: '#/worlds/' + w.slug,
      nav: WORLDS.map((x, k) => ({ no: String(k + 1).padStart(2, '0'), label: x.name.toUpperCase(), current: k === i, color: k === i ? '#ECE8DF' : 'rgba(20,19,18,.72)', onClick: () => this.navTo(k) })),
      navX: (i * 100) + '%',
      navGlow: '#141312',
      navO: navOn ? 1 : 0, navY: navOn ? '0px' : '30px', navPE: (navOn ? 'auto' : 'none') as 'auto' | 'none',
      navBottom: s.narrow ? 'calc(clamp(16px,2.6vw,44px) + 40px)' : 'clamp(16px,2.6vw,44px)',
      muted: s.muted, soundOn: !s.muted, soundLabel: s.muted ? 'Turn sound on' : 'Turn sound off', toggleSound: this.toggleSound,
      aboutVis: (s.about ? 'visible' : 'hidden') as 'visible' | 'hidden', aboutDelay: s.about ? '0s' : '.8s', aboutO: s.about ? 1 : 0, aboutX: s.about ? '0%' : '100%',
      aboutHidden: !s.about,
      openAbout: (e?: MouseEvent) => { if (e) e.preventDefault(); this.play('thumpSoft'); this.setState({ about: true, menu: false }); },
      closeAbout: () => this.setState({ about: false }),
      toTop: (e: MouseEvent) => { e.preventDefault(); const h = this.$('[data-view="home"]'); if (h) h.scrollTo({ top: 0, behavior: 'smooth' }); },
      toastO: s.toastOn ? 1 : 0, toastY: s.toastOn ? '0px' : '16px',
      register: this.register, hover: this.hover, beep: this.beep,
      curtainLabel: s.curtainLabel, curtainKicker: s.curtainKicker,
      prevSlide: () => this.stepSlide(-1), nextSlide: () => this.stepSlide(1),
      onWheel: this.onWheel, onTouchStart: this.onTouchStart, onTouchEnd: this.onTouchEnd,
      // gallery page
      gallery: GALLERY.map((g, k) => ({ ...g, onFocus: () => { this.play('beep'); this.gTarget = k * GAP + 200; } })),
      gDust: Array.from({ length: 46 }, (_, k) => ({ s: (k % 3 === 0 ? 3 : 2) + 'px' })),
      gCur: GALLERY[s.gIdx], gTotal: String(GALLERY.length).padStart(2, '0'),
      gRestart: () => { this.gTarget = 0; },
      gWheel: this.gWheel, gTouchStart: this.gTouchStart, gTouchMove: this.gTouchMove,
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
        <Hud v={v} />
        <WorldNav v={v} />
        <Curtain v={v} />
        <AboutPanel v={v} />
        <MenuOverlay v={v} />
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
