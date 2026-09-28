import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createVault, rewrapPassphrase, rotateRecoveryKey, unlockWithPassphrase, unlockWithRecoveryKey } from '../../crypto/vault';
import type { VaultKeyMetadata } from '../../crypto/privacyTypes';
import { privacyApi } from '../../services/privacyApi';
import { ApiError } from '../../services/http';
import { isDemoMode } from '../../services/api';

type VaultStatus = 'loading' | 'not-configured' | 'locked' | 'unlocked' | 'error';
interface PrivacyVaultContextValue {
  status: VaultStatus;
  key: CryptoKey | null;
  metadata: VaultKeyMetadata | null;
  refresh(): Promise<void>;
  setup(passphrase: string): Promise<string>;
  unlock(passphrase: string): Promise<void>;
  lock(): void;
  recover(recoveryKey: string, newPassphrase: string): Promise<void>;
  changePassphrase(newPassphrase: string): Promise<void>;
  rotateRecovery(): Promise<string>;
}

const PrivacyVaultContext = createContext<PrivacyVaultContextValue | null>(null);

export const PrivacyVaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [metadata, setMetadata] = useState<VaultKeyMetadata | null>(null);

  const refresh = async () => {
    setStatus('loading');
    try { const value = await privacyApi.getVault(); setMetadata(value); setStatus(value ? 'locked' : 'not-configured'); }
    catch { setStatus('error'); }
  };
  useEffect(() => {
    if (isDemoMode) { setStatus('not-configured'); return; }
    let active = true;
    privacyApi.getVault().then(value => {
      if (!active) return;
      setMetadata(value);
      setStatus(value ? 'locked' : 'not-configured');
    }).catch(error => { if (active) setStatus(error instanceof ApiError && error.status === 401 ? 'locked' : 'error'); });
    return () => { active = false; setKey(null); };
  }, []);

  const lock = useCallback(() => { window.dispatchEvent(new CustomEvent('sopet:vault-locked')); setKey(null); setStatus(current => current === 'error' ? 'error' : metadata ? 'locked' : current === 'unlocked' ? 'not-configured' : current); }, [metadata]);
  const save = async (next: VaultKeyMetadata) => { await privacyApi.saveVault(next); setMetadata(next); };

  const setup = async (passphrase: string) => {
    const created = await createVault(passphrase);
    await save(created.metadata);
    setKey(created.dataKey);
    setStatus('unlocked');
    return created.recoveryKey;
  };
  const unlock = async (passphrase: string) => {
    if (!metadata) throw new Error('VAULT_NOT_CONFIGURED');
    setKey(await unlockWithPassphrase(metadata, passphrase));
    setStatus('unlocked');
  };
  const recover = async (recoveryKey: string, newPassphrase: string) => {
    if (!metadata) throw new Error('VAULT_NOT_CONFIGURED');
    const recovered = await unlockWithRecoveryKey(metadata, recoveryKey);
    const next = await rewrapPassphrase(recovered, metadata, newPassphrase);
    await save(next); setKey(recovered); setStatus('unlocked');
  };
  const changePassphrase = async (newPassphrase: string) => {
    if (!metadata || !key) throw new Error('VAULT_LOCKED');
    await save(await rewrapPassphrase(key, metadata, newPassphrase));
  };
  const rotateRecovery = async () => {
    if (!metadata || !key) throw new Error('VAULT_LOCKED');
    const rotated = await rotateRecoveryKey(key, metadata);
    await save(rotated.metadata);
    return rotated.recoveryKey;
  };

  return <PrivacyVaultContext.Provider value={{ status, key, metadata, refresh, setup, unlock, lock, recover, changePassphrase, rotateRecovery }}>{children}</PrivacyVaultContext.Provider>;
};

export function usePrivacyVault() {
  const value = useContext(PrivacyVaultContext);
  if (!value) throw new Error('usePrivacyVault must be used within PrivacyVaultProvider');
  return value;
}
