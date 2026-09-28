import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authApi, isDemoMode } from '../../services/api';
import { X, Lock, Mail, ArrowRight, UserCheck, Shield } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { ProductionAuth } from './ProductionAuth';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    setIsAuthenticated,
    openOnboarding,
    showToast,
    logEvent,
  } = useApp();

  const [email, setEmail] = useState(isDemoMode ? 'amina.pilot@acosedutech.org' : '');
  const [password, setPassword] = useState('••••••••••••');
  const [name, setName] = useState(isDemoMode ? 'Amina' : '');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resetToken = new URLSearchParams(window.location.search).get('resetPasswordToken');
  useEffect(() => { if (!isDemoMode) setPassword(''); }, []);

  if (!isDemoMode) return <ProductionAuth />;
  if (!isAuthModalOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await authApi.login(email, password);
      if ('mfaRequired' in result) {
        showToast('Multi-factor authentication is required.', 'warning');
        return;
      }
      setIsAuthenticated(true);
      closeAuthModal();
      showToast('Signed in successfully.', 'success');
      if (!isDemoMode) window.location.reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to sign in.', 'warning');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await authApi.register(name, email, password);
      if (result.verificationRequired) {
        showToast('Account created. Check your email before signing in.', 'success');
        openAuthModal('signin');
      } else {
        setIsAuthenticated(true); closeAuthModal(); openOnboarding();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create account.', 'warning');
    }
  };

  const handleDemoOneClick = () => {
    if (!isDemoMode) return;
    setIsAuthenticated(true);
    closeAuthModal();
    showToast('Signed in with Pilot Demo Account (Amina).', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0E3C5B] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-12 w-auto rounded bg-white p-1" />
            <div>
            <h2 className="text-lg font-bold">
              {authModalMode === 'signin' && 'Sign In to SOPET Momentum'}
              {authModalMode === 'signup' && 'Create Your Momentum Account'}
              {authModalMode === 'forgot' && 'Account Recovery'}
            </h2>
            <p className="text-xs text-gray-300">
              {authModalMode === 'signin' && (isDemoMode ? 'Enter your credentials or use quick demo access' : 'Sign in securely to continue')}
              {authModalMode === 'signup' && 'Begin your journey with one meaningful goal'}
              {authModalMode === 'forgot' && 'Reset your password securely'}
            </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="text-gray-300 hover:text-white p-1 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Quick Demo Access banner for Evaluators */}
          {isDemoMode && <div className="bg-[#EAF4FB] border border-[#155A8A]/30 rounded-xl p-3.5 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-semibold text-[#0E3C5B] block">Interactive Evaluator Access</span>
              <span className="text-gray-600">Pre-configured with Amina's catering business goal</span>
            </div>
            <button
              onClick={handleDemoOneClick}
              className="bg-[#155A8A] hover:bg-[#0E3C5B] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              Sign In as Amina
            </button>
          </div>}

          {authModalMode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="field-authmodal-email">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input id="field-authmodal-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155A8A]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => openAuthModal('forgot')}
                    className="text-xs text-[#155A8A] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155A8A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#155A8A] hover:bg-[#0E3C5B] text-white py-2.5 rounded-xl font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-gray-600">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="text-xs font-semibold text-[#155A8A] hover:underline"
                >
                  Create an account
                </button>
              </div>
            </form>
          )}

          {authModalMode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="field-authmodal-name">Your Name</label>
                <input id="field-authmodal-name"
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155A8A]"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="field-authmodal-email">Email Address</label>
                <input id="field-authmodal-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155A8A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="field-authmodal-password">Password</label>
                <input id="field-authmodal-password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155A8A]"
                />
              </div>

              <div className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-start gap-2">
                <Shield className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  By continuing, you acknowledge that SOPET Momentum is a developmental execution tool, not clinical therapy.
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-[#155A8A] hover:bg-[#0E3C5B] text-white py-2.5 rounded-xl font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2"
              >
                <span>Create Account &amp; Start Onboarding</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-1">
                <span className="text-xs text-gray-600">Already registered? </span>
                <button
                  type="button"
                  onClick={() => openAuthModal('signin')}
                  className="text-xs font-semibold text-[#155A8A] hover:underline"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {authModalMode === 'forgot' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-600">
                {resetToken ? 'Choose a new password for your account.' : 'Enter your email address. If an eligible account exists, recovery instructions will be sent.'}
              </p>
              {!resetToken && <div>
                <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="field-authmodal-email">Email Address</label>
                <input id="field-authmodal-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none"
                />
              </div>}
              {resetToken && <div><label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="field-authmodal-newPassword">New Password</label><input id="field-authmodal-newPassword" type="password" minLength={12} required value={newPassword} onChange={event => setNewPassword(event.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none" /></div>}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  try {
                    setIsSubmitting(true);
                    if (resetToken) {
                      await authApi.resetPassword(resetToken, newPassword);
                      window.history.replaceState({}, '', window.location.pathname);
                      showToast('Password reset successfully. Sign in with your new password.', 'success');
                      openAuthModal('signin');
                    } else {
                      await authApi.forgotPassword(email);
                      showToast('If an eligible account exists, recovery instructions will be sent.', 'info');
                      openAuthModal('signin');
                    }
                  } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to complete password recovery.', 'warning'); }
                  finally { setIsSubmitting(false); }
                }}
                className="w-full bg-[#155A8A] text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {resetToken ? 'Reset Password' : 'Send Recovery Instructions'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => openAuthModal('signin')}
                  className="text-xs text-[#155A8A] hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
