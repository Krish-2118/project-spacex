// Static guards for security invariants that are hard to exercise without a live Supabase project.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8').replace(/\r\n/g, '\n');

function routeFiles(dir) {
  const out = [];
  for (const name of readdirSync(new URL(dir, root))) {
    const rel = join(dir, name).replace(/\\/g, '/');
    if (statSync(new URL(rel, root)).isDirectory()) out.push(...routeFiles(rel));
    else if (name === 'route.ts') out.push(rel);
  }
  return out;
}

test('every /api/admin route handler checks staff/admin authorization first', () => {
  const files = routeFiles('src/app/api/admin');
  assert.ok(files.length >= 4);
  for (const file of files) {
    const src = read(file);
    const handlers = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b[\s\S]*?(?=\nexport |$)/g)];
    assert.ok(handlers.length > 0, `${file} has no handlers`);
    for (const [body, method] of handlers) {
      assert.match(body, /await verify(Staff|Admin)\(req\)/, `${file} ${method} must call verifyStaff/verifyAdmin`);
    }
    // No route-local copies of the auth helper that could drift from the shared one.
    assert.doesNotMatch(src, /async function verify(Staff|Admin)/, `${file} must use the shared auth helper`);
  }
});

test('user-facing write routes authenticate the caller', () => {
  for (const file of ['src/app/api/upload/route.ts', 'src/app/api/register/route.ts', 'src/app/api/auth/profile/route.ts']) {
    assert.match(read(file), /await getAuthenticatedUser\(req/, `${file} must authenticate the caller`);
  }
  // The profile route must not trust a userId from the request body.
  assert.doesNotMatch(read('src/app/api/auth/profile/route.ts'), /const uid = userId/);
});

test('proxy applies the cross-site check to every API route', () => {
  const src = read('src/proxy.ts');
  assert.match(src, /export function proxy\(/);
  assert.match(src, /'\/api\/:path\*'/);
  assert.match(src, /isCrossSiteMutation\(request\)/);
});

test('schema keeps profile role protection enabled (no trailing DROP)', () => {
  const sql = read('supabase/schema.sql');
  const create = sql.indexOf('CREATE TRIGGER trg_protect_profile_fields');
  assert.ok(create > 0, 'protect_profile_fields trigger must be created');
  assert.equal(sql.indexOf('DROP TRIGGER IF EXISTS trg_protect_profile_fields', create), -1, 'trigger must not be dropped after creation');
  assert.match(sql, /BEFORE INSERT OR UPDATE ON public\.profiles/);
  assert.match(sql, /INSERT TO authenticated WITH CHECK \(auth\.uid\(\) = id AND role = 'user'\)/);
});

test('schema derives registration status/fee server-side and freezes reviewed rows', () => {
  const sql = read('supabase/schema.sql');
  assert.match(sql, /CREATE TRIGGER trg_enforce_registration_insert\s+BEFORE INSERT ON public\.registrations/);
  assert.match(sql, /CREATE TRIGGER trg_enforce_registration_review\s+BEFORE UPDATE ON public\.registrations/);
  assert.match(sql, /uq_registrations_user_id/);
});

test('API responses never return raw database/exception messages to clients', () => {
  for (const file of [...routeFiles('src/app/api')]) {
    const src = read(file);
    assert.doesNotMatch(src, /error: \w+\.message \}/, `${file} returns a raw error message`);
    assert.doesNotMatch(src, /err instanceof Error \? err\.message/, `${file} returns a raw exception message`);
  }
});

test('server auth never spends refresh tokens outside the session endpoint', () => {
  assert.doesNotMatch(read('src/lib/auth-server.ts'), /refreshSession\(/);
  for (const file of routeFiles('src/app/api')) {
    if (file.endsWith('auth/session/route.ts')) continue;
    assert.doesNotMatch(read(file), /refreshSession\(/, file);
  }
});

test('refresh tokens are only persisted as digests', () => {
  const src = read('src/app/api/auth/session/route.ts');
  const writes = [...src.matchAll(/from\('user_sessions'\)\s*\.upsert\(([\s\S]*?)\)\s*;/g)];
  assert.ok(writes.length >= 2, 'expected user_sessions writes');
  for (const [, body] of writes) {
    const value = body.match(/refresh_token: ([^,\n]+)/)?.[1];
    assert.match(value ?? '', /^hashSessionToken\(/, `user_sessions.refresh_token must be hashed, got ${value}`);
  }
});

test('next.config sets a CSP that restricts scripts, connections and framing, and no-store on private APIs', () => {
  const src = read('next.config.ts');
  for (const directive of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) {
    assert.ok(src.includes(directive), directive);
  }
  assert.match(src, /private, no-store/);
});

test('staff cannot review their own registration via the API (service role bypasses the DB trigger)', () => {
  const src = read('src/app/api/admin/registrations/route.ts');
  assert.match(src, /existing\.user_id === user\.id/);
  assert.ok(src.indexOf('existing.user_id === user.id') < src.indexOf(".update({"), 'check must precede the update');
});

test('gallery deletion verifies the ImageKit folder before using the private key', () => {
  const src = read('src/app/api/admin/gallery/route.ts');
  assert.ok(src.indexOf('isImageKitPathInFolder(') > 0);
  assert.ok(src.indexOf('isImageKitPathInFolder(') < src.indexOf('imagekit.deleteFile('));
});

test('payment screenshots are uploaded as private ImageKit files', () => {
  assert.match(read('src/app/api/upload/route.ts'), /isPrivateFile: true/);
});

test('payment screenshots are only viewable by staff via short-lived signed URLs', () => {
  const route = read('src/app/api/admin/registrations/payment-proof/route.ts');
  assert.match(route, /await verifyStaff\(req\)/);
  assert.ok(route.indexOf('verifyStaff(req)') < route.indexOf('signedImageKitUrl('), 'authorize before signing');
  assert.match(route, /isImageKitUrlInFolder\(stored, endpoint, '\/innovision\/payments'\)/, 'only sign our own payment uploads');

  const dashboard = read('src/components/innovision/AdminDashboard.tsx');
  assert.match(dashboard, /\/api\/admin\/registrations\/payment-proof\?id=/);
  assert.doesNotMatch(dashboard, /setPreviewImage\(\{ url: reg\.payment_screenshot_url/, 'must not preview the raw stored URL');
});
