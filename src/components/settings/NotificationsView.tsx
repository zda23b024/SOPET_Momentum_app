import React from 'react';
import { useApp } from '../../context/AppContext';
import { WorkspaceState } from '../common/WorkspaceState';

export function NotificationsView() {
  const { actions, weeklyReviews, goals, setActiveView, openBarrierReview } = useApp();
  const blocked = actions.filter(a => a.status === 'Blocked');
  const overdue = actions.filter(a => a.status !== 'Completed' && a.dueDate && new Date(a.dueDate).getTime() < Date.now());
  const reviewDue = goals.some(g => g.status === 'Active') && !weeklyReviews.some(r => Date.now() - new Date(r.createdAt).getTime() < 7 * 86400000);
  return <div className="page-shell"><h1 className="page-title">Notifications</h1><p className="text-sm text-slate-600">Reminders from your current Goals and Actions.</p>
    {!blocked.length && !overdue.length && !reviewDue ? <WorkspaceState title="You're up to date" description="New reminders will appear here when an Action needs attention or a Weekly Review is due." /> : <div className="space-y-3">
      {blocked.map(a => <section key={a.id} className="settings-card"><h2 className="font-semibold">An Action is blocked</h2><p className="text-sm">{a.title}</p><button className="secondary-button" onClick={() => openBarrierReview(a.id)}>Review Barrier</button></section>)}
      {!!overdue.length && <section className="settings-card"><h2 className="font-semibold">{overdue.length} {overdue.length === 1 ? 'Action needs' : 'Actions need'} a date review</h2><button className="secondary-button" onClick={() => setActiveView('goals')}>Review Actions</button></section>}
      {reviewDue && <section className="settings-card"><h2 className="font-semibold">Make time for your Weekly Review</h2><p className="text-sm text-slate-600">Reflect on progress, capture a Lesson and choose an Adjustment.</p><button className="secondary-button" onClick={() => setActiveView('review')}>Open Weekly Review</button></section>}
    </div>}
  </div>;
}
