import React, { useEffect, useState } from 'react';
import { accountApi, AccountProfile, Session } from '../../services/accountApi';
import { usePrivacyVault } from '../../context/privacy/PrivacyVaultContext';
import { useApp } from '../../context/AppContext';
import { privacyLabels } from '../../i18n/strings';
import type { PrivacyMode } from '../../crypto/privacyTypes';
import { WorkspaceState } from '../common/WorkspaceState';

export function ProductionSettings() {
  const vault = usePrivacyVault();
  const { showToast } = useApp();
  const [tab, setTab] = useState<'account' | 'security' | 'privacy'>('account');
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recovery, setRecovery] = useState<string | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRecovery, setMfaRecovery] = useState<string[]>([]);
  const [mfaSaved, setMfaSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletionDate, setDeletionDate] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const [p,s] = await Promise.all([accountApi.profile(), accountApi.sessions()]); setProfile(p); setSessions(s); }
    catch (e) { setError(e instanceof Error ? e.message : 'Settings could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (vault.status !== 'unlocked') { setRecovery(null); setMfaSecret(''); setMfaRecovery([]); } }, [vault.status]);
  const run = async (work: () => Promise<void>, message?: string) => {
    if (busy) return; setBusy(true); setError('');
    try { await work(); if (message) showToast(message, 'success'); }
    catch (e) { setError(e instanceof Error && !/^[A-Z_]+$/.test(e.message) ? e.message : 'Unable to complete this change. Check your entries and try again.'); }
    finally { setBusy(false); }
  };
  const storeRecovery = (key: string) => { setRecovery(key); setRecoverySaved(false); setPassphrase(''); };
  if (loading) return <WorkspaceState loading title="Loading settings…" />;
  if (!profile) return <WorkspaceState title="Settings unavailable" description={error} onRetry={() => void load()} />;
  return <div className="page-shell">
    <div><h1 className="page-title">Settings</h1><p className="mt-1 text-sm text-slate-600">Your account, sign-in security and private content.</p></div>
    <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">{(['account','security','privacy'] as const).map(value => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setError(''); }} className={tab === value ? 'primary-button whitespace-nowrap' : 'secondary-button whitespace-nowrap'}>{value === 'account' ? 'Account' : value === 'security' ? 'Security' : 'Privacy & Encryption'}</button>)}</nav>
    {error && <p role="alert" className="error-notice">{error}</p>}
    <fieldset disabled={busy} aria-busy={busy} className="space-y-6">
      {tab === 'account' && <>
        <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Profile</h2><dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Name</dt><dd className="font-semibold">{profile.fullName || 'Not provided'}</dd></div>
          <div><dt className="text-slate-500">Email</dt><dd className="font-semibold">{profile.email}</dd><dd className="mt-1 text-xs text-slate-600">{profile.isEmailVerified === true ? 'Verified' : profile.isEmailVerified === false ? 'Not verified' : 'Verification is required to sign in'}</dd></div>
          <div><dt className="text-slate-500">Language</dt><dd>{profile.profile?.locale || profile.profile?.language || 'Not provided'}</dd></div>
          <div><dt className="text-slate-500">Timezone</dt><dd>{profile.profile?.timezone || 'Not provided'}</dd></div>
        </dl><p className="text-xs text-slate-500">Profile editing is not available yet. Kiswahili interface translations are pending review; published methodology remains in its approved language.</p></section>
        <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Notification preferences</h2>{profile.notifications ? <dl className="grid gap-3 text-sm sm:grid-cols-2">{Object.entries(profile.notifications).filter(([key,value]) => !['id','userId','createdAt','updatedAt'].includes(key) && ['boolean','string','number'].includes(typeof value)).map(([key,value]) => <div key={key}><dt className="text-slate-500">{key.replace(/([A-Z])/g,' $1').replace(/^./,s => s.toUpperCase())}</dt><dd>{typeof value === 'boolean' ? value ? 'Enabled' : 'Disabled' : String(value)}</dd></div>)}</dl> : <p className="text-sm text-slate-600">No saved notification preferences.</p>}<p className="text-xs text-slate-500">Preference editing is not available yet. In-app reminders appear under Notifications.</p></section>
        <PrivacyDefault profile={profile} onChange={mode => void run(async () => { await accountApi.privacy(mode); setProfile({ ...profile, privacyMode: mode }); }, 'Default privacy saved. Existing Goals keep their current privacy mode.')} />
        <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Your data</h2><p className="text-sm text-slate-600">A complete account export is not available yet. Protected content must be decrypted on your device before it can be exported.</p><button disabled className="secondary-button">Data export unavailable</button></section>
        <section className="settings-card border-rose-200"><h2 className="text-lg font-bold text-rose-800">Delete account</h2><p className="text-sm text-slate-600">Submit an account deletion request. Your account and its data are permanently removed after the 14-day retention window.</p>
          {deletionDate ? <p role="status" className="notice">Request recorded with a scheduled date of {new Date(deletionDate).toLocaleDateString()}. This confirms the request, not completed deletion.</p> : deleting ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (deleteConfirmation === 'DELETE') void run(async () => { const result = await accountApi.requestDeletion(); setDeletionDate(result.scheduledFor); setDeleting(false); }); }}><label className="field-label">Type DELETE to request deletion<input required pattern="DELETE" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} /></label><div className="flex gap-3"><button className="primary-button" disabled={deleteConfirmation !== 'DELETE'}>Submit deletion request</button><button type="button" className="secondary-button" onClick={() => setDeleting(false)}>Cancel</button></div></form> : <button className="secondary-button text-rose-800" onClick={() => setDeleting(true)}>Request account deletion</button>}
        </section>
      </>}
      {tab === 'security' && <>
        <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Password</h2><form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { await accountApi.password(currentPassword,newPassword); setCurrentPassword(''); setNewPassword(''); window.dispatchEvent(new CustomEvent('sopet:session-expired')); }, 'Password changed. Sign in again to continue.'); }}><label className="field-label">Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label><label className="field-label">New password<input type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><p className="text-xs text-slate-500">Use at least 12 characters. Changing your password signs out existing sessions.</p><button className="primary-button">Change password</button></form></section>
        <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Email verification</h2><p className="text-sm">{profile.email}</p><p className="text-sm text-slate-600">{profile.isEmailVerified === true ? 'Your email is verified.' : 'Email verification is required before you can sign in.'}</p></section>
        <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Multi-factor authentication</h2><p className="text-sm">Status: <strong>{profile.mfaEnabled ? 'Enabled' : 'Not enabled'}</strong></p><p className="text-xs text-slate-600">MFA Recovery Codes protect sign-in. They are separate from your Privacy Vault Recovery Key.</p>
          {!profile.mfaEnabled && !mfaSecret && <button className="primary-button" onClick={() => void run(async () => { const result = await accountApi.enrollMfa(); setMfaSecret(result.secret); })}>Enable MFA</button>}
          {mfaSecret && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => { const result = await accountApi.confirmMfa(mfaCode); setMfaRecovery(result.recoveryCodes); setMfaSaved(false); setMfaSecret(''); setMfaCode(''); setProfile({ ...profile, mfaEnabled: true }); }, 'MFA enabled. Save your recovery codes.'); }}><p className="text-sm">Add an account to your authenticator using this setup key and your SOPET email address.</p><code className="block break-all rounded bg-slate-100 p-3 select-all">{mfaSecret}</code><label className="field-label">Authenticator code<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" value={mfaCode} onChange={e => setMfaCode(e.target.value)} /></label><button className="primary-button">Confirm MFA</button></form>}
          {!!mfaRecovery.length && <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold">MFA Recovery Codes — save now</h3><div className="grid grid-cols-2 gap-2 font-mono text-sm">{mfaRecovery.map(code => <span className="break-all select-all" key={code}>{code}</span>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mfaSaved} onChange={e => setMfaSaved(e.target.checked)} />I saved these codes securely.</label><button disabled={!mfaSaved} className="secondary-button" onClick={() => setMfaRecovery([])}>Hide recovery codes</button></div>}
          {profile.mfaEnabled && <p className="text-xs text-slate-500">Disabling MFA and regenerating MFA Recovery Codes are not available yet.</p>}
        </section>
        <section className="settings-card"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#0E3C5B]">Active sessions</h2><button className="secondary-button" onClick={() => void run(async () => { await accountApi.revokeOthers(); setSessions(await accountApi.sessions()); }, 'Other sessions signed out.')}>Log out other sessions</button></div>{sessions.length ? <ul className="divide-y divide-slate-100">{sessions.map(session => <li className="space-y-1 py-3 text-sm" key={session.id}><p className="break-words font-medium">{session.userAgent || 'Unknown device'}</p><p className="text-slate-600">IP: {session.ipAddress || 'Not available'}</p><p className="text-xs text-slate-500">Last active: {session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : 'Not available'} · Expires: {new Date(session.expiresAt).toLocaleString()}</p></li>)}</ul> : <p className="text-sm text-slate-600">No active sessions returned.</p>}</section>
        <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Recent security activity</h2><p className="text-sm text-slate-600">Personal security event history is not available yet. Active sessions above show your current device access.</p></section>
      </>}
      {tab === 'privacy' && <>
        <section className="settings-card"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#0E3C5B]">Privacy Vault</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-[#155A8A]">{vault.status === 'unlocked' ? 'Vault Unlocked' : vault.status === 'locked' ? 'Vault Locked' : vault.status === 'not-configured' ? 'Not set up' : vault.status === 'error' ? 'Vault unavailable' : 'Loading…'}</span></div>
          <p className="text-sm text-slate-600">Encrypted Private and Highly Confidential Goal content is encrypted on your device. Standard Private Goals are protected by account access controls.</p>
          {vault.status === 'error' && <button className="secondary-button" onClick={() => void vault.refresh()}>Retry loading vault</button>}
          {vault.status === 'loading' && <p role="status">Loading vault status…</p>}
          {['locked','not-configured','unlocked'].includes(vault.status) && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { if (recovering) { await vault.recover(recoveryInput,passphrase); setRecoveryInput(''); setRecovering(false); } else if (vault.status === 'not-configured') storeRecovery(await vault.setup(passphrase)); else if (vault.status === 'locked') await vault.unlock(passphrase); else await vault.changePassphrase(passphrase); setPassphrase(''); }, 'Privacy Vault updated.'); }}>
            {recovering && <label className="field-label">Privacy Vault Recovery Key<input type="password" autoComplete="off" required value={recoveryInput} onChange={e => setRecoveryInput(e.target.value)} /></label>}
            <label className="field-label">{recovering || vault.status !== 'locked' ? 'New Privacy Vault Passphrase' : 'Privacy Vault Passphrase'}<input type="password" minLength={recovering || vault.status !== 'locked' ? 12 : 1} autoComplete={vault.status === 'locked' && !recovering ? 'current-password' : 'new-password'} required value={passphrase} onChange={e => setPassphrase(e.target.value)} /></label><p className="text-xs text-slate-500">New vault passphrases must contain at least 12 characters.</p>
            <div className="flex flex-wrap gap-3"><button className="primary-button">{recovering ? 'Recover vault' : vault.status === 'locked' ? 'Unlock Vault' : vault.status === 'not-configured' ? 'Set up Privacy Vault' : 'Change Vault Passphrase'}</button>{vault.status === 'locked' && <button type="button" className="secondary-button" onClick={() => { setRecovering(!recovering); setPassphrase(''); setRecoveryInput(''); }}>{recovering ? 'Cancel recovery' : 'Use Recovery Key'}</button>}{vault.status === 'unlocked' && <button type="button" className="secondary-button" onClick={vault.lock}>Lock Vault</button>}</div>
          </form>}
        </section>
        <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Privacy Vault Recovery Key</h2><p className="text-sm">Status: {vault.metadata?.recoveryWrappedKeyData ? 'Configured' : vault.status === 'error' || vault.status === 'loading' ? 'Unavailable' : 'Not configured'}</p><p className="text-sm text-slate-600">This key recovers encrypted content. It does not reset your sign-in password or replace MFA Recovery Codes. Losing both your vault passphrase and this key makes encrypted content unrecoverable.</p><button disabled={vault.status !== 'unlocked'} className="secondary-button" onClick={() => { if (window.confirm('Replace the Privacy Vault Recovery Key? The previous key will stop working.')) void run(async () => storeRecovery(await vault.rotateRecovery())); }}>Regenerate Recovery Key</button>
          {recovery && <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold">Save your Privacy Vault Recovery Key</h3><code className="block break-all select-all text-sm">{recovery}</code><label className="flex gap-2 text-sm"><input type="checkbox" checked={recoverySaved} onChange={e => setRecoverySaved(e.target.checked)} />I saved this key securely.</label><button className="secondary-button" disabled={!recoverySaved} onClick={() => setRecovery(null)}>Finish</button></div>}
        </section>
        <PrivacyDefault profile={profile} onChange={mode => void run(async () => { await accountApi.privacy(mode); setProfile({ ...profile, privacyMode: mode }); }, 'Default privacy saved. Existing Goals are unchanged.')} />
      </>}
    </fieldset>
    {busy && <p className="notice" role="status">Saving your changes…</p>}
  </div>;
}

function PrivacyDefault({ profile, onChange }: { profile: AccountProfile; onChange: (mode: PrivacyMode) => void }) {
  return <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Default privacy mode</h2><label className="field-label">Privacy for new Goals<select value={profile.privacyMode} onChange={e => onChange(e.target.value as PrivacyMode)}>{Object.entries(privacyLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="text-xs text-slate-500">Existing Goals keep their current privacy mode. Encrypted Goals require an unlocked Privacy Vault.</p></section>;
}
