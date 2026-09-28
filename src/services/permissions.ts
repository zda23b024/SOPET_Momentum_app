const ADMIN_ROLES = new Set(['SYSTEM_OWNER', 'SUPPORT_ADMIN', 'SECURITY_ADMIN', 'PRODUCT_ADMIN', 'ANALYTICS_ADMIN']);
export function canAccessAdministration(user: { roles?: string[]; permissions?: string[] } | null): boolean {
  return Boolean(user?.roles?.some(role => ADMIN_ROLES.has(role)) && user.permissions?.includes('admin.dashboard.view'));
}
