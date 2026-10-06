// Signed URLs for private payment screenshots: valid signature, short expiry, never the SDK's "no expiry" default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const ENDPOINT = 'https://ik.imagekit.io/demo';
const PRIVATE_KEY = 'private_test_key';
process.env.IMAGEKIT_URL_ENDPOINT = ENDPOINT;
process.env.IMAGEKIT_PUBLIC_KEY = 'public_test_key';
process.env.IMAGEKIT_PRIVATE_KEY = PRIVATE_KEY;

const { signedImageKitUrl, PAYMENT_PROOF_URL_TTL_SECONDS } = await import('../../src/lib/imagekit.ts');

const SRC = `${ENDPOINT}/innovision/payments/payment_1_abc.png`;
const now = () => Math.floor(Date.now() / 1000);

test('signed payment-proof URL carries a valid HMAC signature and a short expiry', () => {
  const signed = new URL(signedImageKitUrl(SRC));
  const expiry = Number(signed.searchParams.get('ik-t'));
  const signature = signed.searchParams.get('ik-s');

  assert.equal(`${signed.origin}${signed.pathname}`, SRC);
  assert.ok(PAYMENT_PROOF_URL_TTL_SECONDS <= 600, 'TTL must stay short');
  assert.ok(Math.abs(expiry - (now() + PAYMENT_PROOF_URL_TTL_SECONDS)) <= 5, `expiry ${expiry}`);
  assert.notEqual(signed.searchParams.get('ik-t'), '9999999999');

  // ImageKit's scheme: HMAC-SHA1(privateKey, <path after the URL endpoint> + <expiry>).
  const expected = createHmac('sha1', PRIVATE_KEY).update(`innovision/payments/payment_1_abc.png${expiry}`).digest('hex');
  assert.equal(signature, expected);
});

test('expiry is clamped: zero/negative/huge values never produce a non-expiring or long-lived URL', () => {
  for (const ttl of [0, -5, NaN, 1e9]) {
    const expiry = Number(new URL(signedImageKitUrl(SRC, ttl)).searchParams.get('ik-t'));
    assert.ok(expiry > now() && expiry <= now() + 3600 + 5, `ttl ${ttl} gave expiry ${expiry}`);
  }
});
