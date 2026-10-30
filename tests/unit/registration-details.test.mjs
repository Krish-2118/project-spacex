import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRegistrationInput } from '../../src/lib/security.ts';

const ownerId = '20000000-0000-4000-8000-000000000001';
const details = {
  name: 'Ananya Rao', college: '  Example   Institute of Technology  ',
  phone: '9876543210', gender: 'female', enrollment_no: ' CS/2026-42 ',
  payment_proof_path: `${ownerId}/30000000-0000-4000-8000-000000000001.jpg`,
  id_card_path: `${ownerId}/30000000-0000-4000-8000-000000000002.jpg`,
  utr: '123456789012',
};

test('registration retains the entered college and roll number', () => {
  const result = validateRegistrationInput(details, { ownerId });
  assert.equal(result.ok, true);
  assert.equal(result.data.college, 'Example Institute of Technology');
  assert.equal(result.data.enrollment_no, 'CS/2026-42');
});

test('every participant must provide a college and a roll number', () => {
  for (const field of ['college', 'enrollment_no']) {
    for (const value of ['', '   ', undefined]) {
      const result = validateRegistrationInput({ ...details, [field]: value }, { ownerId });
      assert.equal(result.ok, false);
      assert.equal(result.field, field);
    }
  }
});
