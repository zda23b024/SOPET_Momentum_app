import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { GoalCategory } from '../../types';
import { ContextualAiService } from '../../services/contextualAi';
import { accountApi } from '../../services/accountApi';
import { isDemoMode } from '../../services/api';
import { sendAiRequest } from '../../services/aiConsent';
import { useAiConsent } from '../../context/ai/AiConsentContext';
import { usePrivacyVault } from '../../context/privacy/PrivacyVaultContext';
import { encryptContent } from '../../crypto/vault';
import type { PrivacyMode } from '../../crypto/privacyTypes';
import { goalApi } from '../../services/goalApi';
import { generateGoalKey, wrapGoalKeyForOwner } from '../../crypto/goalKeys';
import { X, Target, Sparkles, Check, ArrowRight, HelpCircle, ShieldCheck } from 'lucide-react';

export const CreateGoalModal: React.FC = () => {
  const { isCreateGoalOpen, setIsCreateGoalOpen, createGoal, showToast, reloadData, setActiveView, setSelectedGoalId } = useApp();
  const vault = usePrivacyVault();
  const requestConsent = useAiConsent();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>(isDemoMode ? 'Business & Entrepreneurship' : 'Not specified');
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() + 86400000 * 60).toISOString().split('T')[0]
  );
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Standard'>('High');
  const [whyThisMatters, setWhyThisMatters] = useState('');
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('STANDARD_PRIVATE');

  const [busy, setBusy] = useState(false);
  const [defaultError, setDefaultError] = useState(false);
  useEffect(() => {
    if (!isCreateGoalOpen || isDemoMode) return;
    setBusy(true); setDefaultError(false);
    accountApi.profile().then(profile => setPrivacyMode(profile.privacyMode)).catch(() => setDefaultError(true)).finally(() => setBusy(false));
  }, [isCreateGoalOpen]);

  // AI Clarification State
  const [aiClarification, setAiClarification] = useState<{
    refinedTitle: string;
    refinedWhyThisMatters: string;
    suggestions: string[];
  } | null>(null);

  if (!isCreateGoalOpen) return null;

  const handlePreFillExample = () => {
    setTitle('Start a catering business');
    setDescription(
      'Launch a boutique event catering service focusing on regional fusion corporate lunches and social celebrations.'
    );
    setCategory('Business & Entrepreneurship');
    setPriority('High');
    setWhyThisMatters(
      'Building financial autonomy for my family and utilizing my culinary expertise to serve corporate clients and community gatherings.'
    );
    showToast('Loaded protocol reference example.', 'info');
  };

  const handleAiClarify = async () => {
    if (!title.trim()) {
      showToast('Please provide a working title first.', 'warning');
      return;
    }
    try {
      if (isDemoMode) {
        if (privacyMode === 'HIGHLY_CONFIDENTIAL') {
          const grant = await requestConsent({ purpose: 'Clarify the Goal title', fieldsShared: ['draftTitle', 'goalTitle'], fieldsNotShared: ['Description', 'Why this matters', 'Target date', 'Milestones', 'Privacy Vault keys'], provider: 'Local demo engine', model: 'Deterministic SOPET rules' });
          if (!grant) return;
        }
        setAiClarification(ContextualAiService.clarifyGoal(title, whyThisMatters)); return;
      }
      const response = await sendAiRequest<{ sharpenedNmaTitle: string; clarityAssessment: string }>({
        path: '/ai/sharpen-nma', privacyMode, requestConsent,
        details: { purpose: 'Clarify the Goal title', fieldsShared: ['draftTitle', 'goalTitle'], fieldsNotShared: ['Description', 'Why this matters', 'Target date', 'Milestones', 'Privacy Vault keys'], provider: 'Google Gemini', model: 'gemini-2.5-flash' },
        payload: { privacyMode, draftTitle: title, goalTitle: title },
      });
      if (response) setAiClarification({ refinedTitle: response.sharpenedNmaTitle, refinedWhyThisMatters: whyThisMatters, suggestions: [response.clarityAssessment] });
    } catch { showToast('AI clarification could not be completed.', 'warning'); }
  };

  const handleAcceptAi = () => {
    if (aiClarification) {
      setTitle(aiClarification.refinedTitle);
      setWhyThisMatters(aiClarification.refinedWhyThisMatters);
      setAiClarification(null);
      showToast('AI suggestion applied to Goal definition.', 'success');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || defaultError || !title.trim() || !whyThisMatters.trim()) return;

    if (privacyMode !== 'STANDARD_PRIVATE') {
      if (vault.status !== 'unlocked' || !vault.key || !vault.metadata) {
        showToast('Unlock your Privacy Vault before creating an encrypted Goal.', 'warning');
        return;
      }
      setBusy(true);
      try {
        const id = globalThis.crypto.randomUUID();
        const currentUser = await goalApi.currentUser();
        const goalKey = await generateGoalKey();
        const encryptedPayload = await encryptContent(goalKey, { title, description, whyItMatters: whyThisMatters, category }, { userId: currentUser.user.id, entityType: 'goal', entityId: id, keyVersion: 1 });
        const ownerWrappedGoalKey = await wrapGoalKeyForOwner(goalKey, vault.key, currentUser.user.id, id);
        await goalApi.createEncrypted({ id, privacyMode, targetDate, isPrimary: false, encryptedPayload, ownerWrappedGoalKey });
        setIsCreateGoalOpen(false); setSelectedGoalId(id); setActiveView('goals'); reloadData();
        showToast('Encrypted Goal saved. Private text left the browser only as ciphertext.', 'success');
      } catch {
        showToast('The encrypted Goal could not be saved.', 'warning');
      } finally { setBusy(false); }
      return;
    }

    setBusy(true);
    await createGoal({
      title,
      description,
      category,
      targetDate,
      priority,
      whyThisMatters,
      status: 'Active',
      nextReviewDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      kpi: isDemoMode ? {
        name: 'Milestone Actions Completed',
        currentValue: 0,
        targetValue: 5,
        unit: 'actions',
      } : undefined,
      privacyMode,
    });
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0E3C5B] text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-teal-700">
              Momentum Foundation
            </span>
            <h2 className="text-lg font-bold">Create Meaningful Goal</h2>
          </div>
          <button
            onClick={() => setIsCreateGoalOpen(false)}
            className="text-gray-300 hover:text-white p-1 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form aria-busy={busy} onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {defaultError && <p role="alert" className="error-notice">Your privacy default could not be loaded. Close this form and try again.</p>}
          {/* Quick Example Button */}
          {isDemoMode && <div className="flex items-center justify-between bg-[#EAF4FB] p-3 rounded-xl border border-[#155A8A]/20">
            <span className="text-gray-700 font-medium text-[11px]">
              Use the Pilot Protocol Case:
            </span>
            <button
              type="button"
              onClick={handlePreFillExample}
              className="bg-[#155A8A] text-white px-2.5 py-1 rounded-lg font-semibold text-[11px] hover:bg-[#0E3C5B] transition"
            >
              Pre-fill "Start a catering business"
            </button>
          </div>}

          {/* Goal Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-gray-900 block">Goal Title *</label>
              <button
                type="button"
                onClick={handleAiClarify}
                className="text-[#155A8A] hover:text-[#0E3C5B] font-semibold flex items-center gap-1 text-[11px]"
              >
                <Sparkles className="w-3 h-3 text-[#C5A034]" />
                <span>AI Coach: Clarify Goal</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Start a catering business"
              className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155A8A]"
            />
          </div>

          {/* AI Clarification Suggestion Box */}
          {aiClarification && (
            <div className="bg-[#EAF4FB] border border-[#155A8A]/30 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#155A8A] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C5A034]" />
                  AI Suggested Clarification — Please Confirm
                </span>
                <span className="text-[10px] text-gray-500 italic">User control preserved</span>
              </div>
              <p className="text-gray-800">
                <strong>Refined Title:</strong> {aiClarification.refinedTitle}
              </p>
              <p className="text-gray-800">
                <strong>Refined Why:</strong> {aiClarification.refinedWhyThisMatters}
              </p>
              <ul className="list-disc pl-4 text-gray-600 text-[11px] space-y-0.5">
                {aiClarification.suggestions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAiClarification(null)}
                  className="px-2.5 py-1 text-gray-600 hover:text-gray-900"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAi}
                  className="bg-[#155A8A] text-white px-3 py-1 rounded-lg font-semibold"
                >
                  Accept Suggestion
                </button>
              </div>
            </div>
          )}

          {/* Goal Description */}
          <div>
            <label className="font-semibold text-gray-800 block mb-1" htmlFor="field-creategoalmodal-description">Description (Optional)</label>
            <textarea id="field-creategoalmodal-description"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief summary of the scope and core objectives..."
              className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155A8A]"
            />
          </div>

          {/* WHY THIS MATTERS (Core Protocol Concept) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div>
              <label className="font-bold text-gray-900 block text-xs" htmlFor="field-creategoalmodal-whyThisMatters">
                Why This Matters *
              </label>
              <span className="text-[11px] text-gray-600 leading-relaxed block">
                Explain the meaningful connection behind this Goal (e.g. personal meaning, family responsibility, financial independence, or professional contribution).
              </span>
            </div>
            <textarea id="field-creategoalmodal-whyThisMatters"
              rows={3}
              required
              value={whyThisMatters}
              onChange={e => setWhyThisMatters(e.target.value)}
              placeholder="e.g. Building financial autonomy for my family and utilizing my professional culinary expertise..."
              className="w-full text-xs p-2.5 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#155A8A]"
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isDemoMode && <div>
              <label className="font-semibold text-gray-800 block mb-1" htmlFor="field-creategoalmodal-category">Category</label>
              <select id="field-creategoalmodal-category"
                value={category}
                onChange={e => setCategory(e.target.value as GoalCategory)}
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none"
              >
                <option value="Business & Entrepreneurship">Business &amp; Entrepreneurship</option>
                <option value="Professional Development">Professional Development</option>
                <option value="Academic & Learning">Academic &amp; Learning</option>
                <option value="Creative & Writing">Creative &amp; Writing</option>
                <option value="Health & Well-being">Health &amp; Well-being</option>
                <option value="Personal Life">Personal Life</option>
              </select>
            </div>}

            <div>
              <label className="font-semibold text-gray-800 block mb-1" htmlFor="field-creategoalmodal-targetDate">Target Horizon</label>
              <input id="field-creategoalmodal-targetDate"
                type="date"
                required
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none"
              >
              </input>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="font-bold text-gray-900 mb-1">Privacy</legend>
            {([
              ['STANDARD_PRIVATE', 'Standard Private', 'Protected by your account and SOPET access controls.'],
              ['ENCRYPTED_PRIVATE', 'Encrypted Private', 'Private content is encrypted in your browser before storage.'],
              ['HIGHLY_CONFIDENTIAL', 'Highly Confidential', 'Browser-encrypted, with AI disabled unless you approve each use.'],
            ] as const).map(([value, label, description]) => (
              <label key={value} className="flex items-start gap-2 p-2.5 border border-gray-200 rounded-lg cursor-pointer">
                <input type="radio" name="privacyMode" value={value} checked={privacyMode === value} onChange={() => setPrivacyMode(value)} className="mt-0.5" />
                <span><strong className="block text-gray-900">{label}</strong><span className="text-[11px] text-gray-600">{description}</span></span>
              </label>
            ))}
          </fieldset>

          {/* Goal Quality Prompts Check */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1.5">
            <span className="font-bold text-gray-900 block text-[11px] uppercase tracking-wider">
              Goal Quality Check:
            </span>
            <ul className="space-y-1 text-[11px] text-gray-600">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-700" />
                <span>What exactly are you trying to achieve?</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-700" />
                <span>Why does this matter? (Deep personal/financial purpose)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-700" />
                <span>Is the Goal currently relevant to your immediate life?</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-700" />
                <span>Is observable progress possible within 6–12 weeks?</span>
              </li>
            </ul>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateGoalOpen(false)}
              className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={busy || defaultError}
              className="flex items-center gap-2 bg-[#0E3C5B] hover:bg-[#155A8A] text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-xs"
            >
              <span>Save Goal &amp; Activate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
