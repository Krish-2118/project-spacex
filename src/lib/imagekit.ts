// ImageKit hosts event posters and gallery images only. Payment proofs live in the private Supabase Storage bucket
// (see src/lib/payment-proofs.ts).
import ImageKit from 'imagekit';

const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || '';

export const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '',
  privateKey,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '',
});
