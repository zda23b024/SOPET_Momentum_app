import type { EncryptedContentEnvelope, PrivacyMode } from '../crypto/privacyTypes';
import { apiRequest as request } from './http';

export const goalApi = {
  currentUser: () => request<{ user: { id: string } }>('/auth/me'),
  createEncrypted: (input: { id: string; privacyMode: Exclude<PrivacyMode, 'STANDARD_PRIVATE'>; targetDate: string; isPrimary: boolean; encryptedPayload: EncryptedContentEnvelope; ownerWrappedGoalKey: EncryptedContentEnvelope }) =>
    request('/goals', { method: 'POST', body: JSON.stringify({ ...input, contentEncoding: 'CLIENT_ENCRYPTED' }) }),
};
