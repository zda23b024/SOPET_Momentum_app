import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePrivacyVault } from '../../context/privacy/PrivacyVaultContext';
import { authApi, isDemoMode } from '../../services/api';
import { BrandLogo } from '../common/BrandLogo';
import {
  Compass,
  Target,
  BarChart3,
  BookOpen,
  ShieldCheck,
  User,
  Settings,
  RotateCcw,
  Menu,
  X,
  ExternalLink,
  ChevronDown,
  Home,
  Users,
  KeyRound,
  ScrollText,
  Activity
} from 'lucide-react';
import { adminPathForTab, adminTabFromPath, isAdministrationPath } from '../../services/adminNavigation';

export const Header: React.FC = () => {
  const vault = usePrivacyVault();
  const {
    activeView,
    activeRole,
    setActiveView,
    demoRole,
    setDemoRole,
    isAuthenticated,
    setIsAuthenticated,
    user,
    resetDemoData,
    openAuthModal,
    showToast
  } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const isAdminArea = isAdministrationPath(window.location.pathname) && activeRole === 'admin';
  const navigate = (view: Parameters<typeof setActiveView>[0]) => {
    if (isAdminArea) window.location.assign(adminPathForTab(view === 'settings' ? 'security' : 'overview'));
    else setActiveView(view);
  };

  const navItems = [
    { id: 'today', label: 'Today', icon: Compass },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'review', label: 'Weekly Review', icon: BookOpen },
    { id: 'notifications', label: 'Notifications', icon: Compass },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;
  const adminNavItems = [
    { tab: 'overview' as const, label: 'Administration Home', icon: Home },
    { tab: 'users' as const, label: 'Users', icon: Users, permission: 'admin.users.view' },
    { tab: 'roles' as const, label: 'Roles / Access', icon: KeyRound, permission: 'admin.users.view' },
    { tab: 'audit' as const, label: 'Audit Logs', icon: ScrollText, permission: 'admin.audit.view' },
    { tab: 'analytics' as const, label: 'System Metrics', icon: Activity, permission: 'admin.metrics.view' },
    { tab: 'security' as const, label: 'Security / MFA', icon: ShieldCheck },
  ].filter(item => !item.permission || user?.permissions?.includes(item.permission));

  return (
    <header className="bg-white text-[#0E3C5B] border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <button
            onClick={() => navigate('today')}
            aria-label="SOPET Momentum home"
            className="shrink-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155A8A]"
          >
            <BrandLogo className="h-12 sm:h-14" />
          </button>

          {/* Desktop Navigation */}
          {isAuthenticated && (
            <nav aria-label={isAdminArea ? 'Administration navigation' : 'Main navigation'} className="hidden xl:flex max-w-[70vw] items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-xl border border-[#155A8A]/40">
              {isAdminArea ? adminNavItems.map(item => {
                const Icon = item.icon;
                const isActive = adminTabFromPath(window.location.pathname) === item.tab;
                return <a key={item.tab} href={adminPathForTab(item.tab)} aria-current={isActive ? 'page' : undefined} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-[#155A8A] text-white shadow-xs' : 'text-slate-600 hover:text-[#0E3C5B] hover:bg-slate-200'}`}><Icon className="w-4 h-4" /><span>{item.label}</span></a>;
              }) : navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (isDemoMode) setDemoRole('user');
                      navigate(item.id);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-[#155A8A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#0E3C5B] hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              {isAdminArea && <a href="/" className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-[#0E3C5B] hover:bg-slate-200"><ExternalLink className="w-4 h-4" /><span>Back to User Dashboard</span></a>}
              {!isAdminArea && activeRole === 'admin' && <a
                href="/administration"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-[#0E3C5B] hover:bg-slate-200"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Administration</span>
              </a>}
            </nav>
          )}

          {/* Right Controls: Role Switcher, Reset, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Demo Role Switcher */}
            {isDemoMode && <div className="flex items-center bg-[#092B42] rounded-lg p-0.5 border border-[#155A8A]">
              <button
                onClick={() => {
                  if (isDemoMode) setDemoRole('user');
                  showToast('Switched to User Demo view (Amina).', 'info');
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  demoRole === 'user'
                    ? 'bg-[#155A8A] text-white'
                    : 'text-slate-600 hover:text-[#0E3C5B]'
                }`}
                title="View app as Participant / User"
              >
                User Demo
              </button>
            </div>}

            {/* Reset Demo Data Button */}
            {isDemoMode && <button
              onClick={() => {
                if (window.confirm('Reset all demo data back to the initial pilot scenario (Amina - Catering Business)?')) {
                  resetDemoData();
                }
              }}
              className="p-2 text-slate-600 hover:text-[#0E3C5B] hover:bg-[#155A8A]/50 rounded-lg transition"
              title="Reset Demo to Original Pilot State"
              aria-label="Reset Demo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>}

            {/* Profile / Auth */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  aria-label="Account menu" aria-expanded={isProfileDropdownOpen}
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2 bg-[#155A8A]/40 hover:bg-[#155A8A] px-2.5 py-1.5 rounded-lg border border-[#155A8A] transition text-sm text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-[#4B9C91] flex items-center justify-center text-white font-bold text-xs">
                    {user?.name.charAt(0) || 'S'}
                  </div>
                  <span className="hidden lg:inline max-w-28 truncate font-medium text-xs text-gray-200">
                    {user?.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                </button>

                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-100 py-1 z-50 text-sm animate-in fade-in zoom-in-95">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-semibold text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      <p className="text-[11px] text-teal-700 font-medium mt-0.5">{user?.cohort}</p>
                    </div>

                    <button
                      onClick={() => {
                        navigate('settings');
                        setIsProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 text-gray-700 text-left"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                      <span>{isAdminArea ? 'Security & MFA' : 'Account & Privacy Settings'}</span>
                    </button>

                    {isDemoMode && <button
                      onClick={() => {
                        setDemoRole(demoRole === 'admin' ? 'user' : 'admin'); setActiveView(demoRole === 'admin' ? 'today' : 'admin');
                        setIsProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 text-gray-700 text-left"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#C5A034]" />
                      <span>Switch to {demoRole === 'admin' ? 'User' : 'Admin'} Mode</span>
                    </button>}

                    {activeRole === 'admin' && !isAdminArea && <a href="/administration" className="block w-full px-4 py-2 text-left hover:bg-slate-50">Administration</a>}
                    <div className="border-t border-gray-100 my-1"></div>

                    <button
                      onClick={async () => {
                        try { if (!isDemoMode) await authApi.logout(); vault.lock(); setIsAuthenticated(false); if (!isDemoMode) window.location.reload(); setIsProfileDropdownOpen(false); }
                        catch { showToast('Sign out could not be completed. Please try again.', 'warning'); }
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-rose-50 text-rose-700 text-left"
                    >
                      <User className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal('signin')}
                className="bg-[#155A8A] hover:bg-[#155A8A]/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Sign In
              </button>
            )}

            {/* Mobile Hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden p-2 text-slate-600 hover:text-[#0E3C5B] rounded-lg"
              aria-controls="mobile-navigation" aria-label="Toggle Navigation Menu" aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && isAuthenticated && (
        <div id="mobile-navigation" className="xl:hidden bg-[#092B42] border-t border-[#155A8A] px-4 pt-3 pb-4 space-y-1">
          {isAdminArea ? <>
            {adminNavItems.map(item => {
              const Icon = item.icon;
              const isActive = adminTabFromPath(window.location.pathname) === item.tab;
              return <a key={item.tab} href={adminPathForTab(item.tab)} aria-current={isActive ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'bg-[#155A8A] text-white' : 'text-slate-600 hover:bg-slate-200'}`}><Icon className="w-4 h-4" /><span>{item.label}</span></a>;
            })}
            <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#0E3C5B] hover:bg-slate-200"><ExternalLink className="w-4 h-4" /><span>Back to User Dashboard</span></a>
          </> : <>{navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isDemoMode) setDemoRole('user');
                  navigate(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-[#155A8A] text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          {activeRole === 'admin' && !isAdminArea && <a
            href="/administration"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-[#0E3C5B] hover:bg-slate-200"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Administration</span>
          </a>}
          <div className="pt-2 border-t border-[#155A8A]/50">
            <button
              onClick={() => {
                navigate('settings');
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:text-[#0E3C5B]"
            >
              <Settings className="w-4 h-4" />
              <span>Settings &amp; Privacy</span>
            </button>
          </div>
          </>}
        </div>
      )}
    </header>
  );
};
