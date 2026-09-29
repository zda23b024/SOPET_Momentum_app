export type AdminTab = 'overview' | 'users' | 'roles' | 'deletions' | 'shared' | 'analytics' | 'security' | 'audit' | 'health';

const ADMIN_PATHS: Record<AdminTab, string> = {
  overview: '/administration',
  users: '/administration/users',
  roles: '/administration/roles',
  deletions: '/administration/deletions',
  shared: '/administration/shared',
  analytics: '/administration/metrics',
  security: '/administration/security',
  audit: '/administration/audit',
  health: '/administration/health',
};

export function adminPathForTab(tab: AdminTab): string {
  return ADMIN_PATHS[tab];
}

export function adminTabFromPath(pathname: string): AdminTab | null {
  return (Object.entries(ADMIN_PATHS).find(([, path]) => path === pathname)?.[0] as AdminTab | undefined) ?? null;
}

export function isAdministrationPath(pathname: string): boolean {
  return adminTabFromPath(pathname) !== null;
}