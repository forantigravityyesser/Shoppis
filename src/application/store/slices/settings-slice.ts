import type { StateCreator } from 'zustand';
import type { RecipientInfo } from '../../../domain/models/customer';
import type { AppLanguage } from '../../contracts/i18n';
import { deps } from '../../composition/container';
import type { RootStore } from '../index';

export interface UserSettings {
  language: AppLanguage;
}

export interface SettingsSlice {
  userSettings: UserSettings;
  defaultRecipient: RecipientInfo;
  setUserSettings: (patch: Partial<UserSettings>) => void;
  setDefaultRecipient: (recipient: RecipientInfo) => void;
  setLanguage: (lang: AppLanguage) => void;
}

const EMPTY_RECIPIENT: RecipientInfo = { name: '', phone: '', address: '' };

/**
 * Текущий язык интерфейса из i18n через контейнер. Устойчиво к порядку инициализации
 * модулей: в бандле store создаётся при импорте и может выполниться до
 * `configureDependencies()` (порядок чанков не гарантирован). Язык здесь — только
 * метаданные (UI читает i18n напрямую), поэтому при недоступном DI берём дефолт;
 * persist/`setLanguage` проставят актуальное значение позже.
 */
function detectAppLanguage(): AppLanguage {
  try {
    return deps().i18n.getAppLanguage();
  } catch {
    return 'ru';
  }
}

export const createSettingsSlice: StateCreator<RootStore, [], [], SettingsSlice> = (set) => ({
  userSettings: {
    language: detectAppLanguage(),
  },
  defaultRecipient: EMPTY_RECIPIENT,

  setUserSettings: (patch) => {
    if (patch.language) deps().i18n.setAppLanguage(patch.language);
    set((s) => ({ userSettings: { ...s.userSettings, ...patch } }));
  },

  setDefaultRecipient: (recipient) => set({ defaultRecipient: recipient }),

  setLanguage: (lang) => {
    deps().i18n.setAppLanguage(lang);
    set((s) => ({ userSettings: { ...s.userSettings, language: lang } }));
  },
});
