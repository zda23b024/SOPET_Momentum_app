import { ForbiddenException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiInteractionAuditService } from './ai-interaction-audit.service';

function setup() {
  const receipts = new Set<string>();
  const prisma: any = {
    isConnected: true,
    goal: { findFirst: jest.fn().mockResolvedValue({ privacyMode: 'HIGHLY_CONFIDENTIAL' }) },
    aIConsentReceipt: { create: jest.fn(async ({ data }: any) => { if (receipts.has(data.id)) throw new Error('unique'); receipts.add(data.id); return data; }) },
  };
  const provider: any = { diagnoseBarrier: jest.fn().mockResolvedValue({ suggestedCategoryCode: 'OVERWHELM' }) };
  const audit: any = { recordInteraction: jest.fn() };
  const service = new AiService(provider, { getBarrierDiagnosisSystemPrompt: () => 'system' } as any, { getAcifContext: async () => 'taxonomy' } as any, { validateInputSafety: () => ({ isCrisis: false }) } as any, audit, prisma);
  return { service, provider, audit };
}

const request: any = { goalId: 'goal-1', actionTitle: 'Private action', userExplanation: 'raw private prompt' };
const consent = { consent: true, purpose: 'Classify barrier', fieldsShared: ['actionTitle', 'userExplanation'], consentInteractionId: 'consent-1' };

test('confidential AI request without consent is rejected', async () => {
  const { service, provider } = setup();
  await expect(service.diagnoseBarrier(request, 'user-1')).rejects.toBeInstanceOf(ForbiddenException);
  expect(provider.diagnoseBarrier).not.toHaveBeenCalled();
});

test('explicit consent succeeds, is single-use, and raw prompt is not audited', async () => {
  const { service, audit } = setup();
  await service.diagnoseBarrier({ ...request, ...consent }, 'user-1');
  expect(audit.recordInteraction).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(audit.recordInteraction.mock.calls[0][0])).not.toContain('raw private prompt');
  await expect(service.diagnoseBarrier({ ...request, ...consent }, 'user-1')).rejects.toMatchObject({ response: { code: 'AI_CONSENT_ALREADY_USED' } });
});

test('undeclared transmitted field is rejected', async () => {
  const { service } = setup();
  await expect(service.diagnoseBarrier({ ...request, ...consent, fieldsShared: ['actionTitle'] }, 'user-1')).rejects.toMatchObject({ response: { code: 'AI_CONSENT_REQUIRED' } });
});

test('audit persistence contains metadata, not private prompt content', async () => {
  const create = jest.fn();
  const audit = new AiInteractionAuditService({ isConnected: true, aIInteractionMetadata: { create } } as any);
  await audit.recordInteraction({ userId: 'user-1', useCase: 'BARRIER_DIAGNOSIS', modelName: 'model', promptVersion: '1', consent: true, fieldsShared: ['userExplanation'] });
  expect(JSON.stringify(create.mock.calls[0][0])).not.toContain('raw private prompt');
});
