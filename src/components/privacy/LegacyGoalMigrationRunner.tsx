import { useEffect, useRef } from 'react';
import { usePrivacyVault } from '../../context/privacy/PrivacyVaultContext';
import { useApp } from '../../context/AppContext';
import { authApi, isDemoMode } from '../../services/api';
import { goalMigrationApi } from '../../services/goalMigrationApi';
import { migrateLegacyGoals } from '../../crypto/legacyGoalMigration';

export function LegacyGoalMigrationRunner() {
  const vault = usePrivacyVault();
  const { showToast } = useApp();
  const running = useRef(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (vault.status !== 'unlocked') { attempted.current = false; return; }
    if (isDemoMode || !vault.key || running.current || attempted.current) return;
    running.current = true;
    attempted.current = true;
    authApi.me().then(result => migrateLegacyGoals(goalMigrationApi, vault.key!, result.user.id)).then(summary => {
      if (summary.migrated.length) showToast(`${summary.migrated.length} encrypted Goal${summary.migrated.length === 1 ? '' : 's'} upgraded to per-Goal encryption.`, 'success');
      if (summary.failed.length) showToast(`${summary.failed.length} encrypted Goal migration${summary.failed.length === 1 ? '' : 's'} could not be completed. Your existing ciphertext was preserved.`, 'warning');
    }).catch(() => showToast('Encrypted Goal migration could not be started. Existing ciphertext was preserved.', 'warning')).finally(() => { running.current = false; });
  }, [vault.status, vault.key]);
  return null;
}
