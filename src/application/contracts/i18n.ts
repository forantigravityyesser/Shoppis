export const SUPPORTED_LANGUAGES = ['ru', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
