from pathlib import Path
import re
def edit(path,old,new):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old not in s: raise Exception(f'Missing in {path}: {old[:80]}')
    p.write_text(s.replace(old,new),encoding='utf-8')

for p in ['src/components/barrier/BarrierReviewModal.tsx','src/components/mma/MmaModal.tsx']:
    s=Path(p).read_text(encoding='utf-8')
    s=re.sub(r'sendAiRequest<\{ data: (\{[^\n]+\}) \}>',r'sendAiRequest<\1>',s)
    s=s.replace('response.data.', 'response.')
    Path(p).write_text(s,encoding='utf-8')

p='src/context/AppContext.tsx'
s=Path(p).read_text(encoding='utf-8')
start=s.index('  const submitBarrierReview ='); end=s.index('\n  const ',start+5)
block=s[start:end].replace('  const submitBarrierReview = (','  const submitBarrierReview = async (',1).replace('void protectedPayload(', 'return protectedPayload(',1)
block=re.sub(r"\.catch\(error => showToast\((.*?), 'warning'\)\);",r".then(() => true).catch(error => { showToast(\1, 'warning'); return false; });",block)
block=block.replace('return false; });\n      return;','return false; });')
pos=block.rfind('  };'); block=block[:pos]+'    return true;\n'+block[pos:]; s=s[:start]+block+s[end:]
s=re.sub(r'(  submitBarrierReview:\s*\([\s\S]*?\) => )void;',r'\1Promise<boolean | undefined>;',s,count=1)
s=s.replace("interventionApplied: 'Minimum Meaningful Action (MMA)', recordedAt: saved.createdAt", "interventionApplied: undefined, recordedAt: saved.createdAt")
s=s.replace("number: item.number,", "number: item.number ?? 0,")
s=s.replace("category: 'Personal Life' as const,", "category: goal.category || 'Not specified',")
s=s.replace("rhythm: 'Weekly' as const,", "rhythm: 'Not specified' as const,")
Path(p).write_text(s,encoding='utf-8')
edit('src/types.ts',"export type GoalCategory = ","export type GoalCategory = 'Not specified' | ")
edit('src/types.ts',"export type ActionRhythm = ","export type ActionRhythm = 'Not specified' | ")

p='src/components/barrier/BarrierReviewModal.tsx'
edit(p,'const handleFinishReview = (','const handleFinishReview = async (')
edit(p,'    submitBarrierReview(','    const saved = await submitBarrierReview(')
edit(p,'    closeBarrierReview();','    if (!saved) return;\n    closeBarrierReview();')

# Attach semantic labels to existing fields using their value identifiers.
for p in Path('src/components').rglob('*.tsx'):
    if p.name in ['ProductionSettings.tsx','ProductionAuth.tsx']: continue
    s=p.read_text(encoding='utf-8')
    pattern=r'(<label\b[^>]*>)([\s\S]*?)(</label>)([\s\S]*?)(<(?:input|textarea|select)\b)([\s\S]*?)(/?>)'
    def labels(m):
        opening,text,closing,gap,tag,attrs,end=m.groups()
        if 'htmlFor=' in opening or re.search(r'<(?:input|textarea|select|label)\b',text) or re.search(r'<(?:label|button|form)\b',gap) or len(gap)>500: return m.group(0)
        value=re.search(r'\bvalue=\{([a-zA-Z][a-zA-Z0-9]*)\}',attrs)
        if not value or re.search(r'\bid=',attrs): return m.group(0)
        id='field-'+p.stem.lower()+'-'+value.group(1)
        return opening[:-1]+f' htmlFor="{id}">'+text+closing+gap+tag+f' id="{id}"'+attrs+end
    s=re.sub(pattern,labels,s)
    p.write_text(s,encoding='utf-8')

p='src/components/layout/Header.tsx'
edit(p,"                  setDemoRole('admin');", "                  setDemoRole('admin'); setActiveView('admin');")
edit(p,"setDemoRole(demoRole === 'admin' ? 'user' : 'admin');", "setDemoRole(demoRole === 'admin' ? 'user' : 'admin'); setActiveView(demoRole === 'admin' ? 'today' : 'admin');")
edit(p,'aria-label="Toggle Navigation Menu"', 'aria-controls="mobile-navigation" aria-label="Toggle Navigation Menu"')
edit(p,'<div className="xl:hidden bg-[#092B42]', '<div id="mobile-navigation" className="xl:hidden bg-[#092B42]')
edit(p,'<span>{item.label}</span>', '<span>{item.label}</span>')

# Hide fields that have no corresponding backend storage instead of implying they are saved.
p='src/components/goals/CreateGoalModal.tsx'
edit(p,"useState<GoalCategory>('Business & Entrepreneurship')", "useState<GoalCategory>(isDemoMode ? 'Business & Entrepreneurship' : 'Not specified')")
s=Path(p).read_text(encoding='utf-8'); start=s.index('            <div>',s.index('{/* Category & Priority */}')); end=s.index('            </div>',start)+len('            </div>'); s=s[:start]+s[start:end].replace('<div>','{isDemoMode && <div>',1)[:-6]+'</div>}'+s[end:]; Path(p).write_text(s,encoding='utf-8')

p='src/components/goals/GoalDetailView.tsx'
edit(p,'Set as Primary Focus',"{isDemoMode ? 'Set as Primary Focus' : 'Focus for this visit'}")
edit(p,"useState<ActionRhythm>('Three times weekly')", "useState<ActionRhythm>(isDemoMode ? 'Three times weekly' : 'Not specified')")
s=Path(p).read_text(encoding='utf-8'); pos=s.index('>Rhythm</label>'); start=s.rfind('              <div>',0,pos); end=s.index('              </div>',pos)+len('              </div>'); s=s[:start]+s[start:end].replace('<div>','{isDemoMode && <div>',1)[:-6]+'</div>}'+s[end:]; Path(p).write_text(s,encoding='utf-8')
for p in ['src/components/goals/GoalDetailView.tsx','src/components/today/TodayFocusView.tsx']:
    edit(p,'<span>Rhythm: {act.rhythm}</span>', "{act.rhythm !== 'Not specified' && <span>Rhythm: {act.rhythm}</span>}")
for p in ['src/components/goals/GoalDetailView.tsx','src/components/goals/GoalListView.tsx']:
    s=Path(p).read_text(encoding='utf-8'); s=re.sub(r'(<span[^>]*>\s*\{goal.category\}\s*</span>)',r"{goal.category !== 'Not specified' && \1}",s); s=s.replace('flex items-center gap-2','flex flex-wrap items-center gap-2'); Path(p).write_text(s,encoding='utf-8')

p='src/components/goals/GoalSharingPanel.tsx'
edit(p,'className="flex items-center justify-between gap-3 rounded-lg', 'className="flex flex-wrap items-center justify-between gap-3 rounded-lg')
edit(p,'className="flex items-center gap-2"><UserRound', 'className="flex flex-wrap items-center gap-2"><UserRound')
edit(p,"{grantItem.granteeRoleSnapshot} · View only</span></div>", "{grantItem.granteeRoleSnapshot} · View only</span><span className=\"w-full text-slate-500\">Granted: {grantItem.grantedAt ? new Date(grantItem.grantedAt).toLocaleString() : 'Not available'} · Expires: {grantItem.expiresAt ? new Date(grantItem.expiresAt).toLocaleString() : 'Until revoked'}</span></div>")
edit(p,'type="radio" checked={duration', 'type="radio" name="sharing-duration" checked={duration')

# Better contrast for text over white or navy backgrounds; original brand image is never changed.
for p in Path('src/components').rglob('*.tsx'):
    s=p.read_text(encoding='utf-8').replace('text-[#4B9C91]', 'text-teal-700').replace('text-gray-400 block uppercase','text-gray-500 block uppercase')
    # Navy headers use the lighter accent; body uses a darker accessible teal.
    s=s.replace('uppercase font-bold tracking-wider text-teal-700', 'uppercase font-bold tracking-wider text-teal-200') if p.name=='AdminDashboardView.tsx' else s
    p.write_text(s,encoding='utf-8')
