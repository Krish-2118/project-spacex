'use client';

import { useEffect, useRef } from 'react';
import { decryptFrame } from '@/lib/decrypt-text';
import styles from './decrypt-text.module.css';

/** Changes only a decorative text node; assistive technology always reads the real name. */
export default function DecryptText({ text, animate = false }: { text: string; animate?: boolean }) {
  const output = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = output.current;
    if (!node) return;
    node.textContent = text;
    if (!animate) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const finish = () => { stopped = true; clearTimeout(timer); node.textContent = text; };
    const onVisibility = () => { if (document.hidden) finish(); };
    const onMotion = () => { if (reduced.matches) finish(); };
    timer = setTimeout(() => {
      const start = performance.now();
      let tick = 0;
      const draw = () => {
        if (stopped) return;
        const progress = Math.min(1, (performance.now() - start) / 1200);
        node.textContent = decryptFrame(text, progress, tick++);
        if (progress < 1) timer = setTimeout(draw, 45);
        else finish();
      };
      draw();
    }, 350);
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotion);
    return () => {
      finish();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotion);
    };
  }, [text, animate]);

  return <span className={styles.root}><span className={styles.accessible}>{text}</span><span ref={output} className={styles.visual} aria-hidden="true">{text}</span></span>;
}
