import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/api';
import { BrandLogo } from '../common/BrandLogo';
import { t } from '../../i18n/strings';
import loginBackdrop from '../../assets/sopet-login-mountains.jpg';

export function ProductionAuth() {
  const { authStatus, isAuthenticated, isAuthModalOpen, authModalMode, openAuthModal, closeAuthModal, sessionExpired } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [mfa, setMfa] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verificationLink, setVerificationLink] = useState('');
  const [verification, setVerification] = useState(false);
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('resetPasswordToken'));
  useEffect(() => { setError(''); setNotice(''); setPassword(''); setTotp(''); setMfa(false); setUseRecoveryCode(false); }, [authModalMode]);
  const standalone = !isAuthenticated && authStatus === 'unauthenticated';
  if (!standalone && !isAuthModalOpen) return null;
  const mode = resetToken ? 'forgot' : authModalMode;
  const run = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'signin') {
        const result = await authApi.login(email, password, mfa && !useRecoveryCode ? totp : undefined, mfa && useRecoveryCode ? totp : undefined);
        if ('mfaRequired' in result) { setMfa(true); setNotice('Enter the current code from your authenticator app.'); return; }
        window.location.reload();
      } else if (mode === 'signup') {
        const result = await authApi.register(name.trim(), email.trim(), password);
        if (result.verificationRequired) { setVerification(true); setPassword(''); setVerificationLink(result.verificationUrl || ''); setNotice(result.verificationEmailStatus === 'FAILED' ? 'Account created, but the verification email could not be delivered. Use Resend verification email below.' : result.verificationUrl ? 'Development mail is enabled. Open the verification link below.' : 'Account created. Check your email to verify your address, then sign in.'); }
        else window.location.reload();
      } else if (resetToken) {
        await authApi.resetPassword(resetToken, password);
        window.history.replaceState({}, '', window.location.pathname);
        setResetToken(null); setPassword(''); openAuthModal('signin');
        setNotice('Password updated. Sign in with your new password.');
      } else {
        await authApi.forgotPassword(email);
        setNotice('If an account exists for this address, a password reset email will arrive shortly.');
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to complete your request. Please try again.'); }
    finally { setBusy(false); }
  };
  return <div className={standalone ? 'relative min-h-screen overflow-hidden flex items-center justify-center p-4 sm:p-8 bg-[#0E3C5B] bg-cover bg-center' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'} style={standalone ? { backgroundImage: `linear-gradient(rgba(8, 45, 70, .68), rgba(8, 45, 70, .78)), url(${loginBackdrop})` } : undefined}>
    {standalone && <div className="absolute inset-0 bg-slate-950/10" aria-hidden="true" />}
    <section id={standalone ? 'main-content' : undefined} className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/50 bg-white shadow-2xl">
      <header className="bg-[#0E3C5B] p-6 text-white">
        <div className="flex items-center justify-between gap-3"><BrandLogo className="h-20" />{!standalone && <button aria-label="Close authentication" disabled={busy} onClick={closeAuthModal}>Close</button>}</div>
        <h1 className="mt-4 text-2xl font-bold">{t('brand')}</h1><p className="mt-1 text-sm text-slate-200">{t('tagline')}</p>
      </header>
      <div className="space-y-5 p-6">
        <h2 className="text-xl font-semibold text-[#0E3C5B]">{verification ? 'Check your email' : mode === 'signup' ? 'Create your account' : mode === 'forgot' ? resetToken ? 'Choose a new password' : 'Reset your password' : 'Welcome back'}</h2>
        {sessionExpired && <p role="status" className="notice">{t('expired')}</p>}
        {error && <p role="alert" className="error-notice">{error}</p>}
        {notice && <p role="status" className="notice">{notice}</p>}
        {verificationLink && <p className="break-all text-sm"><a className="text-[#155A8A] underline" href={verificationLink}>Verify this development account</a></p>}
        {!verification && <form onSubmit={run} className="space-y-4" aria-busy={busy}>
          <fieldset disabled={busy} className="space-y-4">
            {mode === 'signup' && <label className="field-label">Full name<input autoComplete="name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>}
            {!resetToken && <label className="field-label">Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
            {(mode !== 'forgot' || resetToken) && <label className="field-label">{resetToken ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={mode === 'signin' ? 1 : 12} value={password} onChange={e => setPassword(e.target.value)} />{mode !== 'signin' && <span className="text-xs text-slate-500">Use at least 12 characters.</span>}</label>}
            {mfa && <><label className="field-label">{useRecoveryCode ? 'MFA recovery code' : 'Authenticator code'}<input autoFocus inputMode={useRecoveryCode ? 'text' : 'numeric'} autoComplete="one-time-code" pattern={useRecoveryCode ? undefined : '[0-9]{6}'} required value={totp} onChange={e => setTotp(e.target.value)} /></label><button type="button" className="text-sm text-[#155A8A] underline" onClick={() => { setTotp(''); setUseRecoveryCode(current => !current); }}>{useRecoveryCode ? 'Use authenticator code' : 'Use a recovery code'}</button></>}
            <button type="submit" className="primary-button w-full">{busy ? 'Please wait…' : mode === 'signin' ? mfa ? 'Verify and sign in' : 'Sign in' : mode === 'signup' ? 'Register' : resetToken ? 'Save new password' : 'Send reset link'}</button>
          </fieldset>
        </form>}
        <div className="flex flex-wrap gap-3 text-sm">
          {mode === 'signin' && <button disabled={busy} className="text-[#155A8A] underline" onClick={() => openAuthModal('forgot')}>Forgot password?</button>}
          <button disabled={busy} className="text-[#155A8A] underline" onClick={() => { setVerification(false); setResetToken(null); openAuthModal(mode === 'signin' ? 'signup' : 'signin'); }}>{mode === 'signin' ? 'Create an account' : 'Back to sign in'}</button>
          {(verification || (mode === 'signin' && error.toLowerCase().includes('verification'))) && <button disabled={busy || !email} className="text-[#155A8A] underline" onClick={async () => { setBusy(true); try { const result = await authApi.resendVerification(email); setVerificationLink(result.verificationUrl || ''); setNotice(result.verificationUrl ? 'Development mail is enabled. Open the verification link above.' : 'If verification is required, a new email will arrive shortly.'); } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); } finally { setBusy(false); } }}>Resend verification email</button>}
        </div>
      </div>
    </section>
  </div>;
}
