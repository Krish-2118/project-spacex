import type { CSSProperties } from 'react';
import { SLOT_IMAGES } from './data';

interface Props {
  id: string;
  shape?: 'rect' | 'rounded' | 'circle' | 'pill';
  fit?: 'cover' | 'contain';
  placeholder?: string;
  style?: CSSProperties;
  /** Strength of the home page's attract-to-cursor effect (data-attract). */
  attract?: string;
}

const RADIUS = { rect: '', rounded: '12px', circle: '50%', pill: '9999px' };

/**
 * Image placeholder matching the design's <image-slot>: shows the slot's image when one is
 * configured in SLOT_IMAGES, otherwise an empty frame with an icon and caption.
 */
export default function ImageSlot({ id, shape = 'rounded', fit = 'cover', placeholder = 'Drop an image', style, attract }: Props) {
  const img = SLOT_IMAGES[id];
  const radius = RADIUS[shape];
  return (
    <div data-slot={id} data-attract={attract} className="image-slot" style={style}>
      <div className="image-slot-frame" style={{ borderRadius: radius }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.src} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: img.fit ?? fit }} />
        ) : (
          <>
            <div className="image-slot-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <div className="image-slot-cap">{placeholder}</div>
            </div>
            <div className="image-slot-ring" style={{ borderRadius: radius }}></div>
          </>
        )}
      </div>
    </div>
  );
}
