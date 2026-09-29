import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessAdministration, isOwner } from './permissions';

test('owner roles from auth/me expose administration and owner controls', () => {
  for (const role of ['SYSTEM_OWNER', 'OWNER']) {
    assert.equal(canAccessAdministration({ roles: [role] }), true);
    assert.equal(isOwner({ roles: [role] }), true);
  }
});
test('admins can open administration but users and anonymous visitors cannot', () => {
  assert.equal(canAccessAdministration({ roles: ['ADMIN'] }), true);
  assert.equal(isOwner({ roles: ['ADMIN'] }), false);
  for (const user of [null, {}, { roles: ['USER'], permissions: ['admin.dashboard.view'] }]) {
    assert.equal(canAccessAdministration(user), false);
    assert.equal(isOwner(user), false);
  }
});
