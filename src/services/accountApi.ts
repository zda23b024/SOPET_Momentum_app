import { apiRequest } from './http';
import type { PrivacyMode } from '../crypto/privacyTypes';
export interface AccountProfile {
  id: string; fullName?: string; email: string; isEmailVerified?: boolean;
  privacyMode: PrivacyMode; mfaEnabled: boolean; createdAt: string;
  profile?: { language?: string; locale?: string; timezone?: string };
  notifications?: Record<string, unknown>;
}
export interface Session { id: string; ipAddress?: string; userAgent?: string; createdAt: string; lastActiveAt?: string; expiresAt: string; }
const post = (body?: unknown) => ({ method: 'POST', body: JSON.stringify(body ?? {}) });
export const accountApi = {
  profile: () => apiRequest<AccountProfile>('/users/profile'),
  privacy: (mode: PrivacyMode) => apiRequest('/users/privacy-mode', { method: 'PATCH', body: JSON.stringify({ mode }) }),
  password: (currentPass: string, newPass: string) => apiRequest('/users/change-password', post({ currentPass, newPass })),
  requestDeletion: () => apiRequest<{ scheduledFor: string }>('/users/delete-account', post()),
  sessions: () => apiRequest<Session[]>('/sessions'),
  revokeOthers: () => apiRequest('/sessions', { method: 'DELETE' }),
  enrollMfa: () => apiRequest<{ secret: string; issuer: string }>('/auth/mfa/enroll', post()),
  confirmMfa: (totpCode: string) => apiRequest<{ recoveryCodes: string[] }>('/auth/mfa/confirm', post({ totpCode })),
};
