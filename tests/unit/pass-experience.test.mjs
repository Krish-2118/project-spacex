import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { isApprovedPass, passStatusMessage } from '../../src/lib/pass-experience.ts';

const pass = { registrationStatus: 'confirmed', passStatus: 'active', registrationId: 'IV26-1024', name: 'A real participant', college: 'Their own college', token: null, checkedIn: false };
test('only a complete, server-confirmed active pass is eligible; QR is optional', () => {
  assert.equal(isApprovedPass(pass), true);
  for (const registrationStatus of ['none', 'pending', 'rejected']) {
    assert.equal(isApprovedPass({ ...pass, registrationStatus }), false);
    assert.doesNotMatch(passStatusMessage({ ...pass, registrationStatus }), /payment has been verified/i);
  }
  for (const passStatus of ['none', 'revoked']) assert.equal(isApprovedPass({ ...pass, passStatus }), false);
  for (const field of ['name', 'college', 'registrationId']) assert.equal(isApprovedPass({ ...pass, [field]: null }), false);
});

test('real PostgreSQL acknowledgement lifecycle, ownership, RLS, contention and lease recovery', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE registrations (id uuid PRIMARY KEY, user_id uuid, registration_id text, name text, college text, status text, created_at timestamptz default now());
      CREATE TABLE entry_passes (id uuid PRIMARY KEY, registration_id uuid REFERENCES registrations(id), status text);
      INSERT INTO registrations VALUES ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','IV26-1024','Participant One','College One','pending',now());
      INSERT INTO registrations VALUES ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','IV26-2048','Participant Two','College Two','confirmed',now());
      INSERT INTO entry_passes VALUES ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','active');
      INSERT INTO entry_passes VALUES ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','active');
    `);
    await db.exec(await readFile(new URL('../../supabase/manual/pass_experience.sql', import.meta.url), 'utf8'));
    // Idempotent migration, safe to apply alongside schema.sql.
    await db.exec(await readFile(new URL('../../supabase/manual/pass_experience.sql', import.meta.url), 'utf8'));
    const user = async n => db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '20000000-0000-0000-0000-00000000000${n}';`);
    const call = async (fn, n) => (await db.query(`select ${fn}($1::uuid) as result`, [`40000000-0000-0000-0000-00000000000${n}`])).rows[0].result;
    await user(1);
    assert.equal(await call('claim_pass_experience', 1), 'ineligible');
    assert.equal(await call('acknowledge_pass_experience', 1), false);
    await assert.rejects(db.query('SELECT * FROM pass_experiences'), /permission denied/);
    await db.exec("RESET ROLE; UPDATE registrations SET status='rejected' WHERE registration_id='IV26-1024';");
    await user(1); assert.equal(await call('claim_pass_experience', 1), 'ineligible');
    await db.exec("RESET ROLE; UPDATE registrations SET status='confirmed' WHERE registration_id='IV26-1024';");
    await user(1);
    const competing = await Promise.all([call('claim_pass_experience', 1), call('claim_pass_experience', 2)]);
    assert.deepEqual(competing.sort(), ['busy', 'claimed']);
    assert.equal(await call('claim_pass_experience', 1), 'busy');
    await db.exec('RESET ROLE');
    assert.equal((await db.query('select seen_at from pass_experiences')).rows[0].seen_at, null, 'claiming/loading is not acknowledgement');
    await user(2);
    assert.equal(await call('acknowledge_pass_experience', 1), false, 'another account cannot acknowledge the first account');
    assert.equal(await call('claim_pass_experience', 3), 'claimed');
    await user(1);
    assert.equal(await call('acknowledge_pass_experience', 9), false, 'wrong tab claim cannot acknowledge');
    assert.equal(await call('acknowledge_pass_experience', 1), true);
    assert.equal(await call('acknowledge_pass_experience', 1), true, 'idempotent acknowledgement');
    assert.equal(await call('claim_pass_experience', 2), 'seen', 'refresh/revisit never replays');
    await db.exec("RESET ROLE; UPDATE pass_experiences SET claim_until=now()-interval '1 minute' WHERE registration_id='10000000-0000-0000-0000-000000000002';");
    await user(2); assert.equal(await call('claim_pass_experience', 4), 'claimed', 'abandoned unpresented lease is recoverable');
    assert.equal(await call('acknowledge_pass_experience', 3), false, 'expired claimant cannot acknowledge a replacement claim');
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('select status from registrations order by registration_id')).rows.map(r => r.status), ['confirmed', 'confirmed'], 'acknowledgement never changes payment status');
    await db.exec("SET ROLE authenticated; SET request.jwt.claim.sub = '';");
    await assert.rejects(call('claim_pass_experience', 1), /Sign in required/);
  } finally { await db.close(); }
});
