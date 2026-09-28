const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);
export function canAccessAdministration(user: { roles?: string[]; permissions?: string[] } | null): boolean {
  return Boolean(user?.roles?.some(role => ADMIN_ROLES.has(role)));
}

export function isOwner(user: { roles?: string[] } | null): boolean {
  return Boolean(user?.roles?.includes('OWNER'));
}
