export interface AiConsentContext {
  goalId?: string;
  privacyMode?: 'STANDARD_PRIVATE' | 'ENCRYPTED_PRIVATE' | 'HIGHLY_CONFIDENTIAL';
  consent?: boolean;
  purpose?: string;
  fieldsShared?: string[];
  consentInteractionId?: string;
}

export interface BarrierDiagnosisRequest extends AiConsentContext {
  actionTitle: string;
  actionDescription?: string;
  userExplanation: string;
  readinessAnswers?: {
    clearlyUnderstood?: boolean;
    knowsHowToDo?: boolean;
    hasResources?: boolean;
    prerequisitesMet?: boolean;
    internalResistanceLow?: boolean;
  };
}

export interface BarrierDiagnosisResponse {
  suggestedCategoryCode: string;
  suggestedCategoryName: string;
  confidenceScore: number;
  diagnosticReasoning: string;
  discriminatingQuestion: string;
  recommendedIntervention: {
    code: string;
    name: string;
    instructions: string;
  };
}

export interface MmaGenerationRequest extends AiConsentContext {
  actionTitle: string;
  barrierCategoryCode: string;
  userExplanation?: string;
  targetMinutes?: number;
}

export interface MmaGenerationResponse {
  suggestedMmaTitle: string;
  timeframeMinutes: number;
  whyThisRestoresMomentum: string;
  parentActionPreservedNote: string;
}

export interface RestartGuidanceRequest extends AiConsentContext {
  goalTitle: string;
  interruptionType: string;
  causeDescription: string;
  daysElapsed?: number;
}

export interface RestartGuidanceResponse {
  recommendedDecision: 'RESUME' | 'ADJUST' | 'REDUCE_ACTION' | 'CHANGE_NMA' | 'PAUSE_GOAL';
  rationale: string;
  suggestedRestartActionTitle: string;
  mindsetReframing: string;
}

export interface SharpenNmaRequest extends AiConsentContext {
  draftTitle: string;
  goalTitle: string;
}

export interface SharpenNmaResponse {
  sharpenedNmaTitle: string;
  actionBoundary: string;
  estimatedMinutes: number;
  clarityAssessment: string;
}

export interface AiProviderAdapter {
  diagnoseBarrier(
    systemPrompt: string,
    context: string,
    req: BarrierDiagnosisRequest,
  ): Promise<BarrierDiagnosisResponse>;

  generateMma(
    systemPrompt: string,
    context: string,
    req: MmaGenerationRequest,
  ): Promise<MmaGenerationResponse>;

  suggestRestart(
    systemPrompt: string,
    context: string,
    req: RestartGuidanceRequest,
  ): Promise<RestartGuidanceResponse>;

  sharpenNma(
    systemPrompt: string,
    context: string,
    req: SharpenNmaRequest,
  ): Promise<SharpenNmaResponse>;
}
