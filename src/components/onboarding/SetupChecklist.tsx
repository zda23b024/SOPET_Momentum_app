import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { isDemoMode } from '../../services/api';

export function SetupChecklist() {
  const { goals, milestones, actions, setActiveView, setSelectedGoalId, setIsCreateGoalOpen } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const goal = goals.find(g => g.status === 'Active') ?? goals[0];
  const hasMilestone = milestones.some(m => m.goalId === goal?.id);
  const hasNma = actions.some(a => a.goalId === goal?.id && a.isNMA);
  if (isDemoMode || (goal && hasMilestone && hasNma)) return null;
  const openGoal = () => { if (!goal) setIsCreateGoalOpen(true); else { setSelectedGoalId(goal.id); setActiveView('goals'); } };
  return <section className="mx-auto mt-6 max-w-4xl px-4 sm:px-6" aria-label="Getting started"><div className="rounded-2xl border border-blue-200 bg-white p-5">
    <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold text-[#0E3C5B]">Your first steps</h2><button className="text-sm text-[#155A8A] underline" onClick={() => setCollapsed(!collapsed)}>{collapsed ? 'Resume setup' : 'Continue later'}</button></div>
    {!collapsed && <><p className="mt-2 text-sm text-slate-600">Build your foundation at your own pace. Saved progress stays with your account.</p><ol className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
      <li><button className="setup-step" onClick={() => setActiveView('settings')}>1. Review profile and privacy defaults</button></li>
      <li><button className="setup-step" onClick={openGoal}>{goal ? '✓' : '2.'} Create a Goal and Why This Matters</button></li>
      <li><button className="setup-step" onClick={openGoal}>{hasMilestone ? '✓' : '3.'} Add your first Milestone</button></li>
      <li><button className="setup-step" onClick={openGoal}>{hasNma ? '✓' : '4.'} Create your first NMA</button></li>
    </ol></>}
  </div></section>;
}
