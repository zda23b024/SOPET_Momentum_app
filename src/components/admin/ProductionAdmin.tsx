import React, { useEffect, useState } from 'react';
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
import { isOwner } from '../../services/permissions';

type Tab = 'shared' | 'analytics' | 'security' | 'audit' | 'health' | 'users';
export function ProductionAdmin() {
  const { user, activeRole, showToast } = useApp();
  const vault = usePrivacyVault();
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const owner = isOwner(user);
  const canShare = roles.some(r => ['OWNER', 'ADMIN'].includes(r)) && permissions.includes('goal.shared.view');
  const canAudit = roles.some(r => ['OWNER', 'ADMIN'].includes(r));
  const canMetrics = roles.some(r => ['OWNER', 'ADMIN'].includes(r)) && permissions.includes('admin.metrics.view');
  const tabs: { id: Tab; label: string }[] = [
    ...(canShare ? [{ id: 'shared' as const, label: 'Shared With Me' }] : []),
    ...(canMetrics ? [{ id: 'analytics' as const, label: 'Analytics' }] : []),
    ...(canAudit && permissions.includes('security.events.view') ? [{ id: 'security' as const, label: 'Security' }] : []),
    ...(canAudit ? [{ id: 'audit' as const, label: 'Audit' }] : []),
    ...(owner ? [{ id: 'users' as const, label: 'Users' }] : []),
    { id: 'health', label: 'System Health' },
  ];
  const [tab, setTab] = useState<Tab>(tabs[0].id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<{ title: string; description: string; why: string; privacy: string } | null>(null);
  const [sharingKeyExists, setSharingKeyExists] = useState<boolean | null>(null);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'USER' });
  const load = async () => {
    setLoading(true); setError(''); setData(null); setOpened(null);
    try {
      if (tab === 'shared') { const [grants,key] = await Promise.all([sharingApi.sharedWithMe(), sharingApi.ownKey()]); setData(grants); setSharingKeyExists(Boolean(key)); }
      else setData(await apiRequest(tab === 'analytics' ? '/admin/metrics' : tab === 'security' ? '/admin/security-events' : tab === 'audit' ? '/admin/audit-logs' : tab === 'users' ? '/admin/users' : '/health'));
    } catch (e) { setError(e instanceof Error ? e.message : 'This section could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [tab]);
  useEffect(() => { if (vault.status !== 'unlocked') setOpened(null); }, [vault.status]);
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
  if (activeRole !== 'admin') return <WorkspaceState title="403 — Access restricted" description="Administration requires an authorized account." />;
  return <div className="page-shell max-w-6xl">
    <header className="rounded-2xl bg-[#0E3C5B] p-6 text-white"><div className="flex items-center gap-3"><BrandLogo className="h-12 w-auto rounded bg-white p-1" /><div><h1 className="text-xl font-bold">SOPET Momentum Administration</h1><p className="text-sm text-slate-200">The Soft Persona Tool</p></div></div><p className="mt-4 text-sm text-slate-200">Account permissions determine the available sections. Private Goal content requires an explicit sharing grant.</p></header>
    <nav aria-label="Administration" className="flex gap-2 overflow-x-auto pb-2">{tabs.map(item => <button key={item.id} aria-current={item.id === tab ? 'page' : undefined} className={`${item.id === tab ? 'primary-button' : 'secondary-button'} whitespace-nowrap`} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
    {loading ? <WorkspaceState loading title="Loading administration…" /> : <>
      {error && <p role="alert" className="error-notice">{error} <button className="underline" onClick={() => void load()}>Retry</button></p>}
      {tab === 'shared' && Array.isArray(data) && <section className="settings-card"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Shared With Me</h2><div className="flex flex-wrap gap-2">{sharingKeyExists === false && <button disabled={busy || vault.status !== 'unlocked'} className="secondary-button" onClick={() => void setupKey()}>Set up sharing key</button>}<button className="secondary-button" onClick={() => void load()}>Refresh</button></div></div>{sharingKeyExists === false && vault.status !== 'unlocked' && <p className="text-sm text-slate-600">Unlock your Privacy Vault in Settings to configure encrypted sharing.</p>}
        {data.length ? <ul className="space-y-3">{data.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"><div className="min-w-0 space-y-1 text-sm"><p className="break-all font-semibold">Goal {item.goalId}</p><p className="break-all text-slate-600">Owner: {item.ownerUserId}</p><p className="text-xs text-slate-500">{item.permission} · Granted {item.grantedAt ? new Date(item.grantedAt).toLocaleString() : 'Not available'}</p><p className="text-xs text-slate-500">Expires: {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : 'Until revoked'}</p></div><button disabled={busy} className="secondary-button" onClick={() => void openGoal(item.goalId)}>Open Goal</button></li>)}</ul> : <p className="text-sm text-slate-600">No Goals have been shared with this account.</p>}
        {opened && <article className="space-y-3 border-t border-slate-200 pt-4"><p className="text-xs font-semibold text-[#155A8A]">{opened.privacy} · View only</p><h3 className="text-xl font-bold">{opened.title}</h3><p className="whitespace-pre-wrap text-sm">{opened.description}</p><p className="whitespace-pre-wrap text-sm"><strong>Why This Matters:</strong> {opened.why}</p><button className="secondary-button" onClick={() => setOpened(null)}>Close Goal</button></article>}
      </section>}
      {tab === 'analytics' && data && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[['Accounts',data.totalUsers],['Goals',data.totalGoals],['Actions',data.totalActions],['Completed Actions',data.completedActions],['Barriers',data.totalBarriers]].map(([label,value]) => <section key={label} className="settings-card"><h2 className="text-sm font-semibold text-slate-600">{label}</h2><p className="text-2xl font-bold text-[#0E3C5B]">{typeof value === 'number' ? value : 'No data yet'}</p></section>)}</div>}
      {(tab === 'audit' || tab === 'security') && Array.isArray(data) && <section className="settings-card"><h2 className="text-lg font-bold">{tab === 'audit' ? 'Audit history' : 'Security events'}</h2>{!data.length ? <p className="text-sm text-slate-600">No data yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Time','Event','Account','Result'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.map((item: any) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td><td className="p-3">{item.action || item.eventType}</td><td className="p-3 break-all">{item.actorEmail || item.actorId || item.userId || 'System'}</td><td className="p-3">{item.result || item.severity || 'Not recorded'}</td></tr>)}</tbody></table></div>}</section>}
      {tab === 'users' && Array.isArray(data) && <section className="settings-card"><h2 className="text-lg font-bold">User management</h2><p className="mb-4 text-sm text-slate-600">Create users, admins, or owners and manage account roles.</p><form onSubmit={createUser} className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><input required value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Full name" className="rounded border p-2" /><input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" className="rounded border p-2" /><input required minLength={12} type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Temporary password" className="rounded border p-2" /><select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="rounded border p-2"><option value="USER">User</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option></select><button disabled={busy} className="primary-button">Create account</button></form>{!data.length ? <p className="text-sm text-slate-600">No accounts found.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th></tr></thead><tbody>{data.map((item: any) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3">{item.fullName || '—'}</td><td className="p-3 break-all">{item.email}</td><td className="p-3"><select aria-label={`Role for ${item.email}`} disabled={busy} value={item.role} onChange={e => void changeRole(item.id, e.target.value)} className="rounded border p-1"><option value="USER">User</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option></select></td><td className="p-3">{item.isActive ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></div>}</section>}
      {tab === 'health' && data && <section className="settings-card"><h2 className="text-lg font-bold">System Health</h2><dl className="space-y-3 text-sm"><div><dt className="text-slate-500">Service</dt><dd>{data.status}</dd></div><div><dt className="text-slate-500">Database connection reported by service</dt><dd>{data.database}</dd></div><div><dt className="text-slate-500">Uptime</dt><dd>{Math.floor(data.uptimeSeconds)} seconds</dd></div><div><dt className="text-slate-500">Checked</dt><dd>{new Date(data.timestamp).toLocaleString()}</dd></div></dl><button className="secondary-button" onClick={() => void load()}>Refresh</button></section>}
    </>}
  </div>;
}
