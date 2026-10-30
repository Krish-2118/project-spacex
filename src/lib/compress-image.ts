/**
 * Browser only. Shrinks a large photo before it is uploaded (college ID cards straight from a phone camera are often
 * 3-6 MB): re-encoded as a JPEG no larger than MAX_EDGE pixels on its longest side. Small files, and anything the
 * browser can't decode (e.g. HEIC outside Safari), are returned unchanged and the server's own limit applies.
 */

const MAX_EDGE = 1800;
const QUALITIES = [0.85, 0.7, 0.55];

/** Width and height that fit within `maxEdge` on the longest side, keeping the aspect ratio (never upscaled). */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function shrinkImage(file: File, targetBytes: number): Promise<File> {
  if (file.size <= targetBytes || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap: ImageBitmap;
  try {
    // from-image: phone photos are stored sideways with an EXIF rotation; draw them the way they are seen.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG has no transparency: a transparent PNG would otherwise turn black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    let best: Blob | null = null;
    for (const q of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
      if (!blob) break;
      best = blob;
      if (blob.size <= targetBytes) break;
    }
    if (!best || best.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]*$/, '') + '.jpg';
    return new File([best], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
