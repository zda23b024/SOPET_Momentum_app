import { apiRequest, clearCsrfToken } from './http';

export const APP_MODE = import.meta.env.VITE_APP_MODE === 'demo' ? 'demo' : 'production';
export const isDemoMode = APP_MODE === 'demo';

const request = apiRequest;

export const authApi = {
  me: () => request<{ user: { id: string; email: string; fullName?: string; roles?: string[]; permissions?: string[]; privacyMode?: string } }>('/auth/me'),
  login: (email: string, password: string, totpCode?: string) => request<{ mfaRequired: true; tempSessionId: string } | { user: { id: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, totpCode }) }),
  register: (fullName: string, email: string, password: string) => request<{ user: { id: string }; verificationRequired: boolean; verificationPending?: boolean; verificationEmailStatus?: string; verificationUrl?: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ fullName, email, password }) }),
  verifyEmail: (token: string) => request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: (email: string) => request<{ verificationUrl?: string }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  forgotPassword: (email: string) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  logout: async () => { const result = await request('/auth/logout', { method: 'POST' }); clearCsrfToken(); return result; },
};

export const domainApi = {
  taxonomy: () => request<any[]>('/barriers/taxonomy'),
  goals: () => request<any[]>('/goals'),
  createGoal: (input: Record<string, unknown>) => request<any>('/goals', { method: 'POST', body: JSON.stringify(input) }),
  updateGoalStatus: (goalId: string, status: string, reason?: string) => request<any>(`/goals/${goalId}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),
  actions: () => request<any[]>('/actions'),
  createAction: (input: Record<string, unknown>) => request<any>('/actions', { method: 'POST', body: JSON.stringify(input) }),
  updateActionStatus: (actionId: string, status: string) => request<any>(`/actions/${actionId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  rescheduleAction: (actionId: string, scheduledDate: string) => request<any>(`/actions/${actionId}/schedule`, { method: 'PATCH', body: JSON.stringify({ scheduledDate }) }),
  designateNma: (actionId: string) => request<any>(`/actions/${actionId}/nma`, { method: 'POST', body: '{}' }),
  milestones: () => request<any[]>('/milestones'),
  createMilestone: (input: Record<string, unknown>) => request<any>('/milestones', { method: 'POST', body: JSON.stringify(input) }),
  updateMilestone: (id: string, input: Record<string, unknown>) => request<any>(`/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteMilestone: (id: string) => request<any>(`/milestones/${id}`, { method: 'DELETE' }),
  assessReadiness: (actionId: string, input: Record<string, unknown>) => request<any>(`/actions/${actionId}/readiness`, { method: 'POST', body: JSON.stringify(input) }),
  barriers: () => request<any[]>('/barriers'),
  blockAction: (actionId: string, input: Record<string, unknown>) => request<any>(`/actions/${actionId}/block`, { method: 'POST', body: JSON.stringify(input) }),
  confirmBarrier: (actionId: string, input: Record<string, unknown>) => request<any>(`/actions/${actionId}/barriers/confirm`, { method: 'POST', body: JSON.stringify(input) }),
  interventions: () => request<any[]>('/interventions'),
  applyIntervention: (actionId: string, input: Record<string, unknown>) => request<any>(`/actions/${actionId}/interventions`, { method: 'POST', body: JSON.stringify(input) }),
  createMma: (actionId: string, input: Record<string, unknown>) => request<any>(`/actions/${actionId}/mma`, { method: 'POST', body: JSON.stringify(input) }),
  startMma: (mmaId: string) => request<any>(`/mma/${mmaId}/start`, { method: 'PATCH', body: '{}' }),
  completeMma: (mmaId: string) => request<any>(`/mma/${mmaId}/complete`, { method: 'PATCH', body: '{}' }),
  restarts: (goalId: string) => request<any[]>(`/goals/${goalId}/restarts`),
  createRestart: (goalId: string, input: Record<string, unknown>) => request<any>(`/goals/${goalId}/restart`, { method: 'POST', body: JSON.stringify(input) }),
  kpis: () => request<any[]>('/kpis'),
  momentumKpis: () => request<any>('/kpis/momentum'),
  createKpi: (input: Record<string, unknown>) => request<any>('/kpis', { method: 'POST', body: JSON.stringify(input) }),
  recordKpi: (id: string, input: Record<string, unknown>) => request<any>(`/kpis/${id}/values`, { method: 'POST', body: JSON.stringify(input) }),
  reviews: () => request<any[]>('/reviews'),
  createReview: (input: Record<string, unknown>) => request<any>('/reviews', { method: 'POST', body: JSON.stringify(input) }),
  lessons: () => request<any[]>('/lessons'),
  adjustments: () => request<any[]>('/adjustments'),
};

export const sharingApi = {
  staff: () => request<Array<{ id: string; email: string; fullName?: string; userRoles: Array<{ role: { name: string } }> }>>('/sharing/staff'),
  grants: (goalId: string) => request<any[]>(`/goals/${goalId}/access-grants`),
  grant: (goalId: string, input: Record<string, unknown>) => request(`/goals/${goalId}/access-grants`, { method: 'POST', body: JSON.stringify(input) }),
  revoke: (goalId: string, grantId: string) => request(`/goals/${goalId}/access-grants/${grantId}`, { method: 'DELETE' }),
  beginEncryptedRevocation: (goalId: string, grantId: string) => request<any>(`/goals/${goalId}/access-grants/${grantId}/revocation/begin`, { method: 'POST', body: '{}' }),
  commitEncryptedRevocation: (goalId: string, grantId: string, input: Record<string, unknown>) => request<any>(`/goals/${goalId}/access-grants/${grantId}/revocation/commit`, { method: 'PUT', body: JSON.stringify(input) }),
  failEncryptedRevocation: (goalId: string, grantId: string, rotationId: string, errorCode: string) => request<any>(`/goals/${goalId}/access-grants/${grantId}/revocation/fail`, { method: 'POST', body: JSON.stringify({ rotationId, errorCode }) }),
  sharedWithMe: () => request<any[]>('/admin/shared-goals'),
  openSharedGoal: (goalId: string) => request<any>(`/admin/shared-goals/${goalId}`),
  staffKey: (userId: string) => request<{ userId: string; algorithm: string; publicKey: string; keyVersion: number }>(`/sharing/staff/${userId}/key`),
  ownKey: () => request<any | null>('/admin/sharing-key'),
  registerKey: (input: Record<string, unknown>) => request('/admin/sharing-key', { method: 'POST', body: JSON.stringify(input) }),
};

export { apiRequest };
