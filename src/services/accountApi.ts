import { apiRequest } from './http';
import type { PrivacyMode } from '../crypto/privacyTypes';
export interface AccountProfile {
  id: string; fullName?: string; email: string; isEmailVerified?: boolean;
  privacyMode: PrivacyMode; mfaEnabled: boolean; createdAt: string;
  profile?: { locale?: string; timezone?: string };
  notifications?: NotificationPreferences;
}
export interface NotificationPreferences {
  emailWeeklyReview: boolean;
  emailRestartReminders: boolean;
  inAppNmaPrompts: boolean;
  inAppBarrierCheckins: boolean;
}
export interface SecurityEvent { id: string; eventType: string; severity: string; createdAt: string; }
export interface Session { id: string; ipAddress?: string; userAgent?: string; createdAt: string; lastActiveAt?: string; expiresAt: string; }
const post = (body?: unknown) => ({ method: 'POST', body: JSON.stringify(body ?? {}) });
export const accountApi = {
  profile: () => apiRequest<AccountProfile>('/users/profile'),
  updateProfile: (input: { fullName: string; timezone: string }) => apiRequest<AccountProfile>('/users/profile', { method: 'PATCH', body: JSON.stringify(input) }),
  updateNotifications: (input: NotificationPreferences) => apiRequest<NotificationPreferences>('/users/notifications', { method: 'PATCH', body: JSON.stringify(input) }),
  securityEvents: () => apiRequest<SecurityEvent[]>('/users/security-events'),
  encryptedArchive: () => apiRequest<Record<string, unknown>>('/export/me'),
  privacy: (mode: PrivacyMode) => apiRequest('/users/privacy-mode', { method: 'PATCH', body: JSON.stringify({ mode }) }),
  password: (currentPass: string, newPass: string) => apiRequest('/users/change-password', post({ currentPass, newPass })),
  requestDeletion: () => apiRequest<{ scheduledFor: string }>('/users/delete-account', post()),
  sessions: () => apiRequest<Session[]>('/sessions'),
  revokeOthers: () => apiRequest('/sessions', { method: 'DELETE' }),
  enrollMfa: () => apiRequest<{ secret: string; issuer: string }>('/auth/mfa/enroll', post()),
  confirmMfa: (totpCode: string) => apiRequest<{ recoveryCodes: string[] }>('/auth/mfa/confirm', post({ totpCode })),
  regenerateMfaCodes: (currentPassword: string, proof: string) => apiRequest<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', post({ currentPassword, ...(/^[0-9]{6}$/.test(proof) ? { totpCode: proof } : { recoveryCode: proof }) })),
  disableMfa: (currentPassword: string, proof: string) => apiRequest('/auth/mfa/disable', post({ currentPassword, ...(/^[0-9]{6}$/.test(proof) ? { totpCode: proof } : { recoveryCode: proof }) })),
};
