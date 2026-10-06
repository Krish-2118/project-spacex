// Regression tests for the security helpers. Run with `npm test` (Node >= 22, uses --experimental-strip-types).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clientIp,
  createRateLimiter,
  hashSessionToken,
  detectFileType,
  generateRegistrationId,
  isCrossSiteMutation,
  isFilterSafeEmail,
  isImageKitPathInFolder,
  isImageKitUrlInFolder,
  isRegistrationUploadFolder,
  isUuid,
  REGISTRATION_GENDERS,
  REGISTRATION_UPLOAD_FOLDERS,
  sanitizeFilterValue,
  validateRegistrationInput,
} from '../../src/lib/security.ts';
import { csvCell, GENDER_OPTIONS, isGender, isValidGoogleDriveUrl, safeHttpUrl } from '../../src/lib/validation.ts';

const ENDPOINT = 'https://ik.imagekit.io/demo';
// A file uploaded to a different folder (e.g. a gallery image); must never pass as a payment proof.
const OTHER_URL = `${ENDPOINT}/innovision/gallery/gallery_1_abc.webp`;
const PAY_URL = `${ENDPOINT}/innovision/payments/payment_1_abc.png`;

const headers = (h) => ({ get: (k) => h[k.toLowerCase()] ?? null });

const pad = (arr) => {
  const out = new Uint8Array(16);
  out.set(arr);
  return out;
};
const bytes = (s) => pad([...s].map((c) => c.charCodeAt(0)));

test('detectFileType identifies files by magic bytes, not by name', () => {
  assert.equal(detectFileType(pad([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(detectFileType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(detectFileType(bytes('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(detectFileType(bytes('%PDF-1.7')), 'pdf');
  assert.equal(detectFileType(bytes('GIF89a')), 'gif');
  assert.equal(detectFileType(bytes('\0\0\0\x18ftypheic')), 'heic');
  // HTML / SVG / scripts disguised as images are rejected
  assert.equal(detectFileType(bytes('<html><script>')), null);
  assert.equal(detectFileType(bytes('<svg onload=x>')), null);
  assert.equal(detectFileType(new Uint8Array(4)), null);
});

test('upload folders are allowlisted; only payment screenshots (images, never PDFs)', () => {
  assert.equal(isRegistrationUploadFolder('/innovision/payments'), true);
  assert.equal(isRegistrationUploadFolder('/innovision/id_cards'), false); // ID card upload was removed
  assert.deepEqual(Object.keys(REGISTRATION_UPLOAD_FOLDERS), ['/innovision/payments']);
  assert.equal(isRegistrationUploadFolder('/innovision/events'), false);
  assert.equal(isRegistrationUploadFolder('/'), false);
  assert.equal(isRegistrationUploadFolder('__proto__'), false);
  assert.equal(isRegistrationUploadFolder(null), false);
  assert.ok(!REGISTRATION_UPLOAD_FOLDERS['/innovision/payments'].includes('pdf'));
});

test('isImageKitUrlInFolder only accepts our own ImageKit uploads', () => {
  assert.equal(isImageKitUrlInFolder(PAY_URL, ENDPOINT, '/innovision/payments'), true);
  assert.equal(isImageKitUrlInFolder(PAY_URL, `${ENDPOINT}/`, '/innovision/payments'), true);
  assert.equal(isImageKitUrlInFolder(OTHER_URL, ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder('javascript:alert(document.cookie)', ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder('data:text/html,<script>', ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder('http://ik.imagekit.io/demo/innovision/payments/a.jpg', ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder('https://evil.example/demo/innovision/payments/a.jpg', ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder('https://ik.imagekit.io/other/innovision/payments/a.jpg', ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder(`${ENDPOINT}/innovision/payments/`, ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder(`${ENDPOINT}/innovision/payments/%2e%2e/x.jpg`, ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder('https://user:pw@ik.imagekit.io/demo/innovision/payments/a.jpg', ENDPOINT, '/innovision/payments'), false);
  assert.equal(isImageKitUrlInFolder(42, ENDPOINT, '/innovision/payments'), false);
});

test('validateRegistrationInput: external registration happy path', () => {
  const r = validateRegistrationInput(
    {
      name: '  Ada   Lovelace ',
      college: 'Some College',
      phone: '+91 98765 43210',
      enrollment_no: 'CS-21/001',
      gender: ' Female ',
      payment_screenshot_url: PAY_URL,
      utr: '1234 5678 9012',
    },
    { isInternal: false, imagekitEndpoint: ENDPOINT }
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, {
    name: 'Ada Lovelace',
    college: 'Some College',
    phone: '9876543210',
    enrollment_no: 'CS-21/001',
    gender: 'female',
    payment_screenshot_url: PAY_URL,
    utr: '123456789012',
  });
});

test('validateRegistrationInput rejects stored-XSS URLs and malformed fields', () => {
  const base = {
    name: 'Ada Lovelace',
    college: 'Some College',
    phone: '9876543210',
    gender: 'male',
    payment_screenshot_url: PAY_URL,
    utr: '123456789012',
  };
  const opts = { isInternal: false, imagekitEndpoint: ENDPOINT };
  const bad = (patch) => validateRegistrationInput({ ...base, ...patch }, opts).ok;

  assert.equal(bad({}), true);
  assert.equal(bad({ payment_screenshot_url: 'javascript:alert(1)' }), false);
  assert.equal(bad({ payment_screenshot_url: 'https://evil.example/x.png' }), false);
  assert.equal(bad({ payment_screenshot_url: OTHER_URL }), false); // wrong folder
  assert.equal(bad({ payment_screenshot_url: undefined }), false);
  assert.equal(bad({ utr: '1234' }), false);
  assert.equal(bad({ phone: '12345' }), false);
  assert.equal(bad({ name: { $ne: 1 } }), false);
  assert.equal(bad({ name: 'x'.repeat(101) }), false);
  assert.equal(bad({ college: 'y'.repeat(201) }), false);
  assert.equal(bad({ enrollment_no: '<img src=x>' }), false);
  assert.equal(bad({ utr: ['123456789012'] }), false);
  assert.equal(validateRegistrationInput(null, opts).ok, false);
  assert.equal(validateRegistrationInput([], opts).ok, false);
});

test('validateRegistrationInput: internal students never store client-supplied proof URLs', () => {
  const r = validateRegistrationInput(
    {
      name: 'Internal Student',
      college: 'NIT',
      phone: '9876543210',
      enrollment_no: '121CS0001',
      gender: 'others',
      payment_screenshot_url: 'javascript:alert(2)',
      utr: 'whatever',
    },
    { isInternal: true, imagekitEndpoint: ENDPOINT }
  );
  assert.equal(r.ok, true);
  assert.equal(r.data.gender, 'others');
  assert.equal(r.data.payment_screenshot_url, null);
  assert.equal(r.data.utr, null);
});

test('generateRegistrationId keeps the IV26-NNNN format the UI expects', () => {
  for (let i = 0; i < 200; i++) assert.match(generateRegistrationId(), /^IV26-\d{4}$/);
});

test('sanitizeFilterValue strips PostgREST filter syntax', () => {
  assert.equal(sanitizeFilterValue('alice'), 'alice');
  assert.equal(sanitizeFilterValue('x%,status.eq.confirmed'), 'x status.eq.confirmed');
  assert.ok(!/[,()"*%:\\]/.test(sanitizeFilterValue('a),or(role.eq.admin,"b":*\\')));
  assert.equal(sanitizeFilterValue('a'.repeat(500)).length, 100);
  assert.equal(sanitizeFilterValue(undefined), '');
});

test('isFilterSafeEmail / isUuid', () => {
  assert.equal(isFilterSafeEmail('a.b+c@nitrkl.ac.in'), true);
  assert.equal(isFilterSafeEmail('a,user_id.neq.x@x.com'), false);
  assert.equal(isFilterSafeEmail('"a"@x.com'), false);
  assert.equal(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301'), true);
  assert.equal(isUuid('1 or 1=1'), false);
  assert.equal(isUuid(undefined), false);
});

test('isCrossSiteMutation blocks cross-site writes but allows same-origin and safe methods', () => {
  const host = 'innovision.example';
  assert.equal(isCrossSiteMutation({ method: 'GET', headers: headers({ origin: 'https://evil.example', host }) }), false);
  assert.equal(isCrossSiteMutation({ method: 'POST', headers: headers({ origin: `https://${host}`, host }) }), false);
  assert.equal(isCrossSiteMutation({ method: 'POST', headers: headers({ origin: 'https://evil.example', host }) }), true);
  assert.equal(isCrossSiteMutation({ method: 'DELETE', headers: headers({ origin: `https://sub.${host}`, host }) }), true);
  assert.equal(isCrossSiteMutation({ method: 'PATCH', headers: headers({ origin: 'null', host }) }), true);
  assert.equal(isCrossSiteMutation({ method: 'POST', headers: headers({ 'sec-fetch-site': 'cross-site', host }) }), true);
  assert.equal(isCrossSiteMutation({ method: 'POST', headers: headers({ 'sec-fetch-site': 'same-origin', host }) }), false);
  // Behind a proxy the public host may only be in X-Forwarded-Host
  assert.equal(
    isCrossSiteMutation({
      method: 'POST',
      headers: headers({ origin: `https://${host}`, host: 'internal:3000', 'x-forwarded-host': host }),
    }),
    false
  );
  // Non-browser clients (no Origin / Sec-Fetch-Site) fall through to the route's own auth
  assert.equal(isCrossSiteMutation({ method: 'POST', headers: headers({ host }) }), false);
});

test('createRateLimiter enforces the limit per key and resets after the window', () => {
  const rl = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(rl.hit('a', 0), true);
  assert.equal(rl.hit('a', 10), true);
  assert.equal(rl.hit('a', 20), false);
  assert.equal(rl.hit('b', 20), true);
  assert.equal(rl.hit('a', 1001), true);
});

test('safeHttpUrl neutralises javascript:/data: URLs', () => {
  assert.equal(safeHttpUrl(PAY_URL), PAY_URL);
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl(' JaVaScRiPt:alert(1)'), null);
  assert.equal(safeHttpUrl('data:text/html,hi'), null);
  assert.equal(safeHttpUrl('/relative'), null);
  assert.equal(safeHttpUrl(undefined), null);
});

test('csvCell escapes quotes and neutralises spreadsheet formulas', () => {
  assert.equal(csvCell('plain'), '"plain"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("http://evil","x")'), '"\'=HYPERLINK(""http://evil"",""x"")"');
  assert.equal(csvCell('+1'), '"\'+1"');
  assert.equal(csvCell('@SUM(A1)'), '"\'@SUM(A1)"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(499), '"499"');
});

test('isValidGoogleDriveUrl rejects non-Drive and script URLs', () => {
  assert.equal(isValidGoogleDriveUrl('https://drive.google.com/file/d/abc/view'), true);
  assert.equal(isValidGoogleDriveUrl('javascript:alert(1)//drive.google.com/x'), false);
  assert.equal(isValidGoogleDriveUrl('https://drive.google.com.evil.example/x'), false);
});

test('hashSessionToken stores a one-way digest, never the refresh token', () => {
  const h = hashSessionToken('refresh-token-value');
  assert.match(h, /^sha256:[0-9a-f]{64}$/);
  assert.ok(!h.includes('refresh-token-value'));
  assert.equal(h, hashSessionToken('refresh-token-value'));
  assert.notEqual(h, hashSessionToken('other'));
});

test('clientIp prefers the Cloudflare-set header over spoofable forwarding headers', () => {
  assert.equal(clientIp(headers({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '6.6.6.6' })), '1.1.1.1');
  assert.equal(clientIp(headers({ 'x-forwarded-for': '2.2.2.2, 10.0.0.1' })), '2.2.2.2');
  assert.equal(clientIp(headers({})), 'unknown');
});

test('isImageKitPathInFolder confines server-side deletions to the gallery folder', () => {
  assert.equal(isImageKitPathInFolder('/innovision/gallery/g_1.webp', '/innovision/gallery'), true);
  assert.equal(isImageKitPathInFolder('/innovision/payments/p.png', '/innovision/gallery'), false);
  assert.equal(isImageKitPathInFolder('/innovision/id_cards/i.jpg', '/innovision/gallery'), false);
  assert.equal(isImageKitPathInFolder('/innovision/gallery/../payments/p.png', '/innovision/gallery'), false);
  assert.equal(isImageKitPathInFolder('/innovision/gallery-evil/x.webp', '/innovision/gallery'), false);
  assert.equal(isImageKitPathInFolder(undefined, '/innovision/gallery'), false);
});

test('validateRegistrationInput requires gender to be male, female or others (internal and external)', () => {
  const external = { name: 'Ada Lovelace', college: 'Some College', phone: '9876543210', payment_screenshot_url: PAY_URL, utr: '123456789012' };
  const internal = { name: 'Internal Student', phone: '9876543210', enrollment_no: '121CS0001' };
  for (const [body, isInternal] of [[external, false], [internal, true]]) {
    const check = (gender) => validateRegistrationInput({ ...body, gender }, { isInternal, imagekitEndpoint: ENDPOINT });
    for (const g of ['male', 'female', 'others', 'MALE']) assert.equal(check(g).ok, true, g);
    for (const g of [undefined, '', 'other', 'unknown', 'male; drop table', 1, ['male'], { male: true }]) {
      const r = check(g);
      assert.equal(r.ok, false, String(g));
      assert.match(r.error, /gender/i);
    }
  }
});

test('gender options stay in sync between the UI and the server validator', () => {
  assert.deepEqual(GENDER_OPTIONS.map((g) => g.value), [...REGISTRATION_GENDERS]);
  assert.equal(isGender('female'), true);
  assert.equal(isGender('Female'), false);
});
