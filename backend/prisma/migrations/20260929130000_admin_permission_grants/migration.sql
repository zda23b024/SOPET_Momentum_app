INSERT INTO "Permission" ("id", "code", "description") VALUES
  (md5('permission:admin.dashboard.view'), 'admin.dashboard.view', 'Open administration'),
  (md5('permission:admin.users.view'), 'admin.users.view', 'View account metadata'),
  (md5('permission:admin.audit.view'), 'admin.audit.view', 'View audit history'),
  (md5('permission:admin.deletions.view'), 'admin.deletions.view', 'View pending deletions'),
  (md5('permission:admin.health.view'), 'admin.health.view', 'View system health'),
  (md5('permission:security.sessions.view'), 'security.sessions.view', 'View own active security sessions'),
  (md5('permission:security.sessions.revoke'), 'security.sessions.revoke', 'Revoke active sessions'),
  (md5('permission:security.events.view'), 'security.events.view', 'View security events'),
  (md5('permission:account.metadata.view'), 'account.metadata.view', 'View account operational metadata'),
  (md5('permission:account.suspend'), 'account.suspend', 'Suspend or deactivate accounts'),
  (md5('permission:admin.roles.manage'), 'admin.roles.manage', 'Manage user roles and permissions'),
  (md5('permission:admin.users.manage'), 'admin.users.manage', 'Create users and manage account roles'),
  (md5('permission:admin.metrics.view'), 'admin.metrics.view', 'View administrative metrics')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5('admin-grant:' || target_role."id" || ':' || grant_permission."id"), target_role."id", grant_permission."id"
FROM "Role" target_role
CROSS JOIN "Permission" grant_permission
WHERE target_role."name" IN ('OWNER', 'ADMIN')
  AND grant_permission."code" IN (
    'admin.dashboard.view', 'admin.users.view', 'admin.audit.view',
    'admin.deletions.view', 'admin.health.view', 'security.sessions.view',
    'security.sessions.revoke', 'security.events.view', 'account.metadata.view',
    'account.suspend', 'admin.roles.manage', 'admin.users.manage',
    'admin.metrics.view'
  )
  AND (target_role."name" = 'OWNER' OR grant_permission."code" NOT IN ('admin.roles.manage', 'admin.users.manage'))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;