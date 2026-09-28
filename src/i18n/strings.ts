// Published SOPET methodology stays in its approved language. Add reviewed Swahili
// translations here before enabling sw in the language selector.
export type Locale = 'en' | 'sw';
export const messages = {
  en: {
    brand: 'SOPET Momentum', tagline: 'The Soft Persona Tool',
    today: 'Today', goals: 'Goals', progress: 'Progress', review: 'Weekly Review',
    notifications: 'Notifications', settings: 'Settings', retry: 'Try again',
    loading: 'Loading your workspace…', emptyGoals: 'No Goals yet',
    createGoal: 'Create your first Goal', noData: 'No data yet',
    unavailable: 'We could not connect to SOPET Momentum. Please try again.',
    forbidden: 'You do not have access to this area.',
    expired: 'Your session has expired. Sign in again to continue.',
  },
  sw: {},
} as const;
export const t = (key: keyof typeof messages.en, locale: Locale = 'en'): string =>
  (messages[locale] as Partial<Record<keyof typeof messages.en, string>>)[key] ?? messages.en[key];
export const privacyLabels = {
  STANDARD_PRIVATE: 'Standard Private', ENCRYPTED_PRIVATE: 'Encrypted Private', HIGHLY_CONFIDENTIAL: 'Highly Confidential',
} as const;
