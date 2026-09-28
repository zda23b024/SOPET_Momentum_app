import type { PrivacyMode } from '../crypto/privacyTypes';

export interface AiConsentDetails {
  purpose: string;
  fieldsShared: string[];
  fieldsNotShared: string[];
  provider?: string;
  model?: string;
}

export interface AiConsentGrant extends AiConsentDetails {
  interactionId: string;
}

export type ConsentRequester = (details: AiConsentDetails) => Promise<AiConsentGrant | null>;
type Transport = (path: string, init: RequestInit) => Promise<unknown>;

const consumedGrants = new Set<string>();

export function createConsentGrant(details: AiConsentDetails): AiConsentGrant {
  return { ...details, interactionId: globalThis.crypto.randomUUID() };
}

export async function sendAiRequest<T>(options: {
  path: string;
  privacyMode: PrivacyMode;
  details: AiConsentDetails;
  payload: Record<string, unknown>;
  requestConsent: ConsentRequester;
  transport?: Transport;
}): Promise<T | null> {
  let consent: Partial<AiConsentGrant> = {};
  if (options.privacyMode !== 'STANDARD_PRIVATE') {
    const grant = await options.requestConsent(options.details);
    if (!grant) return null;
    if (consumedGrants.has(grant.interactionId)) throw new Error('AI_CONSENT_ALREADY_USED');
    consumedGrants.add(grant.interactionId);
    consent = {
      consent: true,
      purpose: grant.purpose,
      fieldsShared: grant.fieldsShared,
      consentInteractionId: grant.interactionId,
    } as Partial<AiConsentGrant>;
  }

  const transport = options.transport ?? (async (path: string, init: RequestInit) => {
    const { apiRequest } = await import('./http');
    return apiRequest(path, init);
  });
  return transport(options.path, {
    method: 'POST',
    body: JSON.stringify({ ...options.payload, ...consent }),
  }) as Promise<T>;
}
