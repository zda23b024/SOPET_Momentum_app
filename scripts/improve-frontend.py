from pathlib import Path

def edit(path, old, new):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old not in s: raise Exception(f'Missing replacement in {path}: {old[:100]}')
    p.write_text(s.replace(old,new),encoding='utf-8')

p='src/context/AppContext.tsx'
edit(p,"useState, useEffect", "useState, useEffect, useRef")
edit(p,"interface Toast {", "import { ApiError } from '../services/http';\nimport { accountApi } from '../services/accountApi';\n\ninterface Toast {")
edit(p,"  role: string;", "  role: string;\n  roles?: string[];\n  permissions?: string[];")
edit(p,"'settings' | 'admin'", "'settings' | 'admin' | 'notifications'")
edit(p,"  authError: string | null;", "  authError: string | null;\n  sessionExpired: boolean;\n  pendingRequests: number;\n  reloadData: () => void;")
edit(p,"  const [user, setUser]", "  const [sessionExpired, setSessionExpired] = useState(false);\n  const [pendingRequests, setPendingRequests] = useState(0);\n  const [reloadVersion, setReloadVersion] = useState(0);\n  const authRef = useRef(false);\n  const signedOut = useRef(false);\n  const reloadData = () => setReloadVersion(value => value + 1);\n  const [user, setUser]")
edit(p,"    if (isDemoMode) return;\n    authApi.me()", "    if (isDemoMode || signedOut.current) return;\n    let cancelled = false;\n    setAuthStatus('checking');\n    authApi.me()")
edit(p,"      .then(({ user: backendUser }) => {", "      .then(async ({ user: backendUser }) => {\n        if (cancelled) return;\n        const profile = await accountApi.profile();\n        if (cancelled) return;\n        authRef.current = true;")
edit(p,"name: backendUser.fullName || backendUser.email,", "name: profile.fullName || backendUser.email,")
edit(p,"role: backendUser.roles?.join(', ') || 'Participant',", "role: backendUser.roles?.join(', ') || 'Participant',\n          roles: backendUser.roles ?? [], permissions: backendUser.permissions ?? [],")
edit(p,"        if (!result) return;", "        if (!result || cancelled) return;")
edit(p,"        setGoals(backendGoals.map", "        if (cancelled) return;\n        setGoals(backendGoals.map")
edit(p,"        void Promise.all(backendGoals.map", "        await Promise.all(backendGoals.map")
edit(p,"          setRestarts(records);", "          if (!cancelled) setRestarts(records);")
edit(p,"        setUser(null);\n        setIsAuthenticated(false);", "        if (cancelled) return;\n        setUser(null);\n        setIsAuthenticated(false);")
edit(p,"if (code === 'HTTP_401' || code === 'Unauthorized')", "if ((error instanceof ApiError && error.status === 401) || code === 'HTTP_401' || code === 'Unauthorized')")
edit(p,"  }, [vault.status]);", "    return () => { cancelled = true; };\n  }, [vault.status, reloadVersion]);\n\n  useEffect(() => {\n    const expire = () => {\n      if (!authRef.current) return;\n      signedOut.current = true; authRef.current = false;\n      vault.lock(); setUser(null); setIsAuthenticated(false); setSessionExpired(true);\n      setAuthStatus('unauthenticated'); setGoals([]); setActions([]); setMilestones([]);\n      setBarriers([]); setWeeklyReviews([]); setLessons([]); setRestarts([]);\n      setIsCreateGoalOpen(false); setIsReadinessModalOpen(false); setIsBarrierReviewOpen(false);\n      setIsMmaModalOpen(false); setIsRestartModalOpen(false); setIsWeeklyReviewModalOpen(false); setIsOnboardingOpen(false);\n    };\n    const pending = (event: Event) => setPendingRequests((event as CustomEvent<number>).detail);\n    window.addEventListener('sopet:session-expired', expire); window.addEventListener('sopet:pending', pending);\n    return () => { window.removeEventListener('sopet:session-expired', expire); window.removeEventListener('sopet:pending', pending); };\n  }, [vault.lock]);")
edit(p,"const [knowledgeBase] = useState<KnowledgeBaseEntry[]>(KNOWLEDGE_BASE_ENTRIES);", "const [knowledgeBase] = useState<KnowledgeBaseEntry[]>(isDemoMode ? KNOWLEDGE_BASE_ENTRIES : []);")
edit(p,"const [promptTemplates] = useState<AiPromptTemplate[]>(INITIAL_PROMPT_TEMPLATES);", "const [promptTemplates] = useState<AiPromptTemplate[]>(isDemoMode ? INITIAL_PROMPT_TEMPLATES : []);")
edit(p,"    const newEvent: AnalyticsEvent = {", "    if (!isDemoMode) return;\n    const newEvent: AnalyticsEvent = {")
edit(p,"        activeRole: isDemoMode ? demoRole : (user?.role?.includes('ADMIN') || user?.role?.includes('SYSTEM_OWNER') ? 'admin' : 'user'),", "        activeRole: isDemoMode ? demoRole : (user?.roles?.some(role => ['SYSTEM_OWNER', 'SUPPORT_ADMIN', 'SECURITY_ADMIN', 'ANALYTICS_ADMIN', 'CONTENT_ADMIN'].includes(role)) && Boolean(user.permissions?.length) ? 'admin' : 'user'),")
edit(p,"        authError,", "        authError, sessionExpired, pendingRequests, reloadData,")
# This control is a local focus preference, not a database mutation. Do not claim a persisted update.
edit(p,"showToast('Primary focus Goal updated.', 'info');", "showToast(isDemoMode ? 'Primary focus Goal updated.' : 'Focus selected for this visit.', 'info');")

p='src/components/common/BrandLogo.tsx'
Path(p).write_text('''import React from 'react';
// Vite resolves the official asset when supplied. Never substitute a generated logo.
const assets = import.meta.glob('/src/assets/sopet-logo.png', { eager: true, query: '?url', import: 'default' });
export const officialLogo = assets['/src/assets/sopet-logo.png'] as string | undefined;
export const BrandLogo: React.FC<{ className?: string }> = ({ className = 'h-10 w-auto' }) =>
  officialLogo ? <img src={officialLogo} alt="SOPET — The Soft Persona Tool" className={`object-contain max-w-full ${className}`} /> :
  <span className="inline-flex shrink-0 items-center rounded-lg border border-current/20 px-2 py-1 text-sm font-bold tracking-wide" aria-label="SOPET — The Soft Persona Tool">SOPET</span>;
''',encoding='utf-8')
edit('index.html','    <link rel="icon" type="image/png" href="/src/assets/sopet-logo.png" />','    <meta name="theme-color" content="#0E3C5B" />')
edit('index.html','SOPET Momentum — Personal Execution & Developmental Progress','SOPET Momentum | The Soft Persona Tool')

p='src/components/layout/Header.tsx'
edit(p,"    activeView,", "    activeView,\n    activeRole,")
edit(p,"label: 'Review'", "label: 'Weekly Review'")
edit(p,"    { id: 'review', label: 'Weekly Review', icon: BookOpen },", "    { id: 'review', label: 'Weekly Review', icon: BookOpen },\n    { id: 'notifications', label: 'Notifications', icon: Compass },\n    { id: 'settings', label: 'Settings', icon: Settings },")
edit(p,"text-xl font-bold tracking-tight", "text-sm sm:text-lg font-bold tracking-tight")
edit(p,"THE SOFT PERSONA TOOL · ACoS EduTech &amp; Consultancy", "The Soft Persona Tool")
edit(p,"hidden md:flex", "hidden xl:flex")
edit(p,"md:hidden", "xl:hidden")
edit(p,"activeView === item.id && demoRole === 'user'", "activeView === item.id")
edit(p,"setDemoRole('user');", "if (isDemoMode) setDemoRole('user');")
edit(p,"{user?.name.charAt(0) || 'A'}", "{user?.name.charAt(0) || 'S'}")
edit(p,"hidden sm:inline font-medium", "hidden lg:inline max-w-28 truncate font-medium")
edit(p,"onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}", "aria-label=\"Account menu\" aria-expanded={isProfileDropdownOpen}\n                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}")
edit(p,"aria-label=\"Toggle Navigation Menu\"", "aria-label=\"Toggle Navigation Menu\" aria-expanded={isMobileMenuOpen}")
edit(p,"                    <div className=\"border-t border-gray-100 my-1\"></div>", "                    {activeRole === 'admin' && <button onClick={() => { setActiveView('admin'); setIsProfileDropdownOpen(false); }} className=\"w-full px-4 py-2 text-left hover:bg-slate-50\">Administration</button>}\n                    <div className=\"border-t border-gray-100 my-1\"></div>")
edit(p,"                      onClick={() => {\n                        vault.lock();\n                        void authApi.logout().catch(() => undefined);\n                        setIsAuthenticated(false);\n                        setIsProfileDropdownOpen(false);\n                        showToast('Signed out.', 'info');\n                      }}", "                      onClick={async () => {\n                        try { if (!isDemoMode) await authApi.logout(); vault.lock(); setIsAuthenticated(false); if (!isDemoMode) window.location.reload(); setIsProfileDropdownOpen(false); }\n                        catch { showToast('Sign out could not be completed. Please try again.', 'warning'); }\n                      }}")
edit(p,"          {/* Right Controls", "          {/* Right Controls")

p='src/components/goals/GoalListView.tsx'
edit(p,"import React from 'react';", "import React from 'react';\nimport { GoalPrivacySummary } from './GoalPrivacySummary';")
edit(p,"            onClick={() => onSelectGoal(goal.id)}", "            role=\"button\" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectGoal(goal.id); } }}\n            onClick={() => onSelectGoal(goal.id)}")
edit(p,'<div className="flex items-center gap-2">','<div className="flex flex-wrap items-center gap-2">')
edit(p,'{goal.description && (',"{(!goal.privacyMode || goal.privacyMode === 'STANDARD_PRIVATE') && goal.description && (")
edit(p,'<div className="text-xs text-[#155A8A] bg-[#EAF4FB]/60 p-2.5 rounded-lg">', '<GoalPrivacySummary goal={goal} />\n              {(!goal.privacyMode || goal.privacyMode === \'STANDARD_PRIVATE\') && <div className="text-xs text-[#155A8A] bg-[#EAF4FB]/60 p-2.5 rounded-lg">')
edit(p,'<span className="italic line-clamp-1">"{goal.whyThisMatters}"</span>\n              </div>', '<span className="italic line-clamp-1">"{goal.whyThisMatters}"</span>\n              </div>}')

p='src/components/goals/GoalDetailView.tsx'
edit(p,"import React,", "import { WorkspaceState } from '../common/WorkspaceState';\nimport { isDemoMode } from '../../services/api';\nimport React,")
edit(p,"if (!goal) return <div>Goal not found.</div>;", "if (!goal) return <WorkspaceState title=\"404 — Goal not found\" description=\"This Goal may have been removed or is unavailable to your account.\" action={<button className=\"primary-button\" onClick={onBack}>Back to Goals</button>} />;")
edit(p,"<GoalSharingPanel goal={goal} />", "{!isDemoMode && <GoalSharingPanel goal={goal} />}")

p='src/components/onboarding/LightweightOnboarding.tsx'
edit(p,"showToast('Skipped onboarding. Active demo loaded.', 'info');", "showToast('You can resume setup from Today at any time.', 'info');")
edit(p,"showToast('Onboarding complete! Let us define your first Meaningful Goal.', 'success');", "showToast('Start by defining your first meaningful Goal.', 'info');")

p='src/components/auth/AuthLinkHandler.tsx'
edit(p,"import { useEffect }", "import { useEffect, useRef }")
edit(p,"  useEffect(() => {", "  const handled = useRef(false);\n  useEffect(() => {\n    if (handled.current) return;\n    handled.current = true;")

p='src/components/progress/ProgressKpiView.tsx'
edit(p,"import React from 'react';", "import React from 'react';\nimport { isDemoMode } from '../../services/api';\nimport { WorkspaceState } from '../common/WorkspaceState';")
edit(p,"  const handleOpenReview", "  if (!isDemoMode && !kpis.totalActions && !kpis.totalMilestones && !weeklyReviews.length) return <WorkspaceState title=\"No data yet\" description=\"Your completed Actions, Milestones and Weekly Reviews will build a picture of your progress.\" action={<button className=\"primary-button\" onClick={() => setActiveView('goals')}>View Goals</button>} />;\n\n  const handleOpenReview")

p='src/App.tsx'
edit(p,"import React from 'react';", "import React, { useEffect } from 'react';\nimport { isDemoMode } from './services/api';\nimport { DialogAccessibility } from './components/common/DialogAccessibility';\nimport { WorkspaceState } from './components/common/WorkspaceState';\nimport { NotificationsView } from './components/settings/NotificationsView';\nimport { SetupChecklist } from './components/onboarding/SetupChecklist';\nimport { officialLogo } from './components/common/BrandLogo';")
edit(p,"    return <LandingPage />;", "    return isDemoMode ? <LandingPage /> : null;")
start=Path(p).read_text().index('  // If Admin role is toggled')
end=Path(p).read_text().index('  return (', start+100)
# Remove the separate admin-only shell so staff can also reach their own settings.
s=Path(p).read_text(); end=s.index('\n  return (\n    <div className="min-h-screen',s.index('\n  }', start)); s=s[:start]+s[end:]; Path(p).write_text(s)
edit(p,'<main className="flex-1 pb-12">','<main id="main-content" className="flex-1 min-w-0 pb-12">')
edit(p,"{activeView === 'today' && <TodayFocusView />}", "{activeView === 'today' && <><SetupChecklist /><TodayFocusView /></>}")
edit(p,"{activeView === 'admin' && <AdminDashboardView />}", "{activeView === 'notifications' && <NotificationsView />}\n        {activeView === 'admin' && (activeRole === 'admin' ? <AdminDashboardView /> : <WorkspaceState title=\"403 — Access restricted\" description=\"Your account does not have access to administration.\" />)}")
edit(p,"export default function App() {\n  return (", "export default function App() {\n  useEffect(() => {\n    if (!officialLogo) return;\n    const icon = document.createElement('link'); icon.rel = 'icon'; icon.type = 'image/png'; icon.href = officialLogo; document.head.appendChild(icon);\n    return () => { icon.remove(); };\n  }, []);\n  return (")
edit(p,"        <LegacyGoalMigrationRunner />", "        <DialogAccessibility />\n        <a href=\"#main-content\" className=\"skip-link\">Skip to main content</a>\n        <LegacyGoalMigrationRunner />")
