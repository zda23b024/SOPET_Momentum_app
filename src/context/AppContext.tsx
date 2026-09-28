import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Goal,
  Milestone,
  ActionItem,
  AcifCategory,
  AcifCategoryCode,
  InterventionDefinition,
  LessonRecord,
  RestartRecord,
  WeeklyReviewRecord,
  BarrierRecord,
  MomentumKpiSet,
  PilotParticipant,
  NotificationSettings,
  AnalyticsEvent,
  KnowledgeBaseEntry,
  AiPromptTemplate,
  ReadinessOutput,
  RestartStrategy,
  ActionStatus,
  GoalStatus
} from '../types';
import {
  INITIAL_USER,
  INITIAL_GOALS,
  INITIAL_MILESTONES,
  INITIAL_ACTIONS,
  ACIF_CATEGORIES,
  APPROVED_INTERVENTIONS,
  INITIAL_LESSONS,
  INITIAL_BARRIERS,
  INITIAL_WEEKLY_REVIEWS,
  KNOWLEDGE_BASE_ENTRIES,
  INITIAL_PROMPT_TEMPLATES,
  INITIAL_NOTIFICATIONS,
  INITIAL_ANALYTICS_EVENTS
} from '../data/initialData';
import { authApi, domainApi, isDemoMode } from '../services/api';
import { usePrivacyVault } from './privacy/PrivacyVaultContext';
import { unwrapGoalKeyForOwner } from '../crypto/goalKeys';
import { decryptContent, encryptContent } from '../crypto/vault';

import { ApiError } from '../services/http';
import { accountApi } from '../services/accountApi';
import { canAccessAdministration } from '../services/permissions';
import { apiRequest } from '../services/http';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

interface AppUser {
  name: string;
  email: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  organization?: string;
  program?: string;
  cohort?: string;
  joinedDate?: string;
}

interface AppContextType {
  // Navigation & Role
  activeView: 'today' | 'goals' | 'progress' | 'review' | 'settings' | 'admin' | 'notifications';
  setActiveView: (view: 'today' | 'goals' | 'progress' | 'review' | 'settings' | 'admin' | 'notifications') => void;
  demoRole: 'user' | 'admin';
  setDemoRole: (role: 'user' | 'admin') => void;
  activeRole: 'user' | 'admin';
  setActiveRole: (role: 'user' | 'admin') => void;
  isAuthenticated: boolean;
  authStatus: 'checking' | 'authenticated' | 'unauthenticated' | 'error';
  authError: string | null;
  sessionExpired: boolean;
  pendingRequests: number;
  dataLoading: boolean;
  reloadData: () => void;
  setIsAuthenticated: (val: boolean) => void;
  user: AppUser | null;

  // Domain Entities
  goals: Goal[];
  milestones: Milestone[];
  actions: ActionItem[];
  acifCategories: AcifCategory[];
  interventions: InterventionDefinition[];
  lessons: LessonRecord[];
  restarts: RestartRecord[];
  barriers: BarrierRecord[];
  weeklyReviews: WeeklyReviewRecord[];
  kpis: MomentumKpiSet;
  pilotParticipants: PilotParticipant[];
  notifications: NotificationSettings;
  analyticsEvents: AnalyticsEvent[];
  knowledgeBase: KnowledgeBaseEntry[];
  promptTemplates: AiPromptTemplate[];

  // Primary selections
  primaryGoal: Goal | undefined;
  activeNma: ActionItem | undefined;
  selectedGoalId: string | null;
  setSelectedGoalId: (id: string | null) => void;

  // Modals & Flow States
  isAuthModalOpen: boolean;
  authModalMode: 'signin' | 'signup' | 'forgot';
  openAuthModal: (mode: 'signin' | 'signup' | 'forgot') => void;
  closeAuthModal: () => void;

  isOnboardingOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;

  isCreateGoalOpen: boolean;
  setIsCreateGoalOpen: (open: boolean) => void;

  isReadinessModalOpen: boolean;
  readinessTargetActionId: string | null;
  openReadinessCheck: (actionId: string) => void;
  closeReadinessCheck: () => void;
  submitReadinessCheck: (
    actionId: string,
    answers: {
      q1Understand: boolean;
      q2KnowHow: boolean;
      q3HaveResources: boolean;
      q4PrerequisitesDone: boolean;
      q5NoResistance: boolean;
    },
    output: ReadinessOutput,
    notes?: string
  ) => Promise<boolean | undefined>;

  isBarrierReviewOpen: boolean;
  barrierTargetActionId: string | null;
  openBarrierReview: (actionId: string) => void;
  closeBarrierReview: () => void;
  submitBarrierReview: (
    actionId: string,
    userExplanation: string,
    confirmedCategory: AcifCategoryCode,
    aiStatus: 'accepted' | 'edited' | 'rejected',
    secondaryCategory?: AcifCategoryCode
  ) => Promise<boolean | undefined>;

  isMmaModalOpen: boolean;
  mmaTargetActionId: string | null;
  openMmaModal: (parentActionId: string) => void;
  closeMmaModal: () => void;
  createMMA: (parentActionId: string, mmaTitle: string, whyThisHelps: string) => void;
  startMMA: (parentActionId: string) => void;
  completeMMA: (parentActionId: string) => void;

  isRestartModalOpen: boolean;
  openRestartModal: (interruptedActionId?: string) => void;
  closeRestartModal: () => void;
  submitRestartReview: (data: {
    isGoalStillMeaningful: boolean;
    whatChanged: string;
    interruptionCause: 'Planned' | 'External' | 'Barrier-Driven' | 'Priority-Driven' | 'Meaning-Driven';
    isPlanStillRealistic: boolean;
    restartStrategy: RestartStrategy;
    restartActionTitle: string;
    restartTargetDate: string;
  }) => void;

  isWeeklyReviewModalOpen: boolean;
  openWeeklyReviewModal: () => void;
  closeWeeklyReviewModal: () => void;
  isWeeklyReviewOpen: boolean;
  openWeeklyReview: () => void;
  closeWeeklyReview: () => void;
  submitWeeklyReview: (data: {
    meaningfulProgress: string;
    actionsThatMattered: string;
    whatGotInTheWay: string;
    interventionsThatHelped: string;
    interventionsThatDidNotHelp: string;
    interruptionExperienced: boolean;
    restartDetails?: string;
    aiSummaryDraft: string;
    aiSummaryConfirmed: boolean;
    lessonText: string;
    adjustmentText: string;
    nextNmaTitle: string;
  }) => Promise<boolean | undefined>;

  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;

  // Actions on entities
  createGoal: (newGoal: Omit<Goal, 'id' | 'createdAt' | 'statusHistory' | 'isPrimary'>) => Promise<boolean | undefined>;
  updateGoalStatus: (goalId: string, newStatus: GoalStatus, note?: string) => void;
  setPrimaryGoal: (goalId: string) => void;
  createMilestone: (goalId: string, title: string, targetDate: string) => Promise<boolean | undefined>;
  toggleMilestone: (milestoneId: string) => void;
  createActionItem: (newAction: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean | undefined>;
  setAsNma: (actionId: string) => void;
  startAction: (actionId: string) => void;
  completeAction: (actionId: string) => void;
  rescheduleAction: (actionId: string, newDate: string) => Promise<boolean | undefined>;
  applyIntervention: (actionId: string, interventionId: string) => void;
  toggleAcifCategory: (code: AcifCategoryCode) => void;
  updateNotifications: (settings: Partial<NotificationSettings>) => void;

  // Toasts & Demo Reset
  toasts: Toast[];
  showToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
  dismissToast: (id: string) => void;
  resetDemoData: () => void;
  logEvent: (eventType: AnalyticsEvent['eventType'], details?: Record<string, any>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const vault = usePrivacyVault();
  // Navigation & Role
  const [activeView, setActiveView] = useState<AppContextType['activeView']>('today');
  const [demoRole, setDemoRole] = useState<'user' | 'admin'>('user');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isDemoMode);
  const [authStatus, setAuthStatus] = useState<AppContextType['authStatus']>(isDemoMode ? 'authenticated' : 'checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const authRef = useRef(false);
  const signedOut = useRef(false);
  const reloadData = () => setReloadVersion(value => value + 1);
  const [user, setUser] = useState<AppUser | null>(isDemoMode ? INITIAL_USER : null);

  useEffect(() => {
    if (isDemoMode || signedOut.current) return;
    let cancelled = false;
    if (!authRef.current) setAuthStatus('checking');
    setDataLoading(true);
    authApi.me()
      .then(async ({ user: backendUser }) => {
        if (cancelled) return;
        const [profile, health] = await Promise.all([accountApi.profile(), apiRequest<{ database: string }>('/health/ready')]);
        if (health.database !== 'connected') throw new Error('DATABASE_UNAVAILABLE');
        if (cancelled) return;
        authRef.current = true;
        setUser({
          name: profile.fullName || backendUser.email,
          email: backendUser.email,
          role: backendUser.roles?.join(', ') || 'Participant',
          roles: backendUser.roles ?? [], permissions: backendUser.permissions ?? [],
        });
        setIsAuthenticated(true);
        setAuthError(null);
        setBackendUserId(backendUser.id);
        return Promise.all([domainApi.goals(), domainApi.actions(), domainApi.milestones(), domainApi.barriers(), domainApi.interventions(), domainApi.reviews(), domainApi.lessons(), domainApi.adjustments(), domainApi.momentumKpis(), domainApi.taxonomy()]);
      })
      .then(async result => {
        if (!result || cancelled) return;
        const [rawGoals, rawActions, rawMilestones, rawBarriers, backendInterventions, rawReviews, rawLessons, , backendKpis, taxonomy] = result;
        const goalKeys = new Map<string, CryptoKey>();
        if (vault.key) {
          await Promise.all(rawGoals.map(async goal => {
            if (goal.contentEncoding !== 'CLIENT_ENCRYPTED' || !goal.ownerWrappedGoalKey) return;
            const key = await unwrapGoalKeyForOwner(goal.ownerWrappedGoalKey, vault.key!, backendUserId || goal.userId, goal.id);
            goalKeys.set(goal.id, key);
            Object.assign(goal, await decryptContent<Record<string, unknown>>(key, goal.encryptedPayload, { userId: backendUserId || goal.userId, entityType: 'goal', entityId: goal.id }));
          }));
        }
        const decryptChild = async (record: any, goalId: string, entityType: string, entityId: string) => {
          const key = goalKeys.get(goalId);
          if (!key || record.contentEncoding !== 'CLIENT_ENCRYPTED' || !record.encryptedPayload) return record;
          for (const contextId of [...new Set([record.id, entityId].filter(Boolean))]) {
            try { return { ...record, ...await decryptContent<Record<string, unknown>>(key, record.encryptedPayload, { userId: backendUserId || rawGoals.find(goal => goal.id === goalId)?.userId, entityType, entityId: contextId }) }; }
            catch { /* Legacy records may use their parent as AAD context. */ }
          }
          return record;
        };
        const backendGoals = rawGoals;
        const backendMilestones = await Promise.all(rawMilestones.map(item => decryptChild(item, item.goalId, 'milestone', item.goalId)));
        const backendActions = await Promise.all(rawActions.map(async action => {
          const value = await decryptChild(action, action.goalId, 'action', action.goalId);
          value.readinessAssessments = await Promise.all((action.readinessAssessments || []).map((item: any) => decryptChild(item, action.goalId, 'readiness', action.id)));
          value.mmaChildActions = await Promise.all((action.mmaChildActions || []).map((item: any) => decryptChild(item, action.goalId, 'mma', action.id)));
          return value;
        }));
        const backendBarriers = await Promise.all(rawBarriers.map(item => decryptChild(item, item.action?.goalId, 'barrier', item.actionId)));
        const backendReviews = await Promise.all(rawReviews.map(item => decryptChild(item, item.goalId, 'review', item.goalId)));
        const backendLessons = await Promise.all(rawLessons.map(item => decryptChild(item, item.goalId, 'review', item.goalId)));
        if (cancelled) return;
        setGoals(backendGoals.map(goal => ({
          id: goal.id,
          title: goal.title || 'Encrypted goal',
          description: goal.description || '',
          category: goal.category || 'Not specified',
          targetDate: goal.targetDate || '',
          priority: 'Standard' as const,
          whyThisMatters: goal.whyItMatters || '',
          status: goal.status === 'COMPLETED' ? 'Completed' : goal.status === 'PAUSED' ? 'Paused' : 'Active',
          isPrimary: Boolean(goal.isPrimary),
          statusHistory: [],
          createdAt: goal.createdAt,
          nextReviewDate: goal.targetDate || '',
          privacyMode: goal.privacyMode,
          ownerWrappedGoalKey: goal.ownerWrappedGoalKey,
          encryptedPayload: goal.encryptedPayload,
          kpi: goal.kpis?.[0] ? { id: goal.kpis[0].id, name: goal.kpis[0].name || 'Encrypted KPI', currentValue: goal.kpis[0].currentValue, targetValue: goal.kpis[0].targetValue, unit: goal.kpis[0].unit || '' } : undefined,
        })));
        setActions(backendActions.map(action => ({
          id: action.id,
          goalId: action.goalId,
          milestoneId: action.milestoneId,
          title: action.title || 'Encrypted action',
          description: action.description || '',
          isNMA: Boolean(action.isNMA),
          status: action.status === 'COMPLETED' ? 'Completed' : action.status === 'IN_PROGRESS' ? 'In Progress' : action.status === 'BLOCKED' ? 'Blocked' : 'Not Started',
          dueDate: action.scheduledDate || '',
          rhythm: 'Not specified' as const,
          createdAt: action.createdAt,
          updatedAt: action.updatedAt,
          readinessCheck: action.readinessAssessments?.[0] ? {
            completedAt: action.readinessAssessments[0].assessedAt,
            q1Understand: action.readinessAssessments[0].clearlyUnderstood,
            q2KnowHow: action.readinessAssessments[0].knowsHowToDo,
            q3HaveResources: action.readinessAssessments[0].hasResources,
            q4PrerequisitesDone: action.readinessAssessments[0].prerequisitesMet,
            q5NoResistance: action.readinessAssessments[0].internalResistanceLow,
            output: String(action.readinessAssessments[0].provisionalVerdict).split('_').map((word: string) => word[0] + word.slice(1).toLowerCase()).join(' ') as ReadinessOutput,
            notes: action.readinessAssessments[0].notes || undefined,
          } : undefined,
          mma: action.mmaChildActions?.[0] ? { id: action.mmaChildActions[0].id, parentActionId: action.id, title: action.mmaChildActions[0].title || 'Encrypted MMA', whyThisHelps: action.mmaChildActions[0].whyThisHelps || '', completed: action.mmaChildActions[0].status === 'COMPLETED', startedAt: action.mmaChildActions[0].startedAt, completedAt: action.mmaChildActions[0].completedAt } : undefined,
        })));
        setMilestones(backendMilestones.map(item => ({ id: item.id, goalId: item.goalId, title: item.title || 'Encrypted milestone', targetDate: item.targetDate || '', completed: Boolean(item.isCompleted), order: item.orderIndex + 1 })));
        setBarriers(backendBarriers.map(item => ({ id: item.id, actionId: item.actionId, goalId: item.action?.goalId || '', userExplanation: item.userExplanation || 'Encrypted barrier', confirmedCategory: String(item.categoryCode).toLowerCase() as AcifCategoryCode, aiSuggestedCategory: item.aiSuggestedCategory ? String(item.aiSuggestedCategory).toLowerCase() as AcifCategoryCode : undefined, aiStatus: item.userConfirmationState === 'REJECTED' ? 'rejected' : item.userConfirmationState === 'MODIFIED' ? 'edited' : 'accepted', interventionApplied: item.interventions?.[0]?.intervention?.name, recordedAt: item.createdAt, resolved: Boolean(item.resolved) })));
        setInterventions(backendInterventions.map((item, index) => ({ id: item.code, barrierCode: String(item.targetBarrierCode).toLowerCase() as AcifCategoryCode, title: item.name, summary: item.summary, suggestedActionType: item.code.includes('MMA') ? 'mma' : 'clarification', safetyLevel: item.safetyLevel === 'STANDARD' ? 'Standard' : 'Elevated', language: 'en', version: String(item.version), status: item.isPublished ? 'Approved' : 'Review', exampleMMA: index === 0 ? item.instructions : undefined })));
        setWeeklyReviews(backendReviews.map(item => ({ id: item.id, weekEndingDate: item.weekEndingDate, meaningfulProgress: item.meaningfulProgress || 'Encrypted review', actionsThatMattered: item.actionsThatMattered || '', whatGotInTheWay: item.whatGotInTheWay || '', interventionsThatHelped: item.interventionsThatHelped || '', interventionsThatDidNotHelp: item.interventionsThatDidNotHelp || '', interruptionExperienced: Boolean(item.interruptionExperienced), restartDetails: item.restartDetails || undefined, aiSummaryDraft: item.aiSummaryDraft || '', aiSummaryConfirmed: Boolean(item.aiSummaryConfirmed), lessonText: item.lessons?.[0]?.lessonText || '', adjustmentText: item.adjustments?.[0]?.description || '', nextNmaTitle: item.nextNmaTitle || '', createdAt: item.createdAt })));
        setLessons(backendLessons.map(item => ({ id: item.id, goalId: item.goalId, goalTitle: item.goal?.title || 'Encrypted goal', date: item.createdAt, lesson: item.lessonText || 'Encrypted lesson', adjustmentMade: item.adjustmentText || '', relatedBarrierCode: item.relatedBarrierCode ? String(item.relatedBarrierCode).toLowerCase() as AcifCategoryCode : undefined })));
        setAcifCategories(taxonomy.map((item: any) => ({ code: String(item.code).toLowerCase().replace('meaning_direction_concern','meaning_direction') as AcifCategoryCode, number: item.number ?? 0, name: item.name, nonJudgmentalDescription: item.description || item.definition || '', defaultIntervention: item.defaultIntervention || '', whyThisHelps: '', active: item.isActive !== false, version: String(item.version ?? '') })));
        setProductionKpis(backendKpis);
        setAuthStatus('authenticated');
        await Promise.all(backendGoals.map(goal => domainApi.restarts(goal.id))).then(async groups => {
          const records: RestartRecord[] = [];
          for (const group of groups) for (const item of group) for (const restart of item.restarts) {
            const interruption = await decryptChild(item, item.goalId, 'restart', item.goalId);
            const restored = await decryptChild(restart, item.goalId, 'restart', item.goalId);
            records.push({ id: restart.id, goalId: item.goalId, declaredAt: restart.restartedAt, isGoalStillMeaningful: restart.isStillMeaningful, whatChanged: restored.whatChanged || '', interruptionCause: String(item.interruptionType).split('_').map((word: string) => word[0] + word.slice(1).toLowerCase()).join('-') as RestartRecord['interruptionCause'], isPlanStillRealistic: restart.isPlanRealistic, restartStrategy: String(restart.restartDecision).split('_').map((word: string) => word[0] + word.slice(1).toLowerCase()).join(' ') as RestartStrategy, restartActionTitle: restored.restartActionTitle || 'Encrypted restart action', restartTargetDate: restart.restartedAt });
            if (!restored.whatChanged && interruption.whatChanged) records[records.length - 1].whatChanged = interruption.whatChanged;
          }
          if (!cancelled) setRestarts(records);
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setUser(null);
        setIsAuthenticated(false);
        const code = error instanceof Error ? error.message : 'AUTH_CHECK_FAILED';
        if ((error instanceof ApiError && error.status === 401) || code === 'HTTP_401' || code === 'Unauthorized') { setAuthStatus('unauthenticated'); authRef.current = false; }
        else { setAuthStatus('error'); setAuthError('SOPET Momentum could not connect to the service. Please try again.'); }
      }).finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [vault.key, reloadVersion]);

  useEffect(() => {
    const expire = () => {
      if (!authRef.current) return;
      signedOut.current = true; authRef.current = false;
      vault.lock(); setUser(null); setIsAuthenticated(false); setSessionExpired(true);
      setAuthStatus('unauthenticated'); setGoals([]); setActions([]); setMilestones([]);
      setBarriers([]); setWeeklyReviews([]); setLessons([]); setRestarts([]);
      setIsCreateGoalOpen(false); setIsReadinessModalOpen(false); setIsBarrierReviewOpen(false);
      setIsMmaModalOpen(false); setIsRestartModalOpen(false); setIsWeeklyReviewModalOpen(false); setIsOnboardingOpen(false);
    };
    const pending = (event: Event) => setPendingRequests((event as CustomEvent<number>).detail);
    const clearPrivate = () => {
      if (isDemoMode) return;
      setGoals([]); setActions([]); setMilestones([]); setBarriers([]); setWeeklyReviews([]); setLessons([]); setRestarts([]);
      setIsCreateGoalOpen(false); setIsReadinessModalOpen(false); setIsBarrierReviewOpen(false); setIsMmaModalOpen(false); setIsRestartModalOpen(false); setIsWeeklyReviewModalOpen(false);
    };
    window.addEventListener('sopet:session-expired', expire); window.addEventListener('sopet:pending', pending);
    window.addEventListener('sopet:vault-locked', clearPrivate);
    return () => { window.removeEventListener('sopet:session-expired', expire); window.removeEventListener('sopet:pending', pending); window.removeEventListener('sopet:vault-locked', clearPrivate); };
  }, [vault.lock]);

  // Entities loaded from localStorage or defaults
  const [goals, setGoals] = useState<Goal[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_goals');
    return saved ? JSON.parse(saved) : INITIAL_GOALS;
  });

  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_milestones');
    return saved ? JSON.parse(saved) : INITIAL_MILESTONES;
  });

  const [actions, setActions] = useState<ActionItem[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_actions');
    return saved ? JSON.parse(saved) : INITIAL_ACTIONS;
  });

  const [acifCategories, setAcifCategories] = useState<AcifCategory[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_acif');
    return saved ? JSON.parse(saved) : ACIF_CATEGORIES;
  });

  const [interventions, setInterventions] = useState<InterventionDefinition[]>(isDemoMode ? APPROVED_INTERVENTIONS : []);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [productionKpis, setProductionKpis] = useState<MomentumKpiSet | null>(null);

  const [lessons, setLessons] = useState<LessonRecord[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_lessons');
    return saved ? JSON.parse(saved) : INITIAL_LESSONS;
  });

  const [restarts, setRestarts] = useState<RestartRecord[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_restarts');
    return saved ? JSON.parse(saved) : [];
  });

  const [barriers, setBarriers] = useState<BarrierRecord[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_barriers');
    return saved ? JSON.parse(saved) : INITIAL_BARRIERS;
  });

  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReviewRecord[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_reviews');
    return saved ? JSON.parse(saved) : INITIAL_WEEKLY_REVIEWS;
  });

  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    if (!isDemoMode) return INITIAL_NOTIFICATIONS;
    const saved = localStorage.getItem('sopet_momentum_notifications');
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>(() => {
    if (!isDemoMode) return [];
    const saved = localStorage.getItem('sopet_momentum_analytics');
    return saved ? JSON.parse(saved) : INITIAL_ANALYTICS_EVENTS;
  });

  const [knowledgeBase] = useState<KnowledgeBaseEntry[]>(isDemoMode ? KNOWLEDGE_BASE_ENTRIES : []);
  const [promptTemplates] = useState<AiPromptTemplate[]>(isDemoMode ? INITIAL_PROMPT_TEMPLATES : []);

  // Modals state
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState<boolean>(false);
  const [isReadinessModalOpen, setIsReadinessModalOpen] = useState<boolean>(false);
  const [readinessTargetActionId, setReadinessTargetActionId] = useState<string | null>(null);
  const [isBarrierReviewOpen, setIsBarrierReviewOpen] = useState<boolean>(false);
  const [barrierTargetActionId, setBarrierTargetActionId] = useState<string | null>(null);
  const [isMmaModalOpen, setIsMmaModalOpen] = useState<boolean>(false);
  const [mmaTargetActionId, setMmaTargetActionId] = useState<string | null>(null);
  const [isRestartModalOpen, setIsRestartModalOpen] = useState<boolean>(false);
  const [restartTargetActionId, setRestartTargetActionId] = useState<string | null>(null);
  const [isWeeklyReviewModalOpen, setIsWeeklyReviewModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Sync to localStorage
  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_milestones', JSON.stringify(milestones));
  }, [milestones]);

  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_actions', JSON.stringify(actions));
  }, [actions]);

  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_lessons', JSON.stringify(lessons));
  }, [lessons]);

  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_restarts', JSON.stringify(restarts));
  }, [restarts]);

  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_reviews', JSON.stringify(weeklyReviews));
  }, [weeklyReviews]);

  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_barriers', JSON.stringify(barriers));
  }, [barriers]);

  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (!isDemoMode) return;
    localStorage.setItem('sopet_momentum_analytics', JSON.stringify(analyticsEvents));
  }, [analyticsEvents]);

  // Derived state
  const primaryGoal = goals.find(g => g.isPrimary) || goals[0];
  const activeNma = actions.find(a => a.isNMA && a.status !== 'Completed') || actions.find(a => a.isNMA);

  // Dynamic Momentum KPI Calculations
  const calculatedKpis: MomentumKpiSet = {
    actionCompletionRate: actions.length > 0
      ? Math.round((actions.filter(a => a.status === 'Completed').length / actions.length) * 100)
      : 0,
    continuityWeeks: weeklyReviews.length,
    momentumContinuityWeeks: weeklyReviews.length,
    restartSpeedDays: 0,
    barrierResolutionRate: barriers.length > 0
      ? Math.round((barriers.filter(b => b.resolved).length / barriers.length) * 100)
      : 0,
    goalMilestoneProgress: milestones.length > 0
      ? Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100)
      : 0,
    milestoneProgressPercent: milestones.length > 0
      ? Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100)
      : 0,
    selfEfficacyScore: 0,
    selfEfficacyTrend: 'Stable',
    totalActions: actions.length,
    completedActions: actions.filter(a => a.status === 'Completed').length,
    inProgressActions: actions.filter(a => a.status === 'In Progress').length,
    blockedActions: actions.filter(a => a.status === 'Blocked').length,
    totalBarriersDiagnosed: barriers.length,
    barriersResolved: barriers.filter(b => b.resolved).length,
    totalMilestones: milestones.length,
    completedMilestones: milestones.filter(m => m.completed).length,
  };
  const kpis = !isDemoMode && productionKpis ? productionKpis : calculatedKpis;

  // Pilot Cohort Participants for Admin / Analytics
  const demoParticipants: PilotParticipant[] = [
    {
      id: 'part-1',
      name: 'Amina (Active User)',
      goalTitle: 'Start a catering business',
      status: 'Active',
      completedActionsCount: 12,
      weeksContinuity: 4,
      lastActiveDate: '2026-09-09',
    },
    {
      id: 'part-2',
      name: 'Marcus K.',
      goalTitle: 'Launch independent design studio',
      status: 'Active',
      completedActionsCount: 9,
      weeksContinuity: 3,
      lastActiveDate: '2026-09-08',
    },
    {
      id: 'part-3',
      name: 'Elena R.',
      goalTitle: 'Renewable energy micro-grid research',
      status: 'Active',
      completedActionsCount: 15,
      weeksContinuity: 5,
      lastActiveDate: '2026-09-09',
    },
    {
      id: 'part-4',
      name: 'Tariq M.',
      goalTitle: 'Community health outreach program',
      status: 'Paused',
      completedActionsCount: 6,
      weeksContinuity: 2,
      lastActiveDate: '2026-09-05',
    },
    {
      id: 'part-5',
      name: 'Sarah L.',
      goalTitle: 'Publish educational workbook',
      status: 'Active',
      completedActionsCount: 11,
      weeksContinuity: 4,
      lastActiveDate: '2026-09-08',
    },
  ];
  const pilotParticipants = isDemoMode ? demoParticipants : [];

  // Helper Toast
  const showToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const protectedPayload = async (goalId: string, entityType: string, entityId: string, privateContent: Record<string, unknown>) => {
    const goal = goals.find(item => item.id === goalId);
    if (!goal || goal.privacyMode === 'STANDARD_PRIVATE' || !goal.privacyMode) return privateContent;
    if (!vault.key || !goal.ownerWrappedGoalKey || !backendUserId) throw new Error('Unlock the Privacy Vault before saving protected Goal data.');
    const goalKey = await unwrapGoalKeyForOwner(goal.ownerWrappedGoalKey, vault.key, backendUserId, goalId);
    return { contentEncoding: 'CLIENT_ENCRYPTED', encryptedPayload: await encryptContent(goalKey, privateContent, { userId: backendUserId, entityType, entityId, keyVersion: 1 }) };
  };
  const backendBarrierCode = (code: AcifCategoryCode) => code === 'meaning_direction' ? 'MEANING_DIRECTION_CONCERN' : code.toUpperCase();

  const logEvent = (eventType: AnalyticsEvent['eventType'], details?: Record<string, any>) => {
    if (!isDemoMode) return;
    const newEvent: AnalyticsEvent = {
      id: 'evt-' + Date.now(),
      eventType,
      timestamp: new Date().toISOString(),
      details,
    };
    setAnalyticsEvents(prev => [newEvent, ...prev]);
  };

  // Auth Modal handlers
  const openAuthModal = (mode: 'signin' | 'signup' | 'forgot') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };
  const closeAuthModal = () => setIsAuthModalOpen(false);

  // Onboarding handlers
  const openOnboarding = () => setIsOnboardingOpen(true);
  const closeOnboarding = () => setIsOnboardingOpen(false);

  // Readiness handlers
  const openReadinessCheck = (actionId: string) => {
    setReadinessTargetActionId(actionId);
    setIsReadinessModalOpen(true);
  };
  const closeReadinessCheck = () => {
    setIsReadinessModalOpen(false);
    setReadinessTargetActionId(null);
  };
  const submitReadinessCheck = async (
    actionId: string,
    answers: {
      q1Understand: boolean;
      q2KnowHow: boolean;
      q3HaveResources: boolean;
      q4PrerequisitesDone: boolean;
      q5NoResistance: boolean;
    },
    output: ReadinessOutput,
    notes?: string
  ) => {
    if (!isDemoMode) {
      const action = actions.find(item => item.id === actionId);
      if (!action) return;
      return protectedPayload(action.goalId, 'readiness', actionId, { notes }).then(privateFields => domainApi.assessReadiness(actionId, { clearlyUnderstood: answers.q1Understand, knowsHowToDo: answers.q2KnowHow, hasResources: answers.q3HaveResources, prerequisitesMet: answers.q4PrerequisitesDone, internalResistanceLow: answers.q5NoResistance, ...privateFields })).then(saved => {
        setActions(prev => prev.map(item => item.id === actionId ? { ...item, readinessCheck: { completedAt: saved.assessedAt, ...answers, output, notes }, updatedAt: new Date().toISOString() } : item));
        closeReadinessCheck(); showToast(`Action readiness checked: ${output}`, 'info');
      }).then(() => true).catch(error => { showToast(error instanceof Error ? error.message : 'Readiness could not be saved.', 'warning'); return false; });
    }
    setActions(prev =>
      prev.map(a => {
        if (a.id === actionId) {
          return {
            ...a,
            readinessCheck: {
              completedAt: new Date().toISOString(),
              ...answers,
              output,
              notes,
            },
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
    closeReadinessCheck();
    showToast(`Action readiness checked: ${output}`, 'info');
    return true;
  };

  // Barrier review handlers
  const openBarrierReview = (actionId: string) => {
    setBarrierTargetActionId(actionId);
    setIsBarrierReviewOpen(true);
  };
  const closeBarrierReview = () => {
    setIsBarrierReviewOpen(false);
    setBarrierTargetActionId(null);
  };
  const submitBarrierReview = async (
    actionId: string,
    userExplanation: string,
    confirmedCategory: AcifCategoryCode,
    aiStatus: 'accepted' | 'edited' | 'rejected',
    secondaryCategory?: AcifCategoryCode
  ) => {
    if (!isDemoMode) {
      const action = actions.find(item => item.id === actionId);
      if (!action) return;
      return protectedPayload(action.goalId, 'barrier', actionId, { userExplanation }).then(privateFields => domainApi.blockAction(actionId, privateFields)).then(() => domainApi.confirmBarrier(actionId, { confirmedCategory: backendBarrierCode(confirmedCategory), aiSuggestedCategory: backendBarrierCode(confirmedCategory), userConfirmationState: aiStatus === 'edited' ? 'MODIFIED' : aiStatus === 'rejected' ? 'REJECTED' : 'CONFIRMED' })).then(saved => {
        setActions(prev => prev.map(item => item.id === actionId ? { ...item, status: 'Blocked', updatedAt: new Date().toISOString() } : item));
        setBarriers(prev => [{ id: saved.id, actionId, goalId: action.goalId, userExplanation, confirmedCategory, aiStatus, secondaryCategory, interventionApplied: undefined, recordedAt: saved.createdAt, resolved: false }, ...prev]);
        closeBarrierReview(); showToast('Barrier recorded non-judgmentally. Next: Review recommended intervention.', 'info');
      }).then(() => true).catch(error => { showToast(error instanceof Error ? error.message : 'Barrier could not be saved.', 'warning'); return false; });
    }
    setActions(prev =>
      prev.map(a => {
        if (a.id === actionId) {
          return {
            ...a,
            status: 'Blocked' as ActionStatus,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );

    const newBarrier: BarrierRecord = {
      id: 'barr-' + Date.now(),
      actionId,
      goalId: primaryGoal?.id || '',
      userExplanation,
      confirmedCategory,
      aiStatus,
      secondaryCategory,
      interventionApplied: 'Minimum Meaningful Action (MMA)',
      recordedAt: new Date().toISOString(),
      resolved: false,
    };
    setBarriers(prev => [newBarrier, ...prev]);

    logEvent('ACTION_BLOCKED', { actionId });
    logEvent('BARRIER_CONFIRMED', { category: confirmedCategory });
    if (aiStatus === 'accepted') logEvent('AI_SUGGESTION_CONFIRMED');
    if (aiStatus === 'rejected') logEvent('AI_SUGGESTION_REJECTED');
    if (aiStatus === 'edited') logEvent('AI_SUGGESTION_EDITED');

    showToast('Barrier recorded non-judgmentally. Next: Review recommended intervention.', 'info');
    return true;
  };

  // MMA handlers
  const openMmaModal = (parentActionId: string) => {
    setMmaTargetActionId(parentActionId);
    setIsMmaModalOpen(true);
  };
  const closeMmaModal = () => {
    setIsMmaModalOpen(false);
    setMmaTargetActionId(null);
  };

  const createMMA = (parentActionId: string, mmaTitle: string, whyThisHelps: string) => {
    if (!isDemoMode) {
      const action = actions.find(item => item.id === parentActionId);
      if (!action) return;
      void protectedPayload(action.goalId, 'mma', parentActionId, { title: mmaTitle, whyThisHelps }).then(privateFields => domainApi.createMma(parentActionId, { timeframeMinutes: 15, ...privateFields })).then(saved => {
        setActions(prev => prev.map(item => item.id === parentActionId ? { ...item, mma: { id: saved.id, parentActionId, title: mmaTitle, whyThisHelps, completed: false }, updatedAt: saved.updatedAt } : item));
        closeMmaModal(); showToast('Minimum Meaningful Action (MMA) created and linked to parent action.', 'success');
      }).catch(error => showToast(error instanceof Error ? error.message : 'MMA could not be saved.', 'warning'));
      return;
    }
    setActions(prev =>
      prev.map(a => {
        if (a.id === parentActionId) {
          return {
            ...a,
            mma: {
              id: 'mma-' + Date.now(),
              parentActionId,
              title: mmaTitle,
              whyThisHelps,
              completed: false,
            },
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
    logEvent('MMA_CREATED', { parentActionId, mmaTitle });
    closeMmaModal();
    showToast('Minimum Meaningful Action (MMA) created and linked to parent action.', 'success');
  };

  const startMMA = (parentActionId: string) => {
    if (!isDemoMode) {
      const action = actions.find(item => item.id === parentActionId);
      if (!action?.mma) return;
      void domainApi.startMma(action.mma.id).then(saved => setActions(prev => prev.map(item => item.id === parentActionId && item.mma ? { ...item, mma: { ...item.mma, startedAt: saved.startedAt } } : item))).catch(error => showToast(error instanceof Error ? error.message : 'MMA could not be started.', 'warning'));
      return;
    }
    setActions(prev =>
      prev.map(a => {
        if (a.id === parentActionId && a.mma) {
          return {
            ...a,
            mma: {
              ...a.mma,
              startedAt: new Date().toISOString(),
            },
          };
        }
        return a;
      })
    );
    showToast('Minimum Meaningful Action started. Focus on this micro-step.', 'info');
  };

  const completeMMA = (parentActionId: string) => {
    if (!isDemoMode) {
      const action = actions.find(item => item.id === parentActionId);
      if (!action?.mma) return;
      void domainApi.completeMma(action.mma.id).then(saved => {
        setActions(prev => prev.map(item => item.id === parentActionId && item.mma ? { ...item, mma: { ...item.mma, completed: true, completedAt: saved.completedAt }, status: 'In Progress', updatedAt: saved.updatedAt } : item));
        setBarriers(prev => prev.map(item => item.actionId === parentActionId ? { ...item, resolved: true } : item));
        showToast('MMA Completed! Meaningful momentum restored. Return to Parent Action.', 'success');
      }).catch(error => showToast(error instanceof Error ? error.message : 'MMA completion could not be saved.', 'warning'));
      return;
    }
    setActions(prev =>
      prev.map(a => {
        if (a.id === parentActionId && a.mma) {
          return {
            ...a,
            mma: {
              ...a.mma,
              completed: true,
              completedAt: new Date().toISOString(),
            },
            // Note: Per methodology, completing MMA preserves progress but does NOT falsely complete Parent Action
            status: 'In Progress' as ActionStatus,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
    setBarriers(prev =>
      prev.map(b => (b.actionId === parentActionId ? { ...b, resolved: true } : b))
    );
    logEvent('MMA_COMPLETED', { parentActionId });
    showToast('MMA Completed! Meaningful momentum restored. Return to Parent Action.', 'success');
  };

  // Restart Handlers
  const openRestartModal = (interruptedActionId?: string) => {
    setRestartTargetActionId(interruptedActionId || null);
    setIsRestartModalOpen(true);
  };
  const closeRestartModal = () => {
    setIsRestartModalOpen(false);
    setRestartTargetActionId(null);
  };
  const submitRestartReview = (data: {
    isGoalStillMeaningful: boolean;
    whatChanged: string;
    interruptionCause: 'Planned' | 'External' | 'Barrier-Driven' | 'Priority-Driven' | 'Meaning-Driven';
    isPlanStillRealistic: boolean;
    restartStrategy: RestartStrategy;
    restartActionTitle: string;
    restartTargetDate: string;
  }) => {
    if (!primaryGoal) return;
    if (!isDemoMode) {
      const interruptionType = data.interruptionCause.toUpperCase().replace(/-/g, '_');
      const decision: Record<RestartStrategy, string> = { Resume: 'RESUME', Adjust: 'ADJUST', 'Reduce Action': 'REDUCE_ACTION', 'Change NMA': 'CHANGE_NMA', 'Pause Goal': 'PAUSE_GOAL', 'Strategically Discontinue': 'STRATEGICALLY_DISCONTINUE' };
      void protectedPayload(primaryGoal.id, 'restart', primaryGoal.id, { causeDescription: data.interruptionCause, whatChanged: data.whatChanged, rootCause: data.interruptionCause, restartActionTitle: data.restartActionTitle }).then(privateFields => domainApi.createRestart(primaryGoal.id, { interruptionType, isStillMeaningful: data.isGoalStillMeaningful, isPlanRealistic: data.isPlanStillRealistic, restartDecision: decision[data.restartStrategy], daysElapsed: 0, ...privateFields })).then(async saved => {
        const persisted: RestartRecord = { id: saved.restart.id, goalId: primaryGoal.id, interruptedActionId: restartTargetActionId || undefined, declaredAt: saved.restart.restartedAt, ...data };
        setRestarts(prev => [persisted, ...prev]);
        let newAction = saved.newAction;
        if (!newAction && primaryGoal.privacyMode !== 'STANDARD_PRIVATE' && !['Pause Goal', 'Strategically Discontinue'].includes(data.restartStrategy)) {
          const actionPrivate = await protectedPayload(primaryGoal.id, 'action', primaryGoal.id, { title: data.restartActionTitle, description: `Restart action established following ${data.interruptionCause.toLowerCase()} interruption review.` });
          newAction = await domainApi.createAction({ goalId: primaryGoal.id, isNMA: true, scheduledDate: data.restartTargetDate, ...actionPrivate });
        }
        if (newAction) setActions(prev => [{ id: newAction.id, goalId: primaryGoal.id, title: data.restartActionTitle, description: '', isNMA: true, status: 'Not Started', dueDate: data.restartTargetDate, rhythm: 'Daily', createdAt: newAction.createdAt, updatedAt: newAction.updatedAt }, ...prev.map(item => item.goalId === primaryGoal.id ? { ...item, isNMA: false } : item)]);
        if (data.restartStrategy === 'Pause Goal') setGoals(prev => prev.map(item => item.id === primaryGoal.id ? { ...item, status: 'Paused' } : item));
        closeRestartModal(); setActiveView('today'); showToast(`Intelligent Restart recorded (${data.restartStrategy}). Returned to Today's Focus.`, 'success');
      }).catch(error => showToast(error instanceof Error ? error.message : 'Restart could not be saved.', 'warning'));
      return;
    }
    const newRestart: RestartRecord = {
      id: 'rst-' + Date.now(),
      goalId: primaryGoal.id,
      interruptedActionId: restartTargetActionId || undefined,
      declaredAt: new Date().toISOString(),
      ...data,
    };
    setRestarts(prev => [newRestart, ...prev]);

    // Handle strategy effects
    if (data.restartStrategy === 'Pause Goal') {
      updateGoalStatus(primaryGoal.id, 'Paused', 'Paused following Intelligent Restart Review');
    } else {
      // Create new Restart Action as NMA
      const newAction: ActionItem = {
        id: 'act-' + Date.now(),
        goalId: primaryGoal.id,
        title: data.restartActionTitle,
        description: `Restart action established following ${data.interruptionCause.toLowerCase()} interruption review.`,
        isNMA: true,
        status: 'Not Started',
        dueDate: data.restartTargetDate,
        rhythm: 'Daily',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Unset previous NMAs
      setActions(prev => [
        newAction,
        ...prev.map(a => (a.goalId === primaryGoal.id ? { ...a, isNMA: false } : a)),
      ]);

      logEvent('GOAL_RESTARTED', { strategy: data.restartStrategy, action: data.restartActionTitle });
    }

    closeRestartModal();
    setActiveView('today');
    showToast(`Intelligent Restart recorded (${data.restartStrategy}). Returned to Today's Focus.`, 'success');
  };

  // Weekly Review Handlers
  const openWeeklyReviewModal = () => setIsWeeklyReviewModalOpen(true);
  const closeWeeklyReviewModal = () => setIsWeeklyReviewModalOpen(false);
  const submitWeeklyReview = async (data: {
    meaningfulProgress: string;
    actionsThatMattered: string;
    whatGotInTheWay: string;
    interventionsThatHelped: string;
    interventionsThatDidNotHelp: string;
    interruptionExperienced: boolean;
    restartDetails?: string;
    aiSummaryDraft: string;
    aiSummaryConfirmed: boolean;
    lessonText: string;
    adjustmentText: string;
    nextNmaTitle: string;
  }) => {
    if (!isDemoMode) {
      if (!primaryGoal) return;
      return protectedPayload(primaryGoal.id, 'review', primaryGoal.id, data).then(privateFields => domainApi.createReview({ goalId: primaryGoal.id, weekEndingDate: new Date().toISOString().split('T')[0], interruptionExperienced: data.interruptionExperienced, aiSummaryConfirmed: data.aiSummaryConfirmed, ...(primaryGoal.privacyMode === 'STANDARD_PRIVATE' || !primaryGoal.privacyMode ? { meaningfulProgress: data.meaningfulProgress, actionsThatMattered: data.actionsThatMattered, whatGotInTheWay: data.whatGotInTheWay, interventionsThatHelped: data.interventionsThatHelped, interventionsThatDidNotHelp: data.interventionsThatDidNotHelp, restartDetails: data.restartDetails, aiSummaryDraft: data.aiSummaryDraft, extractedLesson: data.lessonText, concreteAdjustment: data.adjustmentText, nextNmaTitle: data.nextNmaTitle } : privateFields) })).then(async saved => {
        const reviewRecord: WeeklyReviewRecord = { id: saved.id, weekEndingDate: saved.weekEndingDate, ...data, createdAt: saved.createdAt };
        setWeeklyReviews(prev => [reviewRecord, ...prev]);
        if (data.lessonText) setLessons(prev => [{ id: `review-${saved.id}`, goalId: primaryGoal.id, goalTitle: primaryGoal.title, date: saved.createdAt, lesson: data.lessonText, adjustmentMade: data.adjustmentText }, ...prev]);
        if (primaryGoal.privacyMode !== 'STANDARD_PRIVATE' && data.nextNmaTitle) {
          const actionPrivate = await protectedPayload(primaryGoal.id, 'action', primaryGoal.id, { title: data.nextNmaTitle, description: `Anchored during Weekly Review (${reviewRecord.weekEndingDate})` });
          const action = await domainApi.createAction({ goalId: primaryGoal.id, isNMA: true, ...actionPrivate });
          setActions(prev => [{ id: action.id, goalId: primaryGoal.id, title: data.nextNmaTitle, description: '', isNMA: true, status: 'Not Started', dueDate: '', rhythm: 'Three times weekly', createdAt: action.createdAt, updatedAt: action.updatedAt }, ...prev.map(item => item.goalId === primaryGoal.id ? { ...item, isNMA: false } : item)]);
        }
        closeWeeklyReviewModal(); showToast('Weekly Review completed. Personal Lesson and next NMA recorded.', 'success');
      }).then(() => true).catch(error => { showToast(error instanceof Error ? error.message : 'Weekly Review could not be saved.', 'warning'); return false; });
    }
    const reviewRecord: WeeklyReviewRecord = {
      id: 'rev-' + Date.now(),
      weekEndingDate: new Date().toISOString().split('T')[0],
      ...data,
      createdAt: new Date().toISOString(),
    };
    setWeeklyReviews(prev => [reviewRecord, ...prev]);

    // Create Lesson if provided
    if (data.lessonText && primaryGoal) {
      const newLesson: LessonRecord = {
        id: 'les-' + Date.now(),
        goalId: primaryGoal.id,
        goalTitle: primaryGoal.title,
        date: new Date().toISOString().split('T')[0],
        lesson: data.lessonText,
        adjustmentMade: data.adjustmentText,
      };
      setLessons(prev => [newLesson, ...prev]);
      logEvent('LESSON_CREATED', { goalId: primaryGoal.id });
    }

    // Set Next NMA if specified
    if (data.nextNmaTitle && primaryGoal) {
      const newAction: ActionItem = {
        id: 'act-' + Date.now(),
        goalId: primaryGoal.id,
        title: data.nextNmaTitle,
        isNMA: true,
        status: 'Not Started',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        rhythm: 'Three times weekly',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setActions(prev => [
        newAction,
        ...prev.map(a => (a.goalId === primaryGoal.id ? { ...a, isNMA: false } : a)),
      ]);
    }

    logEvent('REVIEW_COMPLETED');
    closeWeeklyReviewModal();
    showToast('Weekly Review completed. Personal Lesson and next NMA recorded.', 'success');
    return true;
  };

  // Entity operations
  const createGoal = async (newGoalData: Omit<Goal, 'id' | 'createdAt' | 'statusHistory' | 'isPrimary'>) => {
    if (!isDemoMode) {
      return domainApi.createGoal({ title: newGoalData.title, description: newGoalData.description, whyItMatters: newGoalData.whyThisMatters, targetDate: newGoalData.targetDate, isPrimary: goals.length === 0, privacyMode: newGoalData.privacyMode }).then(async created => {
        const kpi = newGoalData.kpi ? await domainApi.createKpi({ goalId: created.id, name: newGoalData.kpi.name, unit: newGoalData.kpi.unit, targetValue: newGoalData.kpi.targetValue, currentValue: newGoalData.kpi.currentValue }) : undefined;
        const saved: Goal = { ...newGoalData, kpi: kpi && newGoalData.kpi ? { ...newGoalData.kpi, id: kpi.id } : newGoalData.kpi, id: created.id, isPrimary: Boolean(created.isPrimary), createdAt: created.createdAt, statusHistory: [{ status: newGoalData.status, timestamp: created.createdAt, note: 'Goal created' }] };
        setGoals(prev => [...prev, saved]); setSelectedGoalId(saved.id); setActiveView('goals'); setIsCreateGoalOpen(false); showToast(`Meaningful Goal "${saved.title}" created.`, 'success');
      }).then(() => true).catch(error => { showToast(error instanceof Error ? error.message : 'Goal could not be saved.', 'warning'); return false; });
    }
    const newGoal: Goal = {
      ...newGoalData,
      id: 'goal-' + Date.now(),
      isPrimary: goals.length === 0,
      createdAt: new Date().toISOString(),
      statusHistory: [
        {
          status: newGoalData.status,
          timestamp: new Date().toISOString(),
          note: 'Goal created',
        },
      ],
    };
    setGoals(prev => [...prev, newGoal]);
    setSelectedGoalId(newGoal.id);
    logEvent('GOAL_CREATED', { title: newGoal.title, category: newGoal.category });
    setIsCreateGoalOpen(false);
    showToast(`Meaningful Goal "${newGoal.title}" created.`, 'success');
    return true;
  };

  const updateGoalStatus = (goalId: string, newStatus: GoalStatus, note?: string) => {
    if (!isDemoMode) {
      const status = newStatus === 'Completed' ? 'COMPLETED' : newStatus === 'Paused' ? 'PAUSED' : 'ACTIVE';
      void domainApi.updateGoalStatus(goalId, status, note).then(() => setGoals(prev => prev.map(goal => goal.id === goalId ? { ...goal, status: newStatus, statusHistory: [...goal.statusHistory, { status: newStatus, timestamp: new Date().toISOString(), note }] } : goal))).catch(error => showToast(error instanceof Error ? error.message : 'Goal status could not be saved.', 'warning'));
      return;
    }
    setGoals(prev =>
      prev.map(g => {
        if (g.id === goalId) {
          return {
            ...g,
            status: newStatus,
            statusHistory: [
              ...g.statusHistory,
              { status: newStatus, timestamp: new Date().toISOString(), note },
            ],
          };
        }
        return g;
      })
    );
    showToast(`Goal status updated to ${newStatus}.`, 'info');
  };

  const setPrimaryGoal = (goalId: string) => {
    setGoals(prev =>
      prev.map(g => ({
        ...g,
        isPrimary: g.id === goalId,
      }))
    );
    showToast(isDemoMode ? 'Primary focus Goal updated.' : 'Focus selected for this visit.', 'info');
  };

  const createMilestone = async (goalId: string, title: string, targetDate: string) => {
    if (!isDemoMode) {
      const orderIndex = milestones.filter(item => item.goalId === goalId).length;
      return protectedPayload(goalId, 'milestone', goalId, { title }).then(privateFields => domainApi.createMilestone({ goalId, targetDate, orderIndex, ...privateFields })).then(saved => {
        setMilestones(prev => [...prev, { id: saved.id, goalId, title, targetDate: saved.targetDate, completed: Boolean(saved.isCompleted), order: saved.orderIndex + 1 }]);
        showToast(`Milestone "${title}" added.`, 'success');
      }).then(() => true).catch(error => { showToast(error instanceof Error ? error.message : 'Milestone could not be saved.', 'warning'); return false; });
    }
    const count = milestones.filter(m => m.goalId === goalId).length;
    const newMilestone: Milestone = {
      id: 'mile-' + Date.now(),
      goalId,
      title,
      targetDate,
      completed: false,
      order: count + 1,
    };
    setMilestones(prev => [...prev, newMilestone]);
    logEvent('MILESTONE_CREATED', { goalId, title });
    showToast(`Milestone "${title}" added.`, 'success');
    return true;
  };

  const toggleMilestone = (milestoneId: string) => {
    if (!isDemoMode) {
      const current = milestones.find(item => item.id === milestoneId);
      if (!current) return;
      void domainApi.updateMilestone(milestoneId, { isCompleted: !current.completed }).then(saved => setMilestones(prev => prev.map(item => item.id === milestoneId ? { ...item, completed: Boolean(saved.isCompleted) } : item))).catch(error => showToast(error instanceof Error ? error.message : 'Milestone could not be updated.', 'warning'));
      return;
    }
    setMilestones(prev =>
      prev.map(m => (m.id === milestoneId ? { ...m, completed: !m.completed } : m))
    );
  };

  const createActionItem = async (newActionData: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!isDemoMode) {
      return protectedPayload(newActionData.goalId, 'action', newActionData.goalId, { title: newActionData.title, description: newActionData.description }).then(privateFields => domainApi.createAction({ goalId: newActionData.goalId, milestoneId: newActionData.milestoneId, isNMA: newActionData.isNMA, scheduledDate: newActionData.dueDate, ...privateFields })).then(created => {
        const saved = { ...newActionData, id: created.id, createdAt: created.createdAt, updatedAt: created.updatedAt } as ActionItem;
        setActions(prev => saved.isNMA ? [saved, ...prev.map(action => action.goalId === saved.goalId ? { ...action, isNMA: false } : action)] : [saved, ...prev]);
        showToast(`Action "${saved.title}" created.`, 'success');
      }).then(() => true).catch(error => { showToast(error instanceof Error ? error.message : 'Action could not be saved.', 'warning'); return false; });
    }
    const newAction: ActionItem = {
      ...newActionData,
      id: 'act-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (newAction.isNMA) {
      // Unset previous NMAs for this goal
      setActions(prev => [
        newAction,
        ...prev.map(a => (a.goalId === newAction.goalId ? { ...a, isNMA: false } : a)),
      ]);
    } else {
      setActions(prev => [newAction, ...prev]);
    }

    logEvent('ACTION_CREATED', { isNMA: newAction.isNMA, title: newAction.title });
    showToast(`Action "${newAction.title}" created.`, 'success');
    return true;
  };

  const setAsNma = (actionId: string) => {
    const target = actions.find(a => a.id === actionId);
    if (!target) return;
    if (!isDemoMode) {
      void domainApi.designateNma(actionId).then(() => setActions(prev => prev.map(action => action.goalId === target.goalId ? { ...action, isNMA: action.id === actionId } : action))).catch(error => showToast(error instanceof Error ? error.message : 'NMA could not be saved.', 'warning'));
      return;
    }
    setActions(prev =>
      prev.map(a => {
        if (a.goalId === target.goalId) {
          return {
            ...a,
            isNMA: a.id === actionId,
          };
        }
        return a;
      })
    );
    showToast(`"${target.title}" is now the active Next Meaningful Action (NMA).`, 'info');
  };

  const startAction = (actionId: string) => {
    if (!isDemoMode) {
      void domainApi.updateActionStatus(actionId, 'IN_PROGRESS').then(() => setActions(prev => prev.map(action => action.id === actionId ? { ...action, status: 'In Progress' as ActionStatus, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : action))).catch(error => showToast(error instanceof Error ? error.message : 'Action status could not be saved.', 'warning'));
      return;
    }
    setActions(prev =>
      prev.map(a => {
        if (a.id === actionId) {
          return {
            ...a,
            status: 'In Progress' as ActionStatus,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
    logEvent('ACTION_STARTED', { actionId });
    showToast('Action started! Focus on completing this single step.', 'info');
  };

  const completeAction = (actionId: string) => {
    const target = actions.find(a => a.id === actionId);
    if (!isDemoMode) {
      void domainApi.updateActionStatus(actionId, 'COMPLETED').then(async () => {
        setActions(prev => prev.map(action => action.id === actionId ? { ...action, status: 'Completed' as ActionStatus, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : action));
        const goal = goals.find(item => item.id === target?.goalId);
        if (goal?.kpi?.id) {
          const nextValue = Math.min(goal.kpi.targetValue, goal.kpi.currentValue + 1);
          await domainApi.recordKpi(goal.kpi.id, { value: nextValue });
          setGoals(prev => prev.map(item => item.id === goal.id && item.kpi ? { ...item, kpi: { ...item.kpi, currentValue: nextValue } } : item));
          setProductionKpis(await domainApi.momentumKpis());
        }
      }).catch(error => showToast(error instanceof Error ? error.message : 'Action completion could not be saved.', 'warning'));
      return;
    }
    setActions(prev =>
      prev.map(a => {
        if (a.id === actionId) {
          return {
            ...a,
            status: 'Completed' as ActionStatus,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );

    // If goal has KPI, advance it
    if (target && target.goalId) {
      setGoals(prev =>
        prev.map(g => {
          if (g.id === target.goalId && g.kpi) {
            return {
              ...g,
              kpi: {
                ...g.kpi,
                currentValue: Math.min(g.kpi.targetValue, g.kpi.currentValue + 1),
              },
            };
          }
          return g;
        })
      );
      logEvent('KPI_UPDATED', { goalId: target.goalId });
    }

    setBarriers(prev =>
      prev.map(b => (b.actionId === actionId ? { ...b, resolved: true } : b))
    );

    logEvent('ACTION_COMPLETED', { actionId });
    showToast('Meaningful Action Completed! Ready to choose the next NMA.', 'success');
  };

  const rescheduleAction = async (actionId: string, newDate: string) => {
    if (!isDemoMode) {
      return domainApi.rescheduleAction(actionId, newDate).then(saved => setActions(prev => prev.map(item => item.id === actionId ? { ...item, dueDate: saved.scheduledDate, updatedAt: saved.updatedAt } : item))).then(() => true).catch(error => { showToast(error instanceof Error ? error.message : 'Action date could not be saved.', 'warning'); return false; });
    }
    setActions(prev =>
      prev.map(a => {
        if (a.id === actionId) {
          return {
            ...a,
            dueDate: newDate,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
    showToast('Action date rescheduled.', 'info');
    return true;
  };

  const applyIntervention = (actionId: string, interventionId: string) => {
    const targetIntervention = interventions.find(i => i.id === interventionId);
    if (!targetIntervention) return;

    if (!isDemoMode) {
      const action = actions.find(item => item.id === actionId);
      if (!action) return;
      const barrierId = barriers.find(item => item.actionId === actionId && !item.resolved)?.id;
      void protectedPayload(action.goalId, 'intervention', actionId, { outcomeNotes: `Applied intervention: ${targetIntervention.title}` }).then(privateFields => domainApi.applyIntervention(actionId, { interventionCode: targetIntervention.id, barrierId, ...privateFields })).then(() => {
        if (targetIntervention.suggestedActionType === 'mma') openMmaModal(actionId);
        else showToast(`Applied intervention: ${targetIntervention.title}`, 'success');
      }).catch(error => showToast(error instanceof Error ? error.message : 'Intervention could not be saved.', 'warning'));
      return;
    }

    if (targetIntervention.suggestedActionType === 'mma') {
      openMmaModal(actionId);
    } else {
      showToast(`Applied intervention: ${targetIntervention.title}`, 'success');
    }
    logEvent('INTERVENTION_SELECTED', { actionId, interventionId });
  };

  const toggleAcifCategory = (code: AcifCategoryCode) => {
    setAcifCategories(prev =>
      prev.map(c => (c.code === code ? { ...c, active: !c.active } : c))
    );
    showToast('ACIF taxonomy status updated in prototype.', 'info');
  };

  const updateNotifications = (settings: Partial<NotificationSettings>) => {
    if (!isDemoMode) { showToast('Notification preference editing is not available yet.', 'info'); return; }
    setNotifications(prev => ({ ...prev, ...settings }));
    showToast('Notification preferences updated.', 'info');
  };

  const resetDemoData = () => {
    if (!isDemoMode) {
      showToast('Demo reset is unavailable in production mode.', 'warning');
      return;
    }
    localStorage.removeItem('sopet_momentum_goals');
    localStorage.removeItem('sopet_momentum_milestones');
    localStorage.removeItem('sopet_momentum_actions');
    localStorage.removeItem('sopet_momentum_acif');
    localStorage.removeItem('sopet_momentum_lessons');
    localStorage.removeItem('sopet_momentum_restarts');
    localStorage.removeItem('sopet_momentum_barriers');
    localStorage.removeItem('sopet_momentum_reviews');
    localStorage.removeItem('sopet_momentum_notifications');
    localStorage.removeItem('sopet_momentum_analytics');

    setGoals(INITIAL_GOALS);
    setMilestones(INITIAL_MILESTONES);
    setActions(INITIAL_ACTIONS);
    setAcifCategories(ACIF_CATEGORIES);
    setLessons(INITIAL_LESSONS);
    setRestarts([]);
    setBarriers(INITIAL_BARRIERS);
    setWeeklyReviews(INITIAL_WEEKLY_REVIEWS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setAnalyticsEvents(INITIAL_ANALYTICS_EVENTS);
    setSelectedGoalId(null);
    setActiveView('today');
    showToast('Demo data reset to initial pilot state (Amina).', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        demoRole,
        setDemoRole,
        activeRole: isDemoMode ? demoRole : (canAccessAdministration(user) ? 'admin' : 'user'),
        setActiveRole: role => { if (isDemoMode) setDemoRole(role); },
        isAuthenticated,
        authStatus,
        authError, sessionExpired, pendingRequests, dataLoading, reloadData,
        setIsAuthenticated,
        user,

        goals,
        milestones,
        actions,
        acifCategories,
        interventions,
        lessons,
        restarts,
        barriers,
        weeklyReviews,
        kpis,
        pilotParticipants,
        notifications,
        analyticsEvents,
        knowledgeBase,
        promptTemplates,

        primaryGoal,
        activeNma,
        selectedGoalId,
        setSelectedGoalId,

        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,

        isOnboardingOpen,
        openOnboarding,
        closeOnboarding,

        isCreateGoalOpen,
        setIsCreateGoalOpen,

        isReadinessModalOpen,
        readinessTargetActionId,
        openReadinessCheck,
        closeReadinessCheck,
        submitReadinessCheck,

        isBarrierReviewOpen,
        barrierTargetActionId,
        openBarrierReview,
        closeBarrierReview,
        submitBarrierReview,

        isMmaModalOpen,
        mmaTargetActionId,
        openMmaModal,
        closeMmaModal,
        createMMA,
        startMMA,
        completeMMA,

        isRestartModalOpen,
        openRestartModal,
        closeRestartModal,
        submitRestartReview,

        isWeeklyReviewModalOpen,
        openWeeklyReviewModal,
        closeWeeklyReviewModal,
        isWeeklyReviewOpen: isWeeklyReviewModalOpen,
        openWeeklyReview: openWeeklyReviewModal,
        closeWeeklyReview: closeWeeklyReviewModal,
        submitWeeklyReview,

        isSettingsModalOpen,
        setIsSettingsModalOpen,

        createGoal,
        updateGoalStatus,
        setPrimaryGoal,
        createMilestone,
        toggleMilestone,
        createActionItem,
        setAsNma,
        startAction,
        completeAction,
        rescheduleAction,
        applyIntervention,
        toggleAcifCategory,
        updateNotifications,

        toasts,
        showToast,
        dismissToast,
        resetDemoData,
        logEvent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
