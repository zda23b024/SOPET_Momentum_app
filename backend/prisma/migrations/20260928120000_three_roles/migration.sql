-- Consolidate legacy administrative roles. Existing accounts are preserved:
-- SYSTEM_OWNER becomes OWNER, every other legacy admin becomes ADMIN.
CREATE TEMP TABLE "RoleAssignments" AS
SELECT u."id" AS "userId", CASE
  WHEN EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId" WHERE ur."userId" = u."id" AND r."name"::text = 'SYSTEM_OWNER') THEN 'OWNER'
  WHEN EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId" WHERE ur."userId" = u."id" AND r."name"::text <> 'USER') THEN 'ADMIN'
  ELSE 'USER'
END AS "role"
FROM "User" u;

DELETE FROM "UserRole";
DELETE FROM "RolePermission";
ALTER TABLE "Role" ALTER COLUMN "name" TYPE TEXT;
DROP INDEX "Role_name_key";
DELETE FROM "Role";
ALTER TYPE "UserRoleType" RENAME TO "UserRoleType_legacy";
CREATE TYPE "UserRoleType" AS ENUM ('USER', 'ADMIN', 'OWNER');
ALTER TABLE "Role" ALTER COLUMN "name" TYPE "UserRoleType" USING "name"::"UserRoleType";
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
DROP TYPE "UserRoleType_legacy";

INSERT INTO "Role" ("id", "name", "description") VALUES
  ('00000000-0000-0000-0000-000000000001', 'USER', 'Standard SOPET participant'),
  ('00000000-0000-0000-0000-000000000002', 'ADMIN', 'SOPET administrator'),
  ('00000000-0000-0000-0000-000000000003', 'OWNER', 'SOPET platform owner');

INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
SELECT md5("userId" || ':' || "role"), "userId",
  CASE "role" WHEN 'OWNER' THEN '00000000-0000-0000-0000-000000000003'
              WHEN 'ADMIN' THEN '00000000-0000-0000-0000-000000000002'
              ELSE '00000000-0000-0000-0000-000000000001' END,
  CURRENT_TIMESTAMP
FROM "RoleAssignments";

INSERT INTO "Permission" ("id", "code", "description") VALUES
  ('00000000-0000-0000-0000-000000000004', 'admin.users.manage', 'Create users and manage account roles')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";

-- Owners receive every permission. Admins retain normal administration but cannot
-- manage accounts or role assignments; standard users retain their prior grants.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5('owner:' || p."id"), '00000000-0000-0000-0000-000000000003', p."id" FROM "Permission" p;
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5('admin:' || p."id"), '00000000-0000-0000-0000-000000000002', p."id"
FROM "Permission" p WHERE p."code" NOT IN ('admin.roles.manage', 'admin.users.manage');
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5('user:' || p."id"), '00000000-0000-0000-0000-000000000001', p."id"
FROM "Permission" p WHERE p."code" IN (
  'goal.read_own', 'goal.create', 'goal.update_own', 'goal.delete_own',
  'action.read_own', 'action.create', 'action.update_own',
  'barrier.read_own', 'barrier.confirm_own', 'review.read_own', 'review.create_own',
  'security.sessions.view', 'security.sessions.revoke', 'knowledge.view', 'taxonomy.view', 'intervention.view'
);
