import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import {
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from '../../../application/contracts/i18n';
import './language-switcher.css';

/** Флаги языков интерфейса. */
const FLAGS: Record<AppLanguage, string> = {
  ru: '🇷🇺',
  en: '🇬🇧',
};

/**
 * Переключатель языка интерфейса (AppLanguage). Меняет язык UI текущего
 * пользователя (продавец/покупатель) — не язык витрины (`store.language`).
 * Значение живёт в `userSettings.language`, смена мгновенная и персистится.
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const setLanguage = useStore((s) => s.setLanguage);
  // Активный язык берём из i18n (источник истины), а не из стора: `userSettings`
  // может быть инициализирован дефолтом до initI18n. `setLanguage` персистит выбор.
  const activeLanguage: AppLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'ru').startsWith(
    'en',
  )
    ? 'en'
    : 'ru';

  return (
    <div className="lang-switch" role="radiogroup" aria-label={t('language.label')}>
      {SUPPORTED_LANGUAGES.map((code) => {
        const active = activeLanguage === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            className={`lang-switch__btn${active ? ' lang-switch__btn--active' : ''}`}
            onClick={() => setLanguage(code)}
          >
            <span className="lang-switch__flag" aria-hidden>
              {FLAGS[code]}
            </span>
            <span className="lang-switch__label">{t(`language.${code}`)}</span>
            {active ? (
              <Check className="lang-switch__check" size={16} strokeWidth={3} aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
