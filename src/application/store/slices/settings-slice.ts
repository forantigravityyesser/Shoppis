import type { StateCreator } from 'zustand';
import type { RecipientInfo } from '../../../domain/models/customer';
import { getAppLanguage, setAppLanguage, type AppLanguage } from '../../../infrastructure/i18n/i18n';
import type { RootStore } from '../index';

export interface UserSettings {
  language: AppLanguage;
  notifications: boolean;
}

export interface SettingsSlice {
  userSettings: UserSettings;
  defaultRecipient: RecipientInfo;
  setUserSettings: (patch: Partial<UserSettings>) => void;
  setDefaultRecipient: (recipient: RecipientInfo) => void;
  setLanguage: (lang: AppLanguage) => void;
}

const EMPTY_RECIPIENT: RecipientInfo = { name: '', phone: '', address: '' };

export const createSettingsSlice: StateCreator<RootStore, [], [], SettingsSlice> = (set) => ({
  userSettings: { language: getAppLanguage(), notifications: true },
  defaultRecipient: EMPTY_RECIPIENT,

  setUserSettings: (patch) => {
    if (patch.language) setAppLanguage(patch.language);
    set((s) => ({ userSettings: { ...s.userSettings, ...patch } }));
  },

  setDefaultRecipient: (recipient) => set({ defaultRecipient: recipient }),

  setLanguage: (lang) => {
    setAppLanguage(lang);
    set((s) => ({ userSettings: { ...s.userSettings, language: lang } }));
  },
});
