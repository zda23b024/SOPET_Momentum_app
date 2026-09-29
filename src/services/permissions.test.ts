import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessAdministration, isOwner } from './permissions';
import { adminPathForTab, adminTabFromPath, isAdministrationPath } from './adminNavigation';

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

test('administration URLs resolve to their admin sections only', () => {
  const routes = [
    ['overview', '/administration'],
    ['users', '/administration/users'],
    ['roles', '/administration/roles'],
    ['audit', '/administration/audit'],
    ['analytics', '/administration/metrics'],
    ['security', '/administration/security'],
  ] as const;
  for (const [tab, path] of routes) {
    assert.equal(adminPathForTab(tab), path);
    assert.equal(adminTabFromPath(path), tab);
    assert.equal(isAdministrationPath(path), true);
  }
  assert.equal(isAdministrationPath('/administration/not-a-section'), false);
});
