import React from 'react';
import { useApp } from '../../context/AppContext';
import { WorkspaceState } from '../common/WorkspaceState';

export function ProductionReview() {
  const { weeklyReviews, primaryGoal, openWeeklyReviewModal, setActiveView } = useApp();
  return <div className="page-shell"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="page-title">Weekly Review</h1><p className="mt-1 text-sm text-slate-600">Reflect on meaningful progress. Keep a Lesson and choose your next Adjustment.</p></div>{primaryGoal && <button className="primary-button" onClick={openWeeklyReviewModal}>Start Weekly Review</button>}</div>
    {!primaryGoal && <WorkspaceState title="Choose a Goal first" description="Your Weekly Review connects reflection to a meaningful Goal and its next NMA." action={<button className="primary-button" onClick={() => setActiveView('goals')}>View Goals</button>} />}
    {!weeklyReviews.length ? <WorkspaceState title="No Weekly Review available yet" description="Your saved Weekly Reviews will appear here. You can start when you are ready." /> : <div className="space-y-4">{weeklyReviews.map(review => <article className="settings-card" key={review.id}><h2 className="text-lg font-semibold text-[#0E3C5B]">Week ending {new Date(review.weekEndingDate).toLocaleDateString()}</h2><dl className="space-y-3 text-sm">{[['Meaningful progress',review.meaningfulProgress],['Actions that mattered',review.actionsThatMattered],['Barriers',review.whatGotInTheWay],['Lesson',review.lessonText],['Adjustment',review.adjustmentText],['Next NMA',review.nextNmaTitle]].map(([label,value]) => <div key={label}><dt className="font-semibold text-slate-700">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{value || 'Not recorded'}</dd></div>)}</dl></article>)}</div>}
  </div>;
}
