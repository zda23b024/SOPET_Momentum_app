import React from 'react';
import { useApp } from '../../context/AppContext';
import { WorkspaceState } from '../common/WorkspaceState';

export function ProductionProgress() {
  const { actions, milestones, barriers, weeklyReviews, lessons, setActiveView } = useApp();
  const completed = actions.filter(a => a.status === 'Completed').length;
  const finishedMilestones = milestones.filter(m => m.completed).length;
  const resolved = barriers.filter(b => b.resolved).length;
  const metrics = [
    ['Action completion', actions.length ? `${Math.round(completed / actions.length * 100)}%` : 'No data yet', `${completed} of ${actions.length} Actions completed`],
    ['Milestone progress', milestones.length ? `${Math.round(finishedMilestones / milestones.length * 100)}%` : 'No data yet', `${finishedMilestones} of ${milestones.length} Milestones completed`],
    ['Barrier resolution', barriers.length ? `${Math.round(resolved / barriers.length * 100)}%` : 'No data yet', `${resolved} of ${barriers.length} Barriers resolved`],
    ['Weekly Reviews', weeklyReviews.length ? String(weeklyReviews.length) : 'No data yet', 'Saved reflection cycles'],
    ['Restart speed', 'No data yet', 'A verified recovery-time metric is not available yet'],
    ['Self-efficacy', 'No data yet', 'No recorded self-efficacy assessments'],
  ];
  return <div className="page-shell"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="page-title">Progress & KPIs</h1><p className="mt-1 text-sm text-slate-600">Observable progress from your saved Actions, Milestones and Reviews.</p></div><button className="secondary-button" onClick={() => setActiveView('review')}>Weekly Review</button></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([title,value,detail]) => <section className="settings-card" key={title}><h2 className="text-sm font-semibold text-slate-600">{title}</h2><p className="text-2xl font-bold text-[#0E3C5B]">{value}</p><p className="text-xs text-slate-500">{detail}</p></section>)}</div>
    <section className="settings-card"><h2 className="text-lg font-bold text-[#0E3C5B]">Lessons & Adjustments</h2>{lessons.length ? <ul className="space-y-4">{lessons.slice(0,5).map(lesson => <li key={lesson.id} className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-500">{new Date(lesson.date).toLocaleDateString()}</p><p className="mt-1 text-sm"><strong>Lesson:</strong> {lesson.lesson}</p><p className="mt-1 text-sm"><strong>Adjustment:</strong> {lesson.adjustmentMade || 'Not recorded'}</p></li>)}</ul> : <p className="text-sm text-slate-600">No Lessons yet. Capture one during your next Weekly Review.</p>}</section>
    {!actions.length && !milestones.length && <WorkspaceState title="Build your first progress record" description="Create a Goal, define a Milestone and choose your first NMA." action={<button className="primary-button" onClick={() => setActiveView('goals')}>Go to Goals</button>} />}
  </div>;
}
