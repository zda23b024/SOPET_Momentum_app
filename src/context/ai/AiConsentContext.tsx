import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { AiConsentDetails, AiConsentGrant, createConsentGrant } from '../../services/aiConsent';

type Resolver = (grant: AiConsentGrant | null) => void;
const Context = createContext<(details: AiConsentDetails) => Promise<AiConsentGrant | null>>(() => Promise.resolve(null));

export function useAiConsent() {
  return useContext(Context);
}

export const AiConsentProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [details, setDetails] = useState<AiConsentDetails | null>(null);
  const resolver = useRef<Resolver | null>(null);

  const requestConsent = (next: AiConsentDetails) => new Promise<AiConsentGrant | null>(resolve => {
    resolver.current?.(null);
    resolver.current = resolve;
    setDetails(next);
  });
  const finish = (grant: AiConsentGrant | null) => {
    resolver.current?.(grant);
    resolver.current = null;
    setDetails(null);
  };
  useEffect(() => {
    const cancel = () => { resolver.current?.(null); resolver.current = null; setDetails(null); };
    window.addEventListener('sopet:session-expired', cancel); window.addEventListener('sopet:vault-locked', cancel);
    return () => { window.removeEventListener('sopet:session-expired', cancel); window.removeEventListener('sopet:vault-locked', cancel); resolver.current?.(null); };
  }, []);

  return <Context.Provider value={requestConsent}>
    {children}
    {details && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between bg-[#0E3C5B] p-5 text-white">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5" /><div><h2 id="ai-consent-title" className="font-bold">Share with AI for this interaction?</h2><p className="mt-1 text-xs text-blue-100">Nothing is sent until you continue. This permission is used once.</p></div></div>
          <button type="button" onClick={() => finish(null)} aria-label="Cancel AI request"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-4 p-5 text-sm">
          <section><h3 className="font-semibold text-gray-900">Purpose</h3><p className="text-gray-700">{details.purpose}</p></section>
          <section><h3 className="font-semibold text-gray-900">Shared with AI</h3><ul className="list-disc pl-5 text-gray-700">{details.fieldsShared.map(field => <li key={field}>{field}</li>)}</ul></section>
          <section><h3 className="font-semibold text-gray-900">Not shared</h3><ul className="list-disc pl-5 text-gray-700">{details.fieldsNotShared.map(field => <li key={field}>{field}</li>)}</ul></section>
          <section><h3 className="font-semibold text-gray-900">Provider and model</h3><p className="text-gray-700">{details.provider ?? 'Configured AI provider'} / {details.model ?? 'Configured model'}</p></section>
        </div>
        <footer className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" onClick={() => finish(null)} className="px-4 py-2 font-medium text-gray-700">Cancel</button>
          <button type="button" onClick={() => finish(createConsentGrant(details))} className="rounded-lg bg-[#155A8A] px-4 py-2 font-semibold text-white">Continue</button>
        </footer>
      </div>
    </div>}
  </Context.Provider>;
};
