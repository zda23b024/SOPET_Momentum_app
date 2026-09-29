import { normalizeAdminRole } from '../../services/permissions';
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { apiRequest, sharingApi } from '../../services/api';
import { usePrivacyVault } from '../../context/privacy/PrivacyVaultContext';
import { createStaffSharingKey, openStaffGoalKeyEnvelope, unwrapStaffPrivateKey } from '../../crypto/goalKeys';
import { decryptContent } from '../../crypto/vault';
import type { EncryptedContentEnvelope, StaffGoalKeyEnvelope } from '../../crypto/privacyTypes';
import { goalApi } from '../../services/goalApi';
import { BrandLogo } from '../common/BrandLogo';
import { WorkspaceState } from '../common/WorkspaceState';
import { privacyLabels } from '../../i18n/strings';
import { accountApi, AccountProfile } from '../../services/accountApi';
import { adminPathForTab, adminTabFromPath, AdminTab } from '../../services/adminNavigation';

type Tab = AdminTab;
type AdminUser = { id: string; email: string; fullName?: string; isActive: boolean; isEmailVerified: boolean; mfaEnabled: boolean; lastLoginAt?: string; userRoles: { role: { name: string } }[] };
type AdminRole = { id: string; name: string; description: string; permissions: { permission: { code: string; description: string } }[] };
export function ProductionAdmin() {
  const { user, activeRole, showToast } = useApp();
  const vault = usePrivacyVault();
  const roles = (user?.roles ?? []).map(normalizeAdminRole);
  const permissions = user?.permissions ?? [];
  const canShare = roles.some(r => ['ADMIN'].includes(r)) && permissions.includes('goal.shared.view');
  const canAudit = roles.some(r => ['OWNER','ADMIN'].includes(r));
  const canMetrics = roles.some(r => ['OWNER','ADMIN'].includes(r)) && permissions.includes('admin.metrics.view');
  const canUsers = permissions.includes('admin.users.view');
  const canManageUsers = permissions.includes('admin.users.manage');
  const canManageRoles = roles.includes('OWNER') && permissions.includes('admin.roles.manage');
  const tabs: { id: Tab; label: string }[] = [
    ...(permissions.includes('admin.metrics.view') ? [{ id: 'overview' as const, label: 'Overview' }] : []),
    ...(canUsers ? [{ id: 'users' as const, label: 'Users' }, { id: 'roles' as const, label: 'Roles & Permissions' }] : []),
    ...(permissions.includes('admin.deletions.view') ? [{ id: 'deletions' as const, label: 'Deletion Queue' }] : []),
    ...(canShare ? [{ id: 'shared' as const, label: 'Shared With Me' }] : []),
    ...(canMetrics ? [{ id: 'analytics' as const, label: 'Analytics' }] : []),
    ...(canAudit ? [{ id: 'security' as const, label: 'Security / MFA' }] : []),
    ...(canAudit && permissions.includes('admin.audit.view') ? [{ id: 'audit' as const, label: 'Audit Logs' }] : []),
    ...(permissions.includes('admin.health.view') ? [{ id: 'health' as const, label: 'System Health' }] : []),
  ];
  const [tab, setTab] = useState<Tab>(() => adminTabFromPath(window.location.pathname) ?? tabs[0]?.id ?? 'overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<{ title: string; description: string; why: string; privacy: string } | null>(null);
  const [sharingKeyExists, setSharingKeyExists] = useState<boolean | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[]>([]);
  const [mfaCodesSaved, setMfaCodesSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [auditSearch, setAuditSearch] = useState('');
  const [availableRoles, setAvailableRoles] = useState<AdminRole[]>([]);
  const requestVersion = useRef(0);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'USER' });
  const load = async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError(''); setData(null); setOpened(null);
    try {
      let nextData: unknown;
      let nextSharingKeyExists: boolean | null = null;
      let nextProfile: AccountProfile | null = null;
      let nextRoles: AdminRole[] = [];
      if (tab === 'shared') {
        const [grants,key] = await Promise.all([sharingApi.sharedWithMe(), sharingApi.ownKey()]);
        nextData = grants; nextSharingKeyExists = Boolean(key);
      } else if (tab === 'security') {
        nextProfile = await accountApi.profile();
        try { nextData = permissions.includes('security.events.view') ? await apiRequest('/admin/security-events') : []; }
        catch { nextData = []; }
      } else if (tab === 'overview') {
        const [overview, profile] = await Promise.all([apiRequest('/admin/overview'), accountApi.profile()]);
        nextData = overview; nextProfile = profile;
      } else if (tab === 'users') {
        const parameters = new URLSearchParams();
        if (search.trim()) parameters.set('search', search.trim());
        if (roleFilter) parameters.set('role', roleFilter);
        if (statusFilter) parameters.set('status', statusFilter);
        const [users, roleList, profile] = await Promise.all([apiRequest(`/admin/users?${parameters}`), apiRequest<AdminRole[]>('/admin/roles'), accountApi.profile()]);
        nextData = users; nextRoles = roleList; nextProfile = profile;
      }
      else nextData = await apiRequest(tab === 'roles' ? '/admin/roles' : tab === 'deletions' ? '/admin/deletions' : tab === 'analytics' ? '/admin/metrics' : tab === 'audit' ? '/admin/audit-logs' : '/admin/health');
      if (version !== requestVersion.current) return;
      setData(nextData); setSharingKeyExists(nextSharingKeyExists); setAccountProfile(nextProfile); setAvailableRoles(nextRoles);
    } catch (e) { if (version === requestVersion.current) setError(e instanceof Error ? e.message : 'This section could not be loaded.'); }
    finally { if (version === requestVersion.current) setLoading(false); }
  };
  useEffect(() => { void load(); }, [tab]);
  useEffect(() => { if (vault.status !== 'unlocked') setOpened(null); }, [vault.status]);
  const changeUser = async (userId: string, work: () => Promise<unknown>) => {
    if (busy || !window.confirm('Apply this administrative change? The account may be signed out.')) return;
    setBusy(true); setError('');
    try { await work(); showToast('Administrative change saved.', 'success'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The change could not be completed.'); }
    finally { setBusy(false); }
  };
  const setupKey = async () => {
    if (busy || sharingKeyExists || !vault.key || !vault.metadata) return;
    setBusy(true); setError('');
    try {
      const current = await goalApi.currentUser();
      const generated = await createStaffSharingKey(vault.key,current.user.id);
      await sharingApi.registerKey({ algorithm: generated.algorithm, publicKey: JSON.stringify(generated.publicKey), wrappedPrivateKey: generated.wrappedPrivateKey, privateKeyMetadata: { vaultKeyVersion: vault.metadata.keyVersion } });
      setSharingKeyExists(true); showToast('Sharing key configured.', 'success');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to configure your sharing key.'); }
    finally { setBusy(false); }
  };
  const createUser = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(newUser) }); setNewUser({ fullName: '', email: '', password: '', role: 'USER' }); await load(); showToast('Account created.', 'success'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to create the account.'); }
    finally { setBusy(false); }
  };
  const changeRole = async (userId: string, role: string) => {
    setBusy(true); setError('');
    try { await apiRequest(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }); await load(); showToast('Account role updated. The account must sign in again.', 'success'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update the account role.'); }
    finally { setBusy(false); }
  };
  const openGoal = async (goalId: string) => {
    if (busy) return; setBusy(true); setError(''); setOpened(null);
    try {
      const result = await sharingApi.openSharedGoal(goalId);
      let content = result.goal;
      if (result.goal.contentEncoding === 'CLIENT_ENCRYPTED') {
        if (!vault.key) throw new Error('Unlock your Privacy Vault in Settings to view this encrypted Goal.');
        const [ownKey,current] = await Promise.all([sharingApi.ownKey(), goalApi.currentUser()]);
        if (!ownKey?.wrappedPrivateKey || !result.grant.encryptedKeyEnvelope) throw new Error('A valid sharing key and access grant are required.');
        const privateJwk = await unwrapStaffPrivateKey(ownKey.wrappedPrivateKey as EncryptedContentEnvelope, vault.key,current.user.id);
        const goalKey = await openStaffGoalKeyEnvelope(JSON.parse(result.grant.encryptedKeyEnvelope) as StaffGoalKeyEnvelope, privateJwk,goalId,current.user.id);
        content = await decryptContent<Record<string,unknown>>(goalKey,result.goal.encryptedPayload,{ userId: result.grant.ownerUserId,entityType:'goal',entityId:goalId });
      }
      setOpened({ title: String(content.title || 'Shared Goal'), description: String(content.description || ''), why: String(content.whyItMatters || ''), privacy: privacyLabels[result.goal.privacyMode as keyof typeof privacyLabels] ?? 'Private' });
    } catch (e) { setError(e instanceof Error && !/^[A-Z_]+$/.test(e.message) ? e.message : 'This Goal could not be opened. Verify your access and unlock your vault.'); }
    finally { setBusy(false); }
  };
  const beginMfaEnrollment = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await accountApi.enrollMfa(); setMfaSecret(result.secret); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to start MFA setup.'); }
    finally { setBusy(false); }
  };
  const confirmMfaEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await accountApi.confirmMfa(mfaCode);
      setMfaRecoveryCodes(result.recoveryCodes); setMfaCodesSaved(false); setMfaSecret(''); setMfaCode('');
      setAccountProfile(current => current ? { ...current, mfaEnabled: true } : current);
      showToast('MFA enabled. Save your recovery codes.', 'success');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to confirm MFA setup.'); }
    finally { setBusy(false); }
  };
  if (activeRole !== 'admin' || !tabs.length) return <WorkspaceState title="403 — Access restricted" description="Administration requires an authorized account and section permissions." />;
  return <div className="page-shell max-w-6xl">
    <header className="rounded-2xl bg-[#0E3C5B] p-6 text-white"><div className="flex items-center gap-3"><BrandLogo className="h-12 w-auto rounded bg-white p-1" /><div><h1 className="text-xl font-bold">SOPET Momentum Administration</h1><p className="text-sm text-slate-200">The Soft Persona Tool</p></div></div><p className="mt-4 text-sm text-slate-200">Account permissions determine the available sections. Private Goal content requires an explicit sharing grant.</p></header>
    <nav aria-label="Administration sections" className="flex gap-2 overflow-x-auto pb-2">{tabs.map(item => <a key={item.id} href={adminPathForTab(item.id)} aria-current={item.id === tab ? 'page' : undefined} className={`${item.id === tab ? 'primary-button' : 'secondary-button'} whitespace-nowrap`}>{item.label}</a>)}</nav>
    {loading ? <WorkspaceState loading title="Loading administration…" /> : <>
      {error && <p role="alert" className="error-notice">{error} <button className="underline" onClick={() => void load()}>Retry</button> {error.toLowerCase().includes('mfa') && <a className="underline font-semibold" href={adminPathForTab('security')}>Set up MFA</a>}</p>}
      {tab === 'security' && <section className="settings-card space-y-4"><h2 className="text-lg font-bold">Security / MFA</h2><p className="text-sm">Multi-factor authentication: <strong>{accountProfile?.mfaEnabled ? 'Enabled' : 'Not enabled'}</strong></p>{accountProfile && !accountProfile.mfaEnabled && <><p className="text-sm text-slate-600">MFA is required in production before protected administrative actions can be completed.</p>{!mfaSecret && <button disabled={busy} className="primary-button" onClick={() => void beginMfaEnrollment()}>Enable MFA</button>}</>}{mfaSecret && <form className="space-y-3" onSubmit={event => void confirmMfaEnrollment(event)}><p className="text-sm">Add this setup key to your authenticator app using your SOPET email address.</p><code className="block break-all rounded bg-slate-100 p-3 select-all">{mfaSecret}</code><label className="field-label">Authenticator code<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" value={mfaCode} onChange={event => setMfaCode(event.target.value)} /></label><button disabled={busy} className="primary-button">Confirm MFA</button></form>}{mfaRecoveryCodes.length > 0 && <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold">Save your MFA recovery codes</h3><div className="grid grid-cols-2 gap-2 font-mono text-sm">{mfaRecoveryCodes.map(code => <span className="break-all select-all" key={code}>{code}</span>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mfaCodesSaved} onChange={event => setMfaCodesSaved(event.target.checked)} />I saved these codes securely.</label><button disabled={!mfaCodesSaved} className="secondary-button" onClick={() => setMfaRecoveryCodes([])}>Hide recovery codes</button></div>}</section>}
      {tab === 'overview' && data && <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[['Active users',data.activeUsers],['Pending verification',data.pendingVerification],['Pending deletion',data.pendingDeletions],['Active admin accounts',data.activeAdmins],['Security events (24h)',data.recentSecurityEvents],['Locked accounts',data.lockedAccounts ?? 'Not tracked']].map(([label,value]) => <section key={String(label)} className="settings-card"><h2 className="text-sm font-semibold text-slate-600">{label}</h2><p className="text-2xl font-bold text-[#0E3C5B]">{value}</p></section>)}</div>
        <section className="settings-card space-y-3"><h2 className="text-lg font-bold">Your administrative access</h2><p className="text-sm">Roles: {roles.join(', ')}</p><p className="text-sm">Permissions: {permissions.join(', ')}</p><p className="text-sm">System: database {data.health?.database}; Redis {data.health?.redis}; email {data.health?.emailProvider}.</p><h3 className="font-semibold">Security checklist</h3><ul className="list-disc pl-5 text-sm"><li>Change your bootstrap password in Account & Privacy Settings.</li><li>Multi-factor authentication: {accountProfile?.mfaEnabled ? 'enabled' : 'not enabled — configure it before production administration'}.</li><li>Review active sessions and security events regularly.</li></ul><a className="secondary-button inline-block" href={adminPathForTab('security')}>Manage Security / MFA</a></section>
      </div>}
      {tab === 'users' && roles.includes('OWNER') && <section className="settings-card"><h2>Create account</h2><form onSubmit={createUser} className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><input required value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Full name" className="rounded border p-2" /><input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" className="rounded border p-2" /><input required minLength={12} type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Temporary password" className="rounded border p-2" /><select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="rounded border p-2"><option value="USER">User</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option></select><button disabled={busy} className="primary-button">Create account</button></form></section>}
      {tab === 'users' && <section className="settings-card space-y-4"><h2 className="text-lg font-bold">User management</h2><form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void load(); }}><input aria-label="Search users" placeholder="Search email or name" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filter by role" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="">All roles</option>{availableRoles.map(role => <option key={role.id} value={role.name}>{role.name}</option>)}</select><select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="unverified">Unverified</option></select><button className="secondary-button">Apply filters</button></form>
        {Array.isArray(data) && (!data.length ? <p className="text-sm text-slate-600">No matching users.</p> : <ul className="space-y-3">{(data as AdminUser[]).map(account => <li className="rounded-lg border border-slate-200 p-4 space-y-2" key={account.id}><p className="font-semibold">{account.fullName || account.email}</p><p className="text-sm">{account.email}</p><p className="text-xs text-slate-600">{account.userRoles.map(item => item.role.name).join(', ') || 'No role'} · {account.isActive ? 'Active' : 'Inactive'} · {account.isEmailVerified ? 'Verified' : 'Unverified'} · MFA {account.mfaEnabled ? 'on' : 'off'}</p><p className="text-xs text-slate-500">Last login: {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : 'Never'}</p><div className="flex flex-wrap gap-2">{canManageUsers && account.id !== accountProfile?.id && <button disabled={busy} className="secondary-button" onClick={() => void changeUser(account.id, () => apiRequest(`/admin/users/${account.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !account.isActive }) }))}>{account.isActive ? 'Deactivate' : 'Activate'}</button>}{permissions.includes('security.sessions.revoke') && <button disabled={busy} className="secondary-button" onClick={() => void changeUser(account.id, () => apiRequest(`/admin/users/${account.id}/revoke-sessions`, { method: 'POST', body: '{}' }))}>Revoke sessions</button>}{!account.isEmailVerified && <button disabled={busy} className="secondary-button" onClick={() => void changeUser(account.id, () => apiRequest(`/admin/users/${account.id}/resend-verification`, { method: 'POST', body: '{}' }))}>Resend verification</button>}{account.isActive && <button disabled={busy} className="secondary-button" onClick={() => void changeUser(account.id, () => apiRequest(`/admin/users/${account.id}/request-password-reset`, { method: 'POST', body: '{}' }))}>Send password reset</button>}{canManageRoles && account.id !== accountProfile?.id && <><select aria-label={`Role for ${account.email}`} value={selectedRole} onChange={event => setSelectedRole(event.target.value)}>{availableRoles.filter(role => role.name !== 'USER').map(role => <option key={role.id} value={role.name}>{role.name}</option>)}</select><button disabled={busy} className="secondary-button" onClick={() => void changeUser(account.id, () => apiRequest(`/admin/users/${account.id}/roles`, { method: 'POST', body: JSON.stringify({ role: selectedRole, action: 'assign' }) }))}>Assign role</button><button disabled={busy} className="secondary-button" onClick={() => void changeUser(account.id, () => apiRequest(`/admin/users/${account.id}/roles`, { method: 'POST', body: JSON.stringify({ role: selectedRole, action: 'revoke' }) }))}>Revoke role</button></>}</div></li>)}</ul>)}
      </section>}
      {tab === 'roles' && Array.isArray(data) && <section className="settings-card space-y-3"><h2 className="text-lg font-bold">Roles & permissions</h2>{(data as AdminRole[]).map(role => <article className="rounded-lg border border-slate-200 p-3" key={role.id}><h3 className="font-semibold">{role.name}</h3><p className="text-sm text-slate-600">{role.description}</p><p className="text-xs">{role.permissions.map(item => item.permission.code).join(', ')}</p></article>)}</section>}
      {tab === 'deletions' && Array.isArray(data) && <section className="settings-card space-y-3"><h2 className="text-lg font-bold">Pending account deletions</h2><p className="text-xs text-slate-600">This view cannot bypass the retention window.</p>{!data.length ? <p>No pending deletions.</p> : data.map((item: any) => <p className="text-sm" key={item.id}>{item.user.email} · {item.status} · Scheduled {new Date(item.scheduledFor).toLocaleString()}</p>)}</section>}
      {tab === 'shared' && Array.isArray(data) && <section className="settings-card"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Shared With Me</h2><div className="flex flex-wrap gap-2">{sharingKeyExists === false && <button disabled={busy || vault.status !== 'unlocked'} className="secondary-button" onClick={() => void setupKey()}>Set up sharing key</button>}<button className="secondary-button" onClick={() => void load()}>Refresh</button></div></div>{sharingKeyExists === false && vault.status !== 'unlocked' && <p className="text-sm text-slate-600">Unlock your Privacy Vault in Settings to configure encrypted sharing.</p>}
        {data.length ? <ul className="space-y-3">{data.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"><div className="min-w-0 space-y-1 text-sm"><p className="break-all font-semibold">Goal {item.goalId}</p><p className="break-all text-slate-600">Owner: {item.ownerUserId}</p><p className="text-xs text-slate-500">{item.permission} · Granted {item.grantedAt ? new Date(item.grantedAt).toLocaleString() : 'Not available'}</p><p className="text-xs text-slate-500">Expires: {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : 'Until revoked'}</p></div><button disabled={busy} className="secondary-button" onClick={() => void openGoal(item.goalId)}>Open Goal</button></li>)}</ul> : <p className="text-sm text-slate-600">No Goals have been shared with this account.</p>}
        {opened && <article className="space-y-3 border-t border-slate-200 pt-4"><p className="text-xs font-semibold text-[#155A8A]">{opened.privacy} · View only</p><h3 className="text-xl font-bold">{opened.title}</h3><p className="whitespace-pre-wrap text-sm">{opened.description}</p><p className="whitespace-pre-wrap text-sm"><strong>Why This Matters:</strong> {opened.why}</p><button className="secondary-button" onClick={() => setOpened(null)}>Close Goal</button></article>}
      </section>}
      {tab === 'analytics' && data && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[['Accounts',data.totalUsers],['Goals',data.totalGoals],['Actions',data.totalActions],['Completed Actions',data.completedActions],['Barriers',data.totalBarriers]].map(([label,value]) => <section key={label} className="settings-card"><h2 className="text-sm font-semibold text-slate-600">{label}</h2><p className="text-2xl font-bold text-[#0E3C5B]">{typeof value === 'number' ? value : 'No data yet'}</p></section>)}</div>}
      {(tab === 'audit' || tab === 'security') && Array.isArray(data) && <section className="settings-card"><h2 className="text-lg font-bold">{tab === 'audit' ? 'Audit history' : 'Security events'}</h2>{tab === 'audit' && <input className="my-3" aria-label="Search audit events" placeholder="Search action, actor or target" value={auditSearch} onChange={event => setAuditSearch(event.target.value)} />}{!data.length ? <p className="text-sm text-slate-600">No data yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Time','Event','Account','Result'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.filter((item: any) => tab !== 'audit' || [item.action,item.actorEmail,item.actorId,item.targetId].some(value => String(value || '').toLowerCase().includes(auditSearch.toLowerCase()))).map((item: any) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td><td className="p-3">{item.action || item.eventType}</td><td className="p-3 break-all">{item.actorEmail || item.actorId || item.userId || 'System'}</td><td className="p-3">{item.result || item.severity || 'Not recorded'}</td></tr>)}</tbody></table></div>}</section>}
      {tab === 'health' && data && <section className="settings-card"><h2 className="text-lg font-bold">System Health</h2><dl className="space-y-3 text-sm"><div><dt className="text-slate-500">Database</dt><dd>{data.database}</dd></div><div><dt className="text-slate-500">Redis / rate limiting</dt><dd>{data.redis}</dd></div><div><dt className="text-slate-500">Email provider</dt><dd>{data.emailProvider}</dd></div><div><dt className="text-slate-500">Application version</dt><dd>{data.version}</dd></div><div><dt className="text-slate-500">Migrations</dt><dd>{data.migrations}</dd></div><div><dt className="text-slate-500">Checked</dt><dd>{new Date(data.timestamp).toLocaleString()}</dd></div></dl><button className="secondary-button" onClick={() => void load()}>Refresh</button></section>}
    </>}
  </div>;
}
