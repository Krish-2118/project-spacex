// Executes supabase/schema.sql in a local Postgres (PGlite) and attacks it as anon, a normal user, IT-Team and admin,
// exactly as those callers could through the public Supabase REST API (anon key + their own JWT).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, signUp, as, asOwner, errorOf } from './supabase-harness.mjs';

let db;
const U = {};
const anon = { role: 'anon' };
const user = (id) => ({ role: 'authenticated', id });
const service = { role: 'service_role' };

const rows = async (who, sql, params) => (await as(db, who, sql, params)).rows;
const profileOf = async (id) => (await asOwner(db, 'SELECT * FROM public.profiles WHERE id = $1', [id])).rows[0];

const PAY_URL = 'https://ik.imagekit.io/demo/innovision/payments/a.jpg';

async function insertPendingRegistration(id, regId, utr) {
  await as(db, service, `
    INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type,
      payment_screenshot_url, utr, amount, status)
    SELECT $2, p.id, 'Name', p.email, 'Some College', '9876543210', 'female', 'external', $3, $4, 499, 'pending'
    FROM public.profiles p WHERE p.id = $1`, [id, regId, PAY_URL, utr]);
}

before(async () => {
  db = await createDb({ runSchemaTwice: true }); // the script must be safely re-runnable
  U.admin = await signUp(db, 'admin@example.com');
  U.admin2 = await signUp(db, 'admin2@example.com');
  U.it = await signUp(db, 'it@example.com');
  U.alice = await signUp(db, 'alice@gmail.com', { meta: { full_name: 'Alice', role: 'admin' } });
  U.bob = await signUp(db, 'bob@gmail.com');
  U.nit = await signUp(db, 'student@nitrkl.ac.in');
  U.nitUnverified = await signUp(db, 'fake@nitrkl.ac.in', { confirmed: false });
  U.carol = await signUp(db, 'carol@gmail.com');
  await asOwner(db, `UPDATE public.profiles SET role = 'admin' WHERE id IN ($1, $2)`, [U.admin, U.admin2]);
  await asOwner(db, `UPDATE public.profiles SET role = 'it-team' WHERE id = $1`, [U.it]);
  await insertPendingRegistration(U.bob, 'IV26-2000', '200000000000');
  await insertPendingRegistration(U.carol, 'IV26-3000', '300000000000');
});

/* ------------------------------------------------ anonymous ------------------------------------------------ */

test('anon: signup trigger never trusts user metadata for role', async () => {
  assert.equal((await profileOf(U.alice)).role, 'user');
});

test('anon: cannot read or write private tables', async () => {
  for (const table of ['profiles', 'registrations', 'user_sessions']) {
    const r = await errorOf(db, anon, `SELECT * FROM public.${table}`);
    if (r === null) assert.equal((await rows(anon, `SELECT * FROM public.${table}`)).length, 0, table);
  }
  assert.notEqual(await errorOf(db, anon, `INSERT INTO public.events (title, description, poster_url, category) VALUES ('x','x','x','fun events')`), null);
  assert.notEqual(await errorOf(db, anon, `INSERT INTO public.gallery (image_url) VALUES ('https://x')`), null);
  await errorOf(db, anon, `UPDATE public.events SET title = 'pwned'`);
  await errorOf(db, anon, `DELETE FROM public.gallery`);
});

test('anon: can read public events and gallery', async () => {
  await as(db, service, `INSERT INTO public.events (title, description, poster_url, category) VALUES ('E','D','https://ik.imagekit.io/demo/p.webp','fun events')`);
  assert.ok((await rows(anon, 'SELECT id, title FROM public.events')).length >= 1);
  await rows(anon, 'SELECT id FROM public.gallery');
});

test('anon: cannot call role-probing SECURITY DEFINER functions', async () => {
  for (const fn of ['is_admin', 'is_staff', 'get_user_role']) {
    assert.match(await errorOf(db, anon, `SELECT public.${fn}($1)`, [U.admin]) ?? 'allowed', /permission denied/, fn);
  }
});

/* ------------------------------------------------ normal user ------------------------------------------------ */

test('user: cannot escalate own role, email or student type', async () => {
  await errorOf(db, user(U.alice), `UPDATE public.profiles SET role = 'admin', email = 'x@nitrkl.ac.in', student_type = 'internal' WHERE id = $1`, [U.alice]);
  const p = await profileOf(U.alice);
  assert.equal(p.role, 'user');
  assert.equal(p.email, 'alice@gmail.com');
  assert.equal(p.student_type, 'external');
});

test('user: can update own phone; cannot touch other profiles', async () => {
  await as(db, user(U.alice), `UPDATE public.profiles SET phone = '9000000001' WHERE id = $1`, [U.alice]);
  assert.equal((await profileOf(U.alice)).phone, '9000000001');
  await errorOf(db, user(U.alice), `UPDATE public.profiles SET phone = '9000000002', full_name = 'pwned' WHERE id = $1`, [U.bob]);
  assert.notEqual((await profileOf(U.bob)).full_name, 'pwned');
  assert.notEqual(await errorOf(db, user(U.alice), `INSERT INTO public.profiles (id, email, role) VALUES ($1, 'z@z.z', 'admin')`, [U.carol]), null);
});

test('user: profile upsert (client fallback path) cannot set role', async () => {
  await errorOf(db, user(U.alice), `
    INSERT INTO public.profiles (id, email, full_name, role, student_type) VALUES ($1, 'alice@gmail.com', 'Alice', 'admin', 'internal')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, student_type = EXCLUDED.student_type`, [U.alice]);
  const p = await profileOf(U.alice);
  assert.equal(p.role, 'user');
  assert.equal(p.student_type, 'external');
});

test('user: sees only own profile and registration (no IDOR)', async () => {
  const profiles = await rows(user(U.alice), 'SELECT id FROM public.profiles');
  assert.deepEqual(profiles.map((r) => r.id), [U.alice]);
  assert.equal((await rows(user(U.alice), 'SELECT id FROM public.registrations WHERE user_id = $1', [U.bob])).length, 0);
});

test('user: direct registration insert cannot skip payment or impersonate', async () => {
  await as(db, user(U.alice), `
    INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type, amount, status, reviewed_by)
    VALUES ('IV26-1111', $1, 'Alice', 'bob@gmail.com', 'C', '9876543210', 'male', 'internal', 0, 'confirmed', $2)`, [U.bob, U.admin]);
  const [r] = (await asOwner(db, `SELECT * FROM public.registrations WHERE user_id = $1`, [U.alice])).rows;
  assert.match(r.registration_id, /^IV26-\d{4}$/);
  assert.equal(r.user_id, U.alice);
  assert.equal(r.email, 'alice@gmail.com');
  assert.equal(r.status, 'pending');
  assert.equal(Number(r.amount), 499);
  assert.equal(r.student_type, 'external');
  assert.equal(r.reviewed_by, null);
});

test('user: one registration per user (race-safe unique index)', async () => {
  const err = await errorOf(db, user(U.alice), `
    INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type)
    VALUES ('IV26-1112', $1, 'Alice', 'a', 'C', '9876543210', 'male', 'external')`, [U.alice]);
  assert.match(err ?? '', /duplicate key|unique/i);
});

test('user: a UTR can only be used once', async () => {
  const dave = await signUp(db, 'dave@gmail.com');
  const err = await errorOf(db, user(dave), `
    INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type, utr)
    VALUES ('IV26-1113', $1, 'Dave', 'd', 'C', '9876543210', 'male', 'external', '200000000000')`, [dave]);
  assert.match(err ?? '', /duplicate key|unique/i);
});

test('user: unverified @nitrkl.ac.in address does not get the free confirmed tier', async () => {
  await as(db, user(U.nitUnverified), `
    INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type, status, amount)
    VALUES ('IV26-1114', $1, 'F', 'f', 'C', '9876543210', 'male', 'internal', 'confirmed', 0)`, [U.nitUnverified]);
  const [r] = (await asOwner(db, `SELECT status, amount FROM public.registrations WHERE user_id = $1`, [U.nitUnverified])).rows;
  assert.equal(r.status, 'pending');
  assert.equal(Number(r.amount), 499);
});

test('user: verified NIT student is auto-confirmed', async () => {
  await as(db, user(U.nit), `
    INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type)
    VALUES ('IV26-1115', $1, 'S', 's', 'NIT', '9876543210', 'male', 'external')`, [U.nit]);
  const [r] = (await asOwner(db, `SELECT status, amount, student_type FROM public.registrations WHERE user_id = $1`, [U.nit])).rows;
  assert.deepEqual([r.status, Number(r.amount), r.student_type], ['confirmed', 0, 'internal']);
});

test('user: cannot approve, edit or delete registrations', async () => {
  await errorOf(db, user(U.alice), `UPDATE public.registrations SET status = 'confirmed', amount = 0 WHERE user_id = $1`, [U.alice]);
  await errorOf(db, user(U.alice), `DELETE FROM public.registrations WHERE user_id = $1`, [U.alice]);
  const [r] = (await asOwner(db, `SELECT status FROM public.registrations WHERE user_id = $1`, [U.alice])).rows;
  assert.equal(r.status, 'pending');
});

test('user: ITER/SOA colleges are rejected by the database too', async () => {
  const erin = await signUp(db, 'erin@gmail.com');
  const err = await errorOf(db, user(erin), `
    INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type)
    VALUES ('IV26-1116', $1, 'E', 'e', 'ITER Bhubaneswar', '9876543210', 'male', 'external')`, [erin]);
  assert.match(err ?? '', /registrations_no_iter_soa|check constraint/i);
});

test('user: direct REST insert still enforces payload validation (no stored XSS / junk)', async () => {
  const frank = await signUp(db, 'frank@gmail.com');
  const insert = (patch) => {
    const v = { name: 'Frank', college: 'Some College', phone: '9876543210', gender: 'male', utr: '400000000000', payment_screenshot_url: PAY_URL, ...patch };
    return errorOf(db, user(frank), `
      INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type, utr, payment_screenshot_url)
      VALUES ('IV26-1117', $1, $2, 'f', $3, $4, $5, 'external', $6, $7)`,
      [frank, v.name, v.college, v.phone, v.gender, v.utr, v.payment_screenshot_url]);
  };
  assert.match(await insert({ payment_screenshot_url: 'javascript:alert(document.cookie)' }) ?? '', /payment_screenshot_url/);
  assert.match(await insert({ gender: null }) ?? '', /gender/);
  assert.match(await insert({ gender: 'unknown' }) ?? '', /gender/);
  assert.match(await insert({ gender: 'Male' }) ?? '', /gender/);
  assert.match(await insert({ payment_screenshot_url: 'data:text/html,<script>' }) ?? '', /payment_screenshot_url/);
  assert.match(await insert({ name: 'x'.repeat(5000) }) ?? '', /name/);
  assert.match(await insert({ college: 'y'.repeat(5000) }) ?? '', /college/);
  assert.match(await insert({ phone: '<b>' }) ?? '', /phone/);
  assert.match(await insert({ utr: 'not-a-utr' }) ?? '', /utr/);
  assert.equal(await insert({}), null);
});

test('user: profile fields are bounded and avatar must be https', async () => {
  assert.match(await errorOf(db, user(U.alice), `UPDATE public.profiles SET full_name = $2 WHERE id = $1`, [U.alice, 'x'.repeat(5000)]) ?? '', /full_name/);
  assert.match(await errorOf(db, user(U.alice), `UPDATE public.profiles SET avatar_url = 'javascript:alert(1)' WHERE id = $1`, [U.alice]) ?? '', /avatar_url/);
  assert.match(await errorOf(db, user(U.alice), `UPDATE public.profiles SET phone = $2 WHERE id = $1`, [U.alice, '9'.repeat(500)]) ?? '', /phone/);
});

test('anon: has no table privileges on private tables at all (defense in depth)', async () => {
  for (const table of ['profiles', 'registrations', 'user_sessions']) {
    assert.match(await errorOf(db, anon, `SELECT 1 FROM public.${table} LIMIT 1`) ?? 'allowed', /permission denied/, table);
  }
  assert.match(await errorOf(db, anon, `DELETE FROM public.events`) ?? 'allowed', /permission denied/);
});

test('user: cannot write staff content or other users sessions', async () => {
  assert.notEqual(await errorOf(db, user(U.alice), `INSERT INTO public.events (title, description, poster_url, category) VALUES ('x','x','x','fun events')`), null);
  await errorOf(db, user(U.alice), `UPDATE public.events SET title = 'pwned'`);
  assert.equal((await asOwner(db, `SELECT count(*)::int AS c FROM public.events WHERE title = 'pwned'`)).rows[0].c, 0);
  assert.notEqual(await errorOf(db, user(U.alice), `INSERT INTO public.user_sessions (user_id, refresh_token) VALUES ($1, 'x')`, [U.bob]), null);
  assert.equal((await rows(user(U.alice), 'SELECT * FROM public.user_sessions WHERE user_id = $1', [U.bob])).length, 0);
});

/* ------------------------------------------------ IT-Team ------------------------------------------------ */

test('it-team: can read all registrations but not the user directory', async () => {
  assert.ok((await rows(user(U.it), 'SELECT id FROM public.registrations')).length >= 3);
  const profiles = await rows(user(U.it), 'SELECT id FROM public.profiles');
  assert.deepEqual(profiles.map((r) => r.id), [U.it]);
});

test('it-team: review only flips status of a pending row; other columns are frozen', async () => {
  await as(db, user(U.it), `UPDATE public.registrations SET status = 'confirmed', amount = 0, name = 'pwned', reviewed_by = $2 WHERE user_id = $1`, [U.bob, U.admin]);
  const [r] = (await asOwner(db, `SELECT * FROM public.registrations WHERE user_id = $1`, [U.bob])).rows;
  assert.equal(r.status, 'confirmed');
  assert.equal(Number(r.amount), 499);
  assert.equal(r.name, 'Name');
  assert.equal(r.reviewed_by, U.it);
  assert.ok(r.reviewed_at);
});

test('it-team: reviewed registrations cannot be altered again', async () => {
  const err = await errorOf(db, user(U.it), `UPDATE public.registrations SET status = 'rejected' WHERE user_id = $1`, [U.bob]);
  assert.match(err ?? '', /cannot be altered/);
  const err2 = await errorOf(db, user(U.it), `UPDATE public.registrations SET status = 'pending' WHERE user_id = $1`, [U.carol]);
  assert.match(err2 ?? '', /cannot be altered/);
});

test('it-team: cannot approve their own registration (segregation of duties)', async () => {
  const it2 = await signUp(db, 'it2@gmail.com');
  await asOwner(db, `UPDATE public.profiles SET role = 'it-team' WHERE id = $1`, [it2]);
  await insertPendingRegistration(it2, 'IV26-4000', '500000000000');
  const err = await errorOf(db, user(it2), `UPDATE public.registrations SET status = 'confirmed' WHERE user_id = $1`, [it2]);
  assert.match(err ?? '', /own registration/);
  const [r] = (await asOwner(db, `SELECT status FROM public.registrations WHERE user_id = $1`, [it2])).rows;
  assert.equal(r.status, 'pending');
});

test('it-team: cannot repoint a gallery row at another storage file', async () => {
  await as(db, service, `INSERT INTO public.gallery (title, image_url, file_id) VALUES ('G', 'https://ik.imagekit.io/demo/innovision/gallery/g.webp', 'gallery-file-1')`);
  await as(db, user(U.it), `UPDATE public.gallery SET file_id = 'payment-proof-file', image_url = 'https://ik.imagekit.io/demo/innovision/payments/p.png', title = 'Renamed' WHERE title = 'G'`);
  const [g] = (await asOwner(db, `SELECT * FROM public.gallery WHERE title = 'Renamed'`)).rows;
  assert.equal(g.file_id, 'gallery-file-1');
  assert.equal(g.image_url, 'https://ik.imagekit.io/demo/innovision/gallery/g.webp');
});

test('it-team: cannot delete registrations or escalate own role', async () => {
  await errorOf(db, user(U.it), `DELETE FROM public.registrations WHERE user_id = $1`, [U.carol]);
  assert.equal((await asOwner(db, `SELECT count(*)::int AS c FROM public.registrations WHERE user_id = $1`, [U.carol])).rows[0].c, 1);
  await errorOf(db, user(U.it), `UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [U.it]);
  assert.equal((await profileOf(U.it)).role, 'it-team');
  await errorOf(db, user(U.it), `UPDATE public.profiles SET role = 'it-team' WHERE id = $1`, [U.alice]);
  assert.equal((await profileOf(U.alice)).role, 'user');
});

test('it-team: can manage events, but brochure links must be Google Drive', async () => {
  await as(db, user(U.it), `INSERT INTO public.events (title, description, poster_url, category, brochure_url) VALUES ('T','D','https://ik.imagekit.io/demo/p.webp','main events','https://drive.google.com/file/d/x')`);
  const err = await errorOf(db, user(U.it), `INSERT INTO public.events (title, description, poster_url, category, brochure_url) VALUES ('T','D','https://ik.imagekit.io/demo/p.webp','main events','javascript:alert(1)//drive.google.com/')`);
  assert.match(err ?? '', /brochure_url/);
  const err2 = await errorOf(db, user(U.it), `INSERT INTO public.events (title, description, poster_url, category) VALUES ('T','D','javascript:alert(1)','main events')`);
  assert.match(err2 ?? '', /poster_url/);
});

test('it-team: cannot spoof authorship of events', async () => {
  await as(db, user(U.it), `INSERT INTO public.events (title, description, poster_url, category, created_by, updated_by) VALUES ('Auth','D','https://ik.imagekit.io/demo/p.webp','fun events', $1, $1)`, [U.admin]);
  const [e] = (await asOwner(db, `SELECT created_by, updated_by FROM public.events WHERE title = 'Auth'`)).rows;
  assert.equal(e.created_by, U.it);
  assert.equal(e.updated_by, U.it);
});

/* ------------------------------------------------ admin ------------------------------------------------ */

test('admin: can switch users between user and it-team', async () => {
  await as(db, user(U.admin), `UPDATE public.profiles SET role = 'it-team' WHERE id = $1`, [U.carol]);
  assert.equal((await profileOf(U.carol)).role, 'it-team');
  await as(db, user(U.admin), `UPDATE public.profiles SET role = 'user' WHERE id = $1`, [U.carol]);
  assert.equal((await profileOf(U.carol)).role, 'user');
});

test('admin: cannot grant admin, demote another admin, or demote self', async () => {
  await errorOf(db, user(U.admin), `UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [U.alice]);
  assert.equal((await profileOf(U.alice)).role, 'user');
  await errorOf(db, user(U.admin), `UPDATE public.profiles SET role = 'user' WHERE id = $1`, [U.admin2]);
  assert.equal((await profileOf(U.admin2)).role, 'admin');
  await errorOf(db, user(U.admin), `UPDATE public.profiles SET role = 'user' WHERE id = $1`, [U.admin]);
  assert.equal((await profileOf(U.admin)).role, 'admin');
});

test('admin: cannot rewrite user identity columns', async () => {
  await errorOf(db, user(U.admin), `UPDATE public.profiles SET email = 'admin-owned@x.com', student_type = 'internal' WHERE id = $1`, [U.alice]);
  const p = await profileOf(U.alice);
  assert.equal(p.email, 'alice@gmail.com');
  assert.equal(p.student_type, 'external');
});

test('admin: can read the user directory', async () => {
  assert.ok((await rows(user(U.admin), 'SELECT id FROM public.profiles')).length >= 7);
});

/* ------------------------------------------------ service role ------------------------------------------------ */

test('service_role (server API) keeps full access', async () => {
  await as(db, service, `UPDATE public.profiles SET role = 'it-team' WHERE id = $1`, [U.bob]);
  assert.equal((await profileOf(U.bob)).role, 'it-team');
  await as(db, service, `UPDATE public.profiles SET role = 'user' WHERE id = $1`, [U.bob]);
});

/* ------------------------------------------------ schema shape ------------------------------------------------ */

test('registrations: no ID-card column; gender accepts male, female and others', async () => {
  const cols = (await asOwner(db, `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'registrations'`)).rows.map((r) => r.column_name);
  assert.ok(!cols.includes('id_card_url'));
  assert.ok(cols.includes('gender'));
  for (const gender of ['male', 'female', 'others']) {
    const uid = await signUp(db, `g-${gender}@gmail.com`);
    await as(db, user(uid), `
      INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type)
      VALUES ('IV26-1118', $1, 'G', 'g', 'Some College', '9876543210', $2, 'external')`, [uid, gender]);
    const [r] = (await asOwner(db, `SELECT gender FROM public.registrations WHERE user_id = $1`, [uid])).rows;
    assert.equal(r.gender, gender);
  }
});
