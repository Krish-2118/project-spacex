import ImageKit from 'imagekit';

const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || '';

export const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '',
  privateKey,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '',
});

/** Lifetime of the signed links staff get for private payment screenshots. */
export const PAYMENT_PROOF_URL_TTL_SECONDS = 300;

/**
 * Short-lived signed URL for a private ImageKit file. `src` must be a URL under the configured URL endpoint.
 * The expiry is always set: without it the SDK signs with a timestamp that never expires.
 */
export function signedImageKitUrl(src: string, expireSeconds: number = PAYMENT_PROOF_URL_TTL_SECONDS): string {
  if (!privateKey) throw new Error('IMAGEKIT_PRIVATE_KEY is not configured');
  const ttl = Math.min(Math.max(Math.floor(expireSeconds) || 0, 1), 3600);
  return imagekit.url({ src, signed: true, expireSeconds: ttl });
}
