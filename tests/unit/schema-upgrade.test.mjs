// Applying the current supabase/schema.sql over a database created by the original committed schema
// (fixtures/schema-legacy.sql) must keep existing data and leave the new registration flow working.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDb, signUp, as, asOwner, errorOf } from './supabase-harness.mjs';

const LEGACY_SQL = readFileSync(new URL('./fixtures/schema-legacy.sql', import.meta.url), 'utf8');

test('upgrade from the legacy schema: old rows kept, ID card optional, gender required for new rows', async () => {
  let legacyUser;
  const db = await createDb({
    beforeSchema: async (d) => {
      await d.exec(LEGACY_SQL);
      legacyUser = await signUp(d, 'legacy@gmail.com');
      await d.query(`
        INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, student_type, id_card_url, amount, status)
        VALUES ('IV26-9999', $1, 'Legacy', 'legacy@gmail.com', 'Some College', '9876543210', 'external',
                'https://ik.imagekit.io/demo/innovision/id_cards/old.jpg', 499, 'pending')`, [legacyUser]);
    },
  });

  // Legacy row and its data survive (the id_card_url column is only dropped if the optional line is uncommented).
  const [legacy] = (await asOwner(db, `SELECT * FROM public.registrations WHERE registration_id = 'IV26-9999'`)).rows;
  assert.equal(legacy.user_id, legacyUser);
  assert.equal(legacy.gender, null);

  // New registrations don't send an ID card and must carry a valid gender.
  const fresh = await signUp(db, 'fresh@gmail.com');
  const insert = (gender) => errorOf(db, { role: 'authenticated', id: fresh }, `
    INSERT INTO public.registrations (registration_id, user_id, name, email, college, phone, gender, student_type)
    VALUES ('IV26-1234', $1, 'Fresh', 'f', 'Some College', '9876543210', $2, 'external')`, [fresh, gender]);
  assert.match(await insert(null) ?? '', /gender/);
  assert.equal(await insert('others'), null);
  const [row] = (await asOwner(db, `SELECT gender, id_card_url FROM public.registrations WHERE user_id = $1`, [fresh])).rows;
  assert.equal(row.gender, 'others');
  assert.equal(row.id_card_url, null);

  // Staff can still review legacy rows that predate the gender column.
  const it = await signUp(db, 'it@gmail.com');
  await asOwner(db, `UPDATE public.profiles SET role = 'it-team' WHERE id = $1`, [it]);
  await as(db, { role: 'authenticated', id: it }, `UPDATE public.registrations SET status = 'confirmed' WHERE registration_id = 'IV26-9999'`);
  assert.equal((await asOwner(db, `SELECT status FROM public.registrations WHERE registration_id = 'IV26-9999'`)).rows[0].status, 'confirmed');
});
