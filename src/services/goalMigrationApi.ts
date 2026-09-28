import { apiRequest } from './http';
import type { GoalMigrationApi, LegacyGoalMigrationSnapshot } from '../crypto/legacyGoalMigration';

export const goalMigrationApi: GoalMigrationApi = {
  candidates: () => apiRequest('/goals/privacy-migrations'),
  begin: (goalId: string) => apiRequest<LegacyGoalMigrationSnapshot>(`/goals/${goalId}/privacy-migration/begin`, { method: 'POST', body: '{}' }),
  commit: (goalId: string, payload: Record<string, unknown>) => apiRequest(`/goals/${goalId}/privacy-migration/commit`, { method: 'PUT', body: JSON.stringify(payload) }),
  fail: (goalId: string, migrationId: string, errorCode: string) => apiRequest(`/goals/${goalId}/privacy-migration/fail`, { method: 'POST', body: JSON.stringify({ migrationId, errorCode }) }),
};
