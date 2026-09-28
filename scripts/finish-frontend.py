from pathlib import Path
import re
def edit(path,old,new):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old not in s: raise Exception(f'Missing in {path}: {old[:90]}')
    p.write_text(s.replace(old,new),encoding='utf-8')

for filename in ['review/WeeklyReviewModal.tsx','review/WeeklyReviewView.tsx','restart/IntelligentRestartModal.tsx']:
    p=Path('src/components')/filename
    s=p.read_text(encoding='utf-8')
    s="import { isDemoMode } from '../../services/api';\n"+s
    # Only multiline textual defaults are seeded examples; dates and booleans stay intact.
    s=re.sub(r"useState\(\n    ('[^'\n]*')\n  \)",r"useState(isDemoMode ? \1 : '')",s)
    s=s.replace("completedActions.map(a => a.title).join('; ') ||\n      'Conducted 2 customer discovery phone interviews with corporate event planners; validated core lunch package interest.'", "isDemoMode ? completedActions.map(a => a.title).join('; ') || 'Conducted 2 customer discovery phone interviews with corporate event planners; validated core lunch package interest.' : ''")
    s=s.replace("aiSummaryDraft: 'Validated key customer pricing hypothesis; overcame administrative overwhelm via micro-action scoping.',", "aiSummaryDraft: isDemoMode ? 'Validated key customer pricing hypothesis; overcame administrative overwhelm via micro-action scoping.' : '',")
    s=s.replace('aiSummaryConfirmed: true,', 'aiSummaryConfirmed: isDemoMode,')
    p.write_text(s,encoding='utf-8')

p='src/components/review/WeeklyReviewView.tsx'
edit(p,"import { isDemoMode }", "import { ProductionReview } from './ProductionReview';\nimport { isDemoMode }")
edit(p,"  return (", "  if (!isDemoMode) return <ProductionReview />;\n  return (")
p='src/components/progress/ProgressKpiView.tsx'
edit(p,"import React from 'react';", "import React from 'react';\nimport { ProductionProgress } from './ProductionProgress';")
edit(p,"  if (!isDemoMode && !kpis.totalActions", "  if (!isDemoMode) return <ProductionProgress />;\n  if (!isDemoMode && !kpis.totalActions")

# Await the mutations that control form lifetime, preserving fields on failure.
p='src/context/AppContext.tsx'
s=Path(p).read_text(encoding='utf-8')
names=['createGoal','createMilestone','createActionItem','submitReadinessCheck','submitWeeklyReview','rescheduleAction']
for name in names:
    start=s.index('  const '+name+' =')
    end=s.find('\n  const ',start+5)
    if end<0: raise Exception(name)
    block=s[start:end]
    block=block.replace('  const '+name+' = (','  const '+name+' = async (',1)
    block=block.replace('void domainApi.','return domainApi.',1).replace('void protectedPayload(','return protectedPayload(',1)
    block=re.sub(r"\.catch\(error => showToast\((.*?), 'warning'\)\);",r".then(() => true).catch(error => { showToast(\1, 'warning'); return false; });",block)
    # Remove unreachable bare return in the production branch only.
    block=block.replace("return false; });\n      return;", "return false; });")
    # On successful demo branch resolve true as well.
    pos=block.rfind('  };')
    block=block[:pos]+'    return true;\n'+block[pos:]
    s=s[:start]+block+s[end:]
# update each corresponding interface declaration's return, including multiline declarations
for name in names:
    s=re.sub(r'(  '+name+r':\s*\([\s\S]*?\) => )void;',r'\1Promise<boolean | undefined>;',s,count=1)
s=s.replace("setGoals(prev => [...prev, saved]); setSelectedGoalId(saved.id);", "setGoals(prev => [...prev, saved]); setSelectedGoalId(saved.id); setActiveView('goals');")
# Use backend taxonomy rather than presentation reference data in production.
s=s.replace('if (!isDemoMode) return ACIF_CATEGORIES;', 'if (!isDemoMode) return [];')
s=s.replace('const [acifCategories, setAcifCategories]', 'const [acifCategories, setAcifCategories]')
s=s.replace('domainApi.adjustments(), domainApi.momentumKpis()', 'domainApi.adjustments(), domainApi.momentumKpis(), domainApi.taxonomy()')
s=s.replace('rawLessons, , backendKpis] = result;', 'rawLessons, , backendKpis, taxonomy] = result;')
s=s.replace('        setProductionKpis(backendKpis);', "        setAcifCategories(taxonomy.map((item: any) => ({ code: String(item.code).toLowerCase().replace('meaning_direction_concern','meaning_direction') as AcifCategoryCode, number: item.number, name: item.name, nonJudgmentalDescription: item.description || item.definition || '', defaultIntervention: item.defaultIntervention || '', whyThisHelps: '', active: item.isActive !== false, version: String(item.version ?? '') })));\n        setProductionKpis(backendKpis);")
s=s.replace("    setNotifications(prev => ({ ...prev, ...settings }));", "    if (!isDemoMode) { showToast('Notification preference editing is not available yet.', 'info'); return; }\n    setNotifications(prev => ({ ...prev, ...settings }));")
Path(p).write_text(s,encoding='utf-8')

p='src/services/api.ts'
edit(p,"export const domainApi = {", "export const domainApi = {\n  taxonomy: () => request<any[]>('/barriers/taxonomy'),")

p='src/components/goals/GoalDetailView.tsx'
edit(p,"const handleSaveMilestone = (", "const handleSaveMilestone = async (")
edit(p,"    createMilestone(goal.id, newMilestoneTitle, newMilestoneDate);", "    if (!await createMilestone(goal.id, newMilestoneTitle, newMilestoneDate)) return;")
edit(p,"const handleSaveAction = (", "const handleSaveAction = async (")
edit(p,"    createActionItem({", "    const saved = await createActionItem({")
edit(p,"    setNewActionTitle('');", "    if (!saved) return;\n    setNewActionTitle('');")

p='src/components/readiness/ActionReadinessModal.tsx'
edit(p,"const handleConfirmReady = () =>", "const handleConfirmReady = async () =>")
edit(p,"const handleReviewConcern = () =>", "const handleReviewConcern = async () =>")
edit(p,"    submitReadinessCheck(", "    const saved = await submitReadinessCheck(")
edit(p,"    startAction(action.id);", "    if (saved) startAction(action.id);")
edit(p,"    openBarrierReview(action.id);", "    if (saved) openBarrierReview(action.id);")

p='src/components/today/TodayFocusView.tsx'
edit(p,"const handleSaveReschedule = () =>", "const handleSaveReschedule = async () =>")
edit(p,"      rescheduleAction(activeNma.id, newDueDate);", "      if (!await rescheduleAction(activeNma.id, newDueDate)) return;")
edit(p,"{activeNma?.dueDate || 'Today'}", "{activeNma?.dueDate ? new Date(activeNma.dueDate).toLocaleDateString() : 'date not set'}")

p='src/components/common/Toast.tsx'
edit(p,'className="fixed bottom-5 right-5 z-50', 'aria-live="polite" className="fixed bottom-5 right-0 sm:right-5 z-[110]')

p='src/components/goals/CreateGoalModal.tsx'
edit(p,"useState }", "useState, useEffect }")
edit(p,"import { isDemoMode }", "import { accountApi } from '../../services/accountApi';\nimport { isDemoMode }")
edit(p,"setIsCreateGoalOpen, createGoal, showToast", "setIsCreateGoalOpen, createGoal, showToast, reloadData, setActiveView, setSelectedGoalId")
edit(p,"  // AI Clarification State", "  const [busy, setBusy] = useState(false);\n  const [defaultError, setDefaultError] = useState(false);\n  useEffect(() => {\n    if (!isCreateGoalOpen || isDemoMode) return;\n    setBusy(true); setDefaultError(false);\n    accountApi.profile().then(profile => setPrivacyMode(profile.privacyMode)).catch(() => setDefaultError(true)).finally(() => setBusy(false));\n  }, [isCreateGoalOpen]);\n\n  // AI Clarification State")
edit(p,"    if (!title.trim() || !whyThisMatters.trim()) return;", "    if (busy || defaultError || !title.trim() || !whyThisMatters.trim()) return;")
edit(p,"      try {\n        const id", "      setBusy(true);\n      try {\n        const id")
edit(p,"        setIsCreateGoalOpen(false);", "        setIsCreateGoalOpen(false); setSelectedGoalId(id); setActiveView('goals'); reloadData();")
edit(p,"        showToast('The encrypted Goal could not be saved.', 'warning');\n      }", "        showToast('The encrypted Goal could not be saved.', 'warning');\n      } finally { setBusy(false); }")
edit(p,"    createGoal({", "    setBusy(true);\n    await createGoal({")
edit(p,"      kpi: {", "      kpi: isDemoMode ? {")
edit(p,"        unit: 'actions',\n      },", "        unit: 'actions',\n      } : undefined,")
edit(p,"      privacyMode,\n    });", "      privacyMode,\n    });\n    setBusy(false);")
edit(p,'<form onSubmit={handleSubmit}', '<form aria-busy={busy} onSubmit={handleSubmit}')
edit(p,'          {/* Quick Example Button */}', '          {defaultError && <p role="alert" className="error-notice">Your privacy default could not be loaded. Close this form and try again.</p>}\n          {/* Quick Example Button */}')
edit(p,'type="submit"', 'type="submit" disabled={busy || defaultError}')
