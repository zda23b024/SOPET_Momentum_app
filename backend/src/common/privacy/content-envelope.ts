import { BadRequestException } from '@nestjs/common';

export const PRIVATE_FIELDS = {
  goal: ['title', 'description', 'whyItMatters'],
  milestone: ['title', 'description'],
  action: ['title', 'description'],
  readiness: ['notes'],
  barrier: ['userExplanation'],
  intervention: ['outcomeNotes'],
  mma: ['title'],
  restart: ['causeDescription', 'whatChanged', 'rootCause', 'restartActionTitle'],
  kpi: ['name', 'unit', 'notes'],
  review: ['meaningfulProgress', 'actionsThatMattered', 'whatGotInTheWay', 'interventionsThatHelped', 'interventionsThatDidNotHelp', 'restartDetails', 'nextNmaTitle', 'extractedLesson', 'concreteAdjustment'],
  lesson: ['lessonText', 'adjustmentText'],
  adjustment: ['description'],
} as const;

export interface ClientEncryptedEnvelope {
  version: 1;
  algorithm: 'AES-256-GCM';
  keyVersion: number;
  iv: string;
  ciphertext: string;
  aadVersion: 1;
  schemaVersion: number;
}

export function validateEncryptedContent(body: Record<string, unknown>, privateFields: readonly string[]) {
  if (body.contentEncoding !== 'CLIENT_ENCRYPTED') return;
  const duplicated = privateFields.filter(field => body[field] !== undefined && body[field] !== null);
  if (duplicated.length || body.plaintextContent != null) {
    throw new BadRequestException({ code: 'PRIVACY_MODE_MISMATCH', message: 'Encrypted records cannot include plaintext private content.' });
  }
  const payload = body.encryptedPayload as Partial<ClientEncryptedEnvelope> | undefined;
  if (!payload || payload.version !== 1 || payload.algorithm !== 'AES-256-GCM' || payload.aadVersion !== 1 || !payload.iv || !payload.ciphertext || !payload.keyVersion || !payload.schemaVersion) {
    throw new BadRequestException({ code: 'INVALID_ENCRYPTED_PAYLOAD', message: 'A complete versioned encrypted payload is required.' });
  }
}

export function getEffectivePrivacyMode(goalMode: string, defaultMode = 'STANDARD_PRIVATE') {
  return goalMode || defaultMode;
}

export function assertNoPrivacyDowngrade(current: string, requested: string) {
  const rank: Record<string, number> = { STANDARD_PRIVATE: 0, ENCRYPTED_PRIVATE: 1, HIGHLY_CONFIDENTIAL: 2 };
  if ((rank[requested] ?? -1) < (rank[current] ?? -1)) {
    throw new BadRequestException({ code: 'PRIVACY_DOWNGRADE_NOT_IMPLEMENTED', message: 'Privacy downgrade is not yet implemented.' });
  }
}

