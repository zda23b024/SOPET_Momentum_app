import type { VaultKeyMetadata } from '../crypto/privacyTypes';
import { apiRequest as request } from './http';

export const privacyApi = {
  getVault: () => request<VaultKeyMetadata | null>('/privacy/keys/metadata'),
  saveVault: (metadata: VaultKeyMetadata) => request<{ success: true; keyId: string }>('/privacy/keys', { method: 'PUT', body: JSON.stringify(metadata) }),
};
