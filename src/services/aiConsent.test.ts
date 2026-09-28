import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsentGrant, sendAiRequest } from './aiConsent';

const details = { purpose: 'Classify a barrier', fieldsShared: ['actionTitle', 'userExplanation'], fieldsNotShared: ['Goal description'], provider: 'Gemini', model: 'gemini-2.5-flash' };

test('cancel sends nothing', async () => {
  let calls = 0;
  const result = await sendAiRequest({ path: '/ai/diagnose-barrier', privacyMode: 'HIGHLY_CONFIDENTIAL', details, payload: { actionTitle: 'A', userExplanation: 'private' }, requestConsent: async () => null, transport: async () => { calls++; return {}; } });
  assert.equal(result, null); assert.equal(calls, 0);
});

test('explicit consent sends only selected minimum fields', async () => {
  let sent = '';
  await sendAiRequest({ path: '/ai/diagnose-barrier', privacyMode: 'HIGHLY_CONFIDENTIAL', details, payload: { actionTitle: 'A', userExplanation: 'private' }, requestConsent: async value => createConsentGrant(value), transport: async (_path, init) => { sent = String(init.body); return {}; } });
  const body = JSON.parse(sent);
  assert.equal(body.consent, true);
  assert.deepEqual(body.fieldsShared, ['actionTitle', 'userExplanation']);
  assert.deepEqual(Object.keys(body).sort(), ['actionTitle', 'consent', 'consentInteractionId', 'fieldsShared', 'purpose', 'userExplanation'].sort());
  assert.equal(sent.includes('Goal description'), false);
});

test('a consent grant cannot be reused', async () => {
  const grant = createConsentGrant(details);
  const options = { path: '/ai/diagnose-barrier', privacyMode: 'HIGHLY_CONFIDENTIAL' as const, details, payload: { actionTitle: 'A', userExplanation: 'private' }, requestConsent: async () => grant, transport: async () => ({}) };
  await sendAiRequest(options);
  await assert.rejects(() => sendAiRequest(options), /AI_CONSENT_ALREADY_USED/);
});
