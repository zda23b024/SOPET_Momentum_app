import React, { useEffect, useState } from 'react';
import { isDemoMode, sharingApi } from '../../services/api';
import { privacyLabels } from '../../i18n/strings';
import type { Goal } from '../../types';

export function GoalPrivacySummary({ goal }: { goal: Goal }) {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (isDemoMode) return;
    let active = true;
    sharingApi.grants(goal.id).then(grants => { if (active) setCount(grants.filter(g => g.status === 'ACTIVE' && (!g.expiresAt || new Date(g.expiresAt).getTime() > Date.now())).length); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [goal.id]);
  return <div className="flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded border border-slate-200 px-2 py-1">{privacyLabels[goal.privacyMode ?? 'STANDARD_PRIVATE']}</span><span className="rounded border border-slate-200 px-2 py-1">{isDemoMode ? 'Demo sharing' : error ? 'Sharing status unavailable' : count === null ? 'Checking access…' : count ? `Shared · ${count} ${count === 1 ? 'person' : 'people'}` : 'Not Shared'}</span></div>;
}
