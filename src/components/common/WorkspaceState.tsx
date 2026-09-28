import React from 'react';
import { ShieldAlert, LoaderCircle } from 'lucide-react';
import { t } from '../../i18n/strings';

export function WorkspaceState({ title, description, onRetry, action, loading = false }: {
  title: string; description?: string; onRetry?: () => void; action?: React.ReactNode; loading?: boolean;
}) {
  return <section className="mx-auto my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 text-center shadow-sm" aria-live="polite" aria-busy={loading}>
    {loading ? <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#155A8A]" aria-hidden="true" /> : <ShieldAlert className="mx-auto h-8 w-8 text-[#155A8A]" aria-hidden="true" />}
    <h1 className="mt-4 text-xl font-bold text-[#0E3C5B]">{title}</h1>
    {description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>}
    {onRetry && <button className="primary-button mt-5" onClick={onRetry}>{t('retry')}</button>}
    {action && <div className="mt-5">{action}</div>}
  </section>;
}
