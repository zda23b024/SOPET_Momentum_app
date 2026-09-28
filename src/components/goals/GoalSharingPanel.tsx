import React, { useEffect, useState } from 'react';
import { Eye, LockKeyhole, Share2, UserRound, X } from 'lucide-react';
import { sharingApi } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { Goal } from '../../types';
import { usePrivacyVault } from '../../context/privacy/PrivacyVaultContext';
import { createStaffGoalKeyEnvelope, unwrapGoalKeyForOwner } from '../../crypto/goalKeys';
import { goalApi } from '../../services/goalApi';
import { buildGoalKeyRotation, GoalRotationSnapshot } from '../../crypto/goalKeyRotation';
import { privacyLabels } from '../../i18n/strings';

type Grant = {
  id: string;
  granteeUserId: string;
  granteeRoleSnapshot: string;
  permission: string;
  status: string;
  grantedAt?: string;
  expiresAt?: string;
  lastViewedAt?: string;
  revocationRotationId?: string;
  revocationError?: string;
  grantee?: { fullName?: string; email: string };
};

export const GoalSharingPanel: React.FC<{ goal: Goal }> = ({ goal }) => {
  const { showToast } = useApp();
  const vault = usePrivacyVault();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [staff, setStaff] = useState<Array<{ id: string; email: string; fullName?: string; userRoles: Array<{ role: { name: string } }> }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [duration, setDuration] = useState('until-revoked');
  const [isLoading, setIsLoading] = useState(false);
  const [confidentialConfirmed, setConfidentialConfirmed] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [fetching, setFetching] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const refresh = async () => {
    setFetching(true); setLoadError('');
    try {
      const [currentGrants, eligibleStaff] = await Promise.all([sharingApi.grants(goal.id), sharingApi.staff()]);
      setGrants(currentGrants);
      setStaff(eligibleStaff);
    } catch {
      setLoadError('Unable to load sharing status. Please try again.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { void refresh(); }, [goal.id]);

  const grant = async () => {
    if (!selectedStaffId || isLoading) return;
    setIsLoading(true);
    try {
      const expiresAt = duration === 'until-revoked' ? undefined : new Date(Date.now() + (duration === '24-hours' ? 86400000 : 7 * 86400000)).toISOString();
      let encryptedKeyEnvelope: string | undefined;
      let encryptionMetadata: Record<string, unknown> | undefined;
      if (goal.privacyMode !== 'STANDARD_PRIVATE') {
        if (!vault.key || !goal.ownerWrappedGoalKey) throw new Error('Unlock the Privacy Vault before sharing this encrypted Goal.');
        const [currentUser, staffKey] = await Promise.all([goalApi.currentUser(), sharingApi.staffKey(selectedStaffId)]);
        const goalKey = await unwrapGoalKeyForOwner(goal.ownerWrappedGoalKey, vault.key, currentUser.user.id, goal.id);
        const envelope = await createStaffGoalKeyEnvelope(goalKey, JSON.parse(staffKey.publicKey) as JsonWebKey, goal.id, selectedStaffId);
        encryptedKeyEnvelope = JSON.stringify(envelope);
        encryptionMetadata = { algorithm: envelope.algorithm, keyVersion: envelope.keyVersion, staffKeyVersion: staffKey.keyVersion };
      }
      await sharingApi.grant(goal.id, {
        granteeUserId: selectedStaffId,
        permission: 'VIEW',
        expiresAt,
        encryptedKeyEnvelope,
        encryptionMetadata,
        highlyConfidentialConfirmation: confidentialConfirmed,
      });
      await refresh();
      setIsOpen(false);
      setConfidentialConfirmed(false); setSelectedStaffId('');
      showToast('Goal access granted to the selected SOPET staff member.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to grant Goal access.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  const revoke = async (grantId: string) => {
    if (revoking) return;
    if (!window.confirm('Revoke this staff member\'s access to this Goal?')) return;
    setRevoking(grantId);
    try {
      let rotated = false;
      if (goal.privacyMode === 'STANDARD_PRIVATE') {
        await sharingApi.revoke(goal.id, grantId);
      } else {
        if (!vault.key) throw new Error('Unlock the Privacy Vault before revoking encrypted access.');
        const current = await goalApi.currentUser();
        const snapshot = await sharingApi.beginEncryptedRevocation(goal.id, grantId) as GoalRotationSnapshot;
        try {
          const payload = await buildGoalKeyRotation(snapshot, vault.key, current.user.id);
          await sharingApi.commitEncryptedRevocation(goal.id, grantId, payload);
          rotated = true;
        } catch (error) {
          const code = error instanceof Error ? error.message : 'KEY_ROTATION_FAILED';
          await sharingApi.failEncryptedRevocation(goal.id, grantId, snapshot.rotationId, code).catch(() => undefined);
          throw new Error('Revocation is not complete. Key rotation failed and can be resumed safely.');
        }
      }
      await refresh();
      showToast(rotated ? 'Goal access revoked and encrypted content rotated.' : 'Goal access revoked.', 'success');
      if (rotated) window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to revoke Goal access.', 'warning');
    } finally {
      setRevoking(null);
    }
  };

  const activeGrants = grants.filter(item => item.status === 'ACTIVE' && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()));
  return (
    <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <LockKeyhole className="w-4 h-4 text-[#155A8A] mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-[#0E3C5B]">Privacy &amp; Sharing</h2>
            <p className="mt-1 text-xs font-semibold text-[#155A8A]">{privacyLabels[goal.privacyMode ?? 'STANDARD_PRIVATE']}</p>
            <p className="text-xs text-gray-600">{fetching ? 'Loading access grants…' : loadError ? 'Sharing status unavailable.' : activeGrants.length ? 'Shared only with the staff listed below.' : 'Not Shared — only you can view this Goal.'}</p>
          </div>
        </div>
        <button disabled={fetching || Boolean(loadError) || isLoading} onClick={() => { setIsOpen(value => !value); setConfidentialConfirmed(false); }} className="inline-flex items-center gap-1 text-xs font-semibold text-[#155A8A]" title="Share this Goal with authorized SOPET staff">
          <Share2 className="w-4 h-4" /> Share
        </button>
      </div>

      {loadError && <p role="alert" className="error-notice">{loadError} <button className="underline" onClick={() => void refresh()}>Retry</button></p>}

      {activeGrants.length > 0 && <div className="space-y-2">
        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Shared with</p>
        {activeGrants.map(grantItem => <div key={grantItem.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2"><UserRound className="w-4 h-4 text-teal-700" /><span className="font-semibold text-gray-800">{grantItem.grantee?.fullName || grantItem.grantee?.email || grantItem.granteeUserId}</span><span className="text-gray-500">{grantItem.granteeRoleSnapshot} · View only</span><span className="w-full text-slate-500">Granted: {grantItem.grantedAt ? new Date(grantItem.grantedAt).toLocaleString() : 'Not available'} · Expires: {grantItem.expiresAt ? new Date(grantItem.expiresAt).toLocaleString() : 'Until revoked'}</span></div>
          <div className="flex items-center gap-2">
            {grantItem.revocationRotationId && <span className="text-amber-700">{grantItem.revocationError ? 'Rotation failed - retry required' : 'Revocation pending key rotation'}</span>}
            <button disabled={Boolean(revoking)} onClick={() => void revoke(grantItem.id)} className="text-rose-700 hover:text-rose-900" title={grantItem.revocationRotationId ? 'Retry encrypted revocation' : 'Revoke access'} aria-label="Revoke access">{revoking === grantItem.id ? 'Revoking…' : <X className="w-4 h-4" />}</button>
          </div>
        </div>)}
      </div>}

      {!fetching && !loadError && <details className="border-t border-slate-100 pt-3 text-xs"><summary className="cursor-pointer font-semibold text-[#155A8A]">Access history ({grants.length})</summary>{grants.length ? <ul className="mt-3 space-y-3">{grants.map(item => <li key={item.id} className="rounded-lg bg-slate-50 p-3 space-y-1"><p className="font-semibold">{item.grantee?.fullName || item.grantee?.email || item.granteeUserId}</p><p>{item.permission} · {item.status === 'ACTIVE' && item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now() ? 'EXPIRED' : item.status}</p><p>Granted: {item.grantedAt ? new Date(item.grantedAt).toLocaleString() : 'Not available'}</p><p>Expires: {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : 'Until revoked'}</p><p>Last viewed: {item.lastViewedAt ? new Date(item.lastViewedAt).toLocaleString() : 'Not recorded'}</p></li>)}</ul> : <p className="mt-2 text-slate-500">No access has been granted.</p>}</details>}

      {isOpen && <div className="border-t border-gray-100 pt-3 space-y-3">
        <div><h3 className="text-sm font-bold text-[#0E3C5B]">Share this Goal</h3><p className="text-xs text-gray-600">The selected SOPET staff member can view this Goal only. Other Goals and your Privacy Vault remain private.</p></div>
        <label className="block text-xs font-semibold text-gray-700">Authorized SOPET staff member<select value={selectedStaffId} onChange={event => setSelectedStaffId(event.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-xs bg-white"><option value="">Choose staff member</option>{staff.map(person => <option key={person.id} value={person.id}>{person.fullName || person.email}</option>)}</select></label>
        <div><p className="text-xs font-semibold text-gray-700 mb-1">Access: View only</p><div className="flex flex-wrap gap-3 text-xs"><label><input type="radio" name="sharing-duration" checked={duration === 'until-revoked'} onChange={() => setDuration('until-revoked')} /> Until I revoke</label><label><input type="radio" name="sharing-duration" checked={duration === '24-hours'} onChange={() => setDuration('24-hours')} /> 24 hours</label><label><input type="radio" name="sharing-duration" checked={duration === '7-days'} onChange={() => setDuration('7-days')} /> 7 days</label></div></div>
        {goal.privacyMode === 'HIGHLY_CONFIDENTIAL' && <label className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2"><input type="checkbox" checked={confidentialConfirmed} onChange={event => setConfidentialConfirmed(event.target.checked)} className="mt-0.5" /><span>I understand this Highly Confidential Goal will be decrypted on the selected staff member's device for view-only support. Sharing does not lower its privacy mode.</span></label>}
        <div className="flex justify-end gap-2"><button onClick={() => setIsOpen(false)} className="text-xs px-3 py-1.5 text-gray-600">Cancel</button><button disabled={!selectedStaffId || isLoading || (goal.privacyMode === 'HIGHLY_CONFIDENTIAL' && !confidentialConfirmed)} onClick={() => void grant()} className="text-xs px-3 py-1.5 rounded-lg bg-[#155A8A] text-white disabled:opacity-50">Grant Access</button></div>
      </div>}
    </section>
  );
};
