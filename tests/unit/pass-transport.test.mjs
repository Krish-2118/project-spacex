import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passRequestInit } from '../../src/lib/pass-experience.ts';

test('pass access uses the token-minting POST contract and never caches participant data', () => {
  const options = passRequestInit(undefined, 'fixture-session');
  assert.equal(options.method, 'POST');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.headers.Authorization, 'Bearer fixture-session');
  assert.equal(options.body, undefined);
  assert.equal(options.headers['Content-Type'], undefined);
});

test('only explicit acknowledgement/claim bodies use a keepalive POST', () => {
  const body = { action: 'acknowledge', claim: 'fixture-claim' };
  const options = passRequestInit(body, 'fixture-session');
  assert.equal(options.method, 'POST');
  assert.equal(options.keepalive, true);
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(options.body), body);
});
