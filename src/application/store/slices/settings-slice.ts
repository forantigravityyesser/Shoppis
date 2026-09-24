import type { StateCreator } from 'zustand';
import type { RecipientInfo } from '../../../domain/models/customer';
import type { StoreSettings } from '../../../domain/models/store';
import { getAppLanguage, setAppLanguage, type AppLanguage } from '../../../infrastructure/i18n/i18n';
import {
  fetchStoreSettings as fetchStoreSettingsRepo,
  updateStoreSettings as updateStoreSettingsRepo,
} from '../../../infrastructure/repositories/settings-repository';
import type { RootStore } from '../index';

export interface UserSettings {
  language: AppLanguage;
  notifications: boolean;
}

export interface SettingsSlice {
  storeSettings: StoreSettings | null;
  userSettings: UserSettings;
  defaultRecipient: RecipientInfo;
  settingsLoading: boolean;
  settingsError: string | null;
  fetchSettings: (storeId: string) => Promise<void>;
  saveSettings: (settings: StoreSettings) => Promise<void>;
  setUserSettings: (patch: Partial<UserSettings>) => void;
  setDefaultRecipient: (recipient: RecipientInfo) => void;
  setLanguage: (lang: AppLanguage) => void;
}

const EMPTY_RECIPIENT: RecipientInfo = { name: '', phone: '', address: '' };

export const createSettingsSlice: StateCreator<RootStore, [], [], SettingsSlice> = (set, get) => ({
  storeSettings: null,
  userSettings: { language: getAppLanguage(), notifications: true },
  defaultRecipient: EMPTY_RECIPIENT,
  settingsLoading: false,
  settingsError: null,

  fetchSettings: async (storeId: string) => {
    set({ settingsLoading: true, settingsError: null });
    try {
      set({ storeSettings: await fetchStoreSettingsRepo(storeId), settingsLoading: false });
    } catch (e) {
      set({ settingsLoading: false, settingsError: (e as Error).message });
      throw e;
    }
  },

  saveSettings: async (settings: StoreSettings) => {
    const { storeId } = get();
    if (!storeId) throw new Error('No store selected');
    set({ settingsLoading: true, settingsError: null });
    try {
      set({ storeSettings: await updateStoreSettingsRepo(storeId, settings), settingsLoading: false });
    } catch (e) {
      set({ settingsLoading: false, settingsError: (e as Error).message });
      throw e;
    }
  },

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
