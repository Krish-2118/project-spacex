import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decryptFrame } from '../../src/lib/decrypt-text.ts';

test('the decrypt effect always resolves to the exact participant name', () => {
  for (const name of ['Ananya Rao', 'Élodie O’Connor', 'आरव कुमार', '李明']) {
    assert.equal(decryptFrame(name, 1, 99), name);
    assert.equal(decryptFrame(name, 2, 99), name);
  }
});

test('the intermediate mask preserves name spacing and punctuation', () => {
  const name = 'A Rao-Singh';
  const mask = decryptFrame(name, 0, 3);
  assert.equal(mask.length, name.length);
  assert.equal(mask[1], ' ');
  assert.equal(mask[5], '-');
  assert.equal(decryptFrame(name, .5, 3).slice(0, 5), name.slice(0, 5));
});
