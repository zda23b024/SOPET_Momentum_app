import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePrivacyVault } from '../../context/privacy/PrivacyVaultContext';
import { isDemoMode } from '../../services/api';
import { ProductionSettings } from './ProductionSettings';
import {
  ShieldCheck,
  Download,
  RotateCcw,
  Lock,
  UserCheck,
  AlertTriangle,
  Info,
  Check,
  Sparkles,
  KeyRound
} from 'lucide-react';

export const SettingsPrivacyView: React.FC = () => {
  const { userProfile, resetDemoData, showToast, goals, actions, barriers, weeklyReviews } = useApp();
  const vault = usePrivacyVault();
  const [aiAssistanceEnabled, setAiAssistanceEnabled] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [savedRecovery, setSavedRecovery] = useState(false);

  const runVaultAction = async (action: () => Promise<void | string>) => {
    try {
      const result = await action();
      if (typeof result === 'string') { setRecoveryKey(result); setSavedRecovery(false); }
      setPassphrase('');
    } catch (error) {
      showToast(error instanceof Error && error.message === 'KEY_UNWRAP_FAILED' ? 'Unable to unlock private content.' : 'Privacy Vault operation failed.', 'warning');
    }
  };

  const handleExportData = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user: userProfile,
      goals,
      actions,
      barriers,
      weeklyReviews,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sopet_momentum_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exported prototype data as JSON.', 'success');
  };

  const handleReset = () => {
    if (window.confirm('Reset all prototype state back to the original pilot scenario?')) {
      resetDemoData();
    }
  };

  if (!isDemoMode) return <ProductionSettings />;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3C5B]">Settings &amp; Privacy</h1>
        <p className="text-xs text-gray-600 mt-1">
          Manage your participant profile, ethical boundaries, AI coach settings, and data export.
        </p>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#155A8A]" />
            <div>
              <h2 className="text-base font-bold text-[#0E3C5B]">Privacy &amp; Encryption</h2>
              <p className="text-xs text-gray-600">Privacy Vault: <strong className="capitalize">{vault.status.replace('-', ' ')}</strong></p>
            </div>
          </div>
          {vault.status === 'unlocked' && <button type="button" onClick={vault.lock} className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold"><Lock className="w-4 h-4 inline mr-1" />Lock</button>}
        </div>

        {vault.status !== 'loading' && vault.status !== 'unlocked' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="password" autoComplete="new-password" value={passphrase} onChange={event => setPassphrase(event.target.value)} placeholder="Privacy Vault Passphrase" className="flex-1 p-2.5 border border-gray-300 rounded-lg text-xs" />
            {vault.status === 'not-configured' ? (
              <button type="button" onClick={() => runVaultAction(() => vault.setup(passphrase))} className="px-4 py-2.5 bg-[#155A8A] text-white rounded-lg text-xs font-semibold">Set up vault</button>
            ) : (
              <button type="button" onClick={() => runVaultAction(() => vault.unlock(passphrase))} className="px-4 py-2.5 bg-[#155A8A] text-white rounded-lg text-xs font-semibold">Unlock</button>
            )}
          </div>
        )}

        {vault.status === 'unlocked' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="password" autoComplete="new-password" value={passphrase} onChange={event => setPassphrase(event.target.value)} placeholder="New Privacy Vault Passphrase" className="flex-1 p-2.5 border border-gray-300 rounded-lg text-xs" />
            <button type="button" onClick={() => runVaultAction(() => vault.changePassphrase(passphrase))} className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold">Change passphrase</button>
            <button type="button" onClick={() => runVaultAction(vault.rotateRecovery)} className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold">New recovery key</button>
          </div>
        )}

        {recoveryKey && (
          <div className="p-4 border border-amber-300 bg-amber-50 rounded-lg space-y-3">
            <p className="text-xs font-semibold">Save this Recovery Key somewhere safe. SOPET cannot recover encrypted content without your passphrase or this key.</p>
            <code className="block break-all text-xs select-all">{recoveryKey}</code>
            <label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={savedRecovery} onChange={event => setSavedRecovery(event.target.checked)} />I saved this Recovery Key.</label>
            <button type="button" disabled={!savedRecovery} onClick={() => setRecoveryKey(null)} className="px-3 py-2 bg-[#0E3C5B] disabled:opacity-40 text-white rounded-lg text-xs font-semibold">Finish</button>
          </div>
        )}

        <p className="text-[11px] text-gray-500">Encrypted private content is encrypted in your browser before storage. Losing both secrets makes it unrecoverable. Browser extensions, malware, or modified application code can still access content while the vault is unlocked.</p>
      </div>

      {/* Participant Profile */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#0E3C5B]">Participant Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-gray-500 block mb-1">Full Name</label>
            <input
              type="text"
              readOnly
              value={userProfile.name}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Email</label>
            <input
              type="email"
              readOnly
              value={userProfile.email}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-semibold"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Ecosystem Role</label>
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg font-semibold text-[#155A8A]">
              {userProfile.role}
            </div>
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Data Storage</label>
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
              {isDemoMode ? 'Local demo session' : 'PostgreSQL with browser encryption for protected content'}
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Ethical Boundaries */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-700" />
          <h2 className="text-base font-bold text-[#0E3C5B]">
            Ethical Governance &amp; Boundaries
          </h2>
        </div>

        <div className="space-y-3 text-xs text-gray-700">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <strong className="text-gray-900 block font-bold">1. Non-Clinical Framework</strong>
            <p className="leading-relaxed">
              SOPET Momentum is an educational and developmental execution system developed by <strong>ACoS EduTech and Consultancy</strong>. It is <strong>not therapy</strong> and <strong>not medical or psychiatric treatment</strong>. It is designed to assist individuals in establishing next meaningful steps and overcoming execution friction.
            </p>
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <strong className="text-gray-900 block font-bold">2. No Guarantee of Success</strong>
            <p className="leading-relaxed">
              Momentum provides structure, clarity, and reflection protocols; however, external outcomes depend on many external variables. We make no commercial claim of guaranteed success.
            </p>
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <strong className="text-gray-900 block font-bold">3. Private by Default</strong>
            <p className="leading-relaxed">
              Your personal reflections, internal resistance notes, and barrier explanations are excluded from ordinary administration views. Browser encryption is available for protected Goals.
            </p>
          </div>
        </div>
      </div>

      {/* AI Assistant Preferences */}
      {isDemoMode && <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0E3C5B]">Contextual AI Assistance</h2>
            <p className="text-xs text-gray-600">
              Assists in Barrier diagnosis and MMA suggestions with user confirmation required.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAiAssistanceEnabled(!aiAssistanceEnabled)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              aiAssistanceEnabled ? 'bg-[#155A8A]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                aiAssistanceEnabled ? 'left-6' : 'left-1'
              }`}
            ></span>
          </button>
        </div>
        <p className="text-xs text-gray-500">
          When enabled, the AI coach will offer provisional barrier classifications from your written descriptions, which you can accept, edit, or reject.
        </p>
      </div>}

      {/* Data Management & Export */}
      {isDemoMode && <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#0E3C5B]">Prototype Data Controls</h2>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleExportData}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0E3C5B] hover:bg-[#155A8A] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Pilot Data (JSON)</span>
          </button>

          <button
            onClick={handleReset}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Demo to Amina Default</span>
          </button>
        </div>
        <span className="text-[11px] text-gray-500 block">
          Resetting will restore the default scenario for Amina's catering business pilot.
        </span>
      </div>}
    </div>
  );
};
