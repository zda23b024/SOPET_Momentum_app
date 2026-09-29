/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { isDemoMode } from './services/api';
import { DialogAccessibility } from './components/common/DialogAccessibility';
import { WorkspaceState } from './components/common/WorkspaceState';
import { NotificationsView } from './components/settings/NotificationsView';
import { SetupChecklist } from './components/onboarding/SetupChecklist';
import { officialLogo } from './components/common/BrandLogo';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { LandingPage } from './components/layout/LandingPage';
import { TodayFocusView } from './components/today/TodayFocusView';
import { GoalListView } from './components/goals/GoalListView';
import { GoalDetailView } from './components/goals/GoalDetailView';
import { ProgressKpiView } from './components/progress/ProgressKpiView';
import { WeeklyReviewView } from './components/review/WeeklyReviewView';
import { SettingsPrivacyView } from './components/settings/SettingsPrivacyView';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { AuthModal } from './components/auth/AuthModal';
import { LightweightOnboarding } from './components/onboarding/LightweightOnboarding';
import { CreateGoalModal } from './components/goals/CreateGoalModal';
import { ActionReadinessModal } from './components/readiness/ActionReadinessModal';
import { BarrierReviewModal } from './components/barrier/BarrierReviewModal';
import { MmaModal } from './components/mma/MmaModal';
import { IntelligentRestartModal } from './components/restart/IntelligentRestartModal';
import { WeeklyReviewModal } from './components/review/WeeklyReviewModal';
import { Toast } from './components/common/Toast';
import { PrivacyVaultProvider } from './context/privacy/PrivacyVaultContext';
import { LegacyGoalMigrationRunner } from './components/privacy/LegacyGoalMigrationRunner';
import { AiConsentProvider } from './context/ai/AiConsentContext';
import { AuthLinkHandler } from './components/auth/AuthLinkHandler';
import { BrandLogo } from './components/common/BrandLogo';
import { isAdministrationPath } from './services/adminNavigation';

const MainContent: React.FC = () => {
  const {
    isAuthenticated,
    authStatus,
    authError,
    activeView,
    activeRole,
    selectedGoalId,
    setSelectedGoalId,
    pendingRequests,
    dataLoading,
    isCreateGoalOpen, isReadinessModalOpen, isBarrierReviewOpen,
    isMmaModalOpen, isRestartModalOpen, isWeeklyReviewModalOpen,
  } = useApp();

  if (authStatus === 'checking') return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-center space-y-4"><BrandLogo className="h-24 w-auto mx-auto" /><p className="text-sm text-gray-600">Loading SOPET Momentum...</p></div></div>;
  if (authStatus === 'error') return <div className="min-h-screen bg-[#EAF4FB] flex items-center justify-center p-4"><div className="max-w-md bg-white border border-gray-200 rounded-lg p-6 text-center space-y-4"><BrandLogo className="h-20 w-auto mx-auto" /><h1 className="text-xl font-bold text-[#0E3C5B]">Service unavailable</h1><p className="text-sm text-gray-600">{authError}</p><button onClick={() => window.location.reload()} className="rounded-lg bg-[#155A8A] px-4 py-2 text-sm font-semibold text-white">Try again</button></div></div>;

  // If not signed in to the prototype, show the public Landing Page
  if (!isAuthenticated) {
    return isDemoMode ? <LandingPage /> : null;
  }

  const administrationRoute = isAdministrationPath(window.location.pathname);


  return (
    <div className="min-h-screen bg-[#EAF4FB] text-[#1E293B] flex flex-col">
      <fieldset disabled={pendingRequests > 0} className="contents" aria-busy={pendingRequests > 0}>
      <Header />
      <main id="main-content" className="flex-1 min-w-0 pb-12">
        {administrationRoute ? activeRole === 'admin' ? <AdminDashboardView /> : <WorkspaceState title="403 — Access restricted" description="Your account does not have access to administration." action={<a className="primary-button" href="/">Return to SOPET Momentum</a>} /> : dataLoading && activeView !== 'settings' ? <WorkspaceState loading title="Loading your workspace…" /> : <>
        {activeView === 'today' && <><SetupChecklist /><TodayFocusView /></>}

        {activeView === 'goals' && (
          <>
            {selectedGoalId ? (
              <GoalDetailView
                goalId={selectedGoalId}
                onBack={() => setSelectedGoalId(null)}
              />
            ) : (
              <GoalListView onSelectGoal={id => setSelectedGoalId(id)} />
            )}
          </>
        )}

        {activeView === 'progress' && <ProgressKpiView />}
        {activeView === 'review' && <WeeklyReviewView />}
        {activeView === 'settings' && <SettingsPrivacyView />}
        {activeView === 'notifications' && <NotificationsView />}
        {activeView === 'admin' && (activeRole === 'admin' ? <AdminDashboardView /> : <WorkspaceState title="403 — Access restricted" description="Your account does not have access to administration." />)}
        </>}
      </main>

      {/* Global Modals */}
      {isCreateGoalOpen && <CreateGoalModal />}
      {isReadinessModalOpen && <ActionReadinessModal />}
      {isBarrierReviewOpen && <BarrierReviewModal />}
      {isMmaModalOpen && <MmaModal />}
      {isRestartModalOpen && <IntelligentRestartModal />}
      {isWeeklyReviewModalOpen && <WeeklyReviewModal />}
      </fieldset>
      {pendingRequests > 0 && <div role="status" className="fixed bottom-4 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-[#0E3C5B] px-4 py-2 text-sm text-white shadow-lg">Saving…</div>}
    </div>
  );
};

export default function App() {
  useEffect(() => {
    if (!officialLogo) return;
    const icon = document.createElement('link'); icon.rel = 'icon'; icon.type = 'image/png'; icon.href = officialLogo; document.head.appendChild(icon);
    return () => { icon.remove(); };
  }, []);
  if (!['/', '/index.html'].includes(window.location.pathname) && !isAdministrationPath(window.location.pathname)) return <WorkspaceState title="404 — Page not found" description="This page does not exist." action={<a className="primary-button" href="/">Return to SOPET Momentum</a>} />;
  return (
    <PrivacyVaultProvider>
      <AiConsentProvider><AppProvider>
        <DialogAccessibility />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <LegacyGoalMigrationRunner />
        <AuthLinkHandler />
        <MainContent />
        {/* Auth & Onboarding are rendered at top level so they can trigger from landing page */}
        <AuthModal />
        <LightweightOnboarding />
        <Toast />
      </AppProvider></AiConsentProvider>
    </PrivacyVaultProvider>
  );
}
