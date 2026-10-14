import { useTranslation } from 'react-i18next';
import BackButton from '../../shared/components/BackButton';
import LanguageSwitcher from '../../shared/components/LanguageSwitcher';

/**
 * Профиль покупателя. Открывается из шапки (аватар справа вверху). docs/13 §4.
 * Пока содержит выбор языка интерфейса; остальные разделы — в следующих этапах.
 */
export default function AccountView() {
  const { t } = useTranslation();
  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/" />
        <h1 className="screen__title">{t('buyer.account.title')}</h1>
      </div>

      <section className="card">
        <div className="card__title">{t('language.label')}</div>
        <LanguageSwitcher />
      </section>

      <div className="card card__muted" style={{ textAlign: 'center' }}>
        {t('buyer.account.hint')}
      </div>
    </div>
  );
}
