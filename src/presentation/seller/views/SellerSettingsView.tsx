import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Eye, Languages, Power, Send, Share2, Store as StoreIcon } from 'lucide-react';
import { useStore } from '../../../application/store';
import { useStorefrontLink } from '../../../application/hooks/useStorefrontLink';
import { useOpenTelegramLink } from '../../../application/hooks/useOpenTelegramLink';
import type { StoreStatus } from '../../../domain/models/store';
import BackButton from '../../shared/components/BackButton';
import LanguageSwitcher from '../../shared/components/LanguageSwitcher';
import SettingsRow from '../settings/components/SettingsRow';
import BlockSaveButton from '../settings/components/BlockSaveButton';

/**
 * Inline toggle статуса витрины (ACTIVE ↔ PAUSED) для Hub.
 * Draft живёт локально; сохранение — через существующий
 * `updateStoreStatus`. Пауза требует явного подтверждения.
 * Монтируется с `key={store.status}`, поэтому draft всегда
 * стартует из актуального стора без синхронизирующих эффектов.
 */
function HubStatusToggle({
  initialStatus,
  onSaveStatus,
}: {
  initialStatus: StoreStatus;
  onSaveStatus: (status: StoreStatus) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<StoreStatus>(initialStatus);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = status === 'ACTIVE';
  const isDirty = status !== initialStatus;

  const applyStatus = async (next: StoreStatus) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveStatus(next);
      setStatus(next);
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (saving) return;
    if (status === 'PAUSED') {
      setConfirming(true);
      return;
    }
    void applyStatus(status);
  };

  return (
    <>
      <SettingsRow
        title={t('seller.settings.status.active')}
        icon={Power}
        toggle={{
          checked: active,
          label: t('seller.settings.status.active'),
          disabled: saving,
          onChange: () => {
            setStatus(active ? 'PAUSED' : 'ACTIVE');
            setConfirming(false);
            setError(null);
          },
        }}
      />
      {error ? (
        <div role="alert" className="settings-error">
          {error}
        </div>
      ) : null}
      {confirming ? (
        <div className="settings-confirm">
          <span className="settings-confirm__text">{t('seller.settings.status.confirmText')}</span>
          <div className="settings-confirm__actions">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="settings-confirm__cancel"
              disabled={saving}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void applyStatus('PAUSED')}
              className="settings-confirm__danger"
              disabled={saving}
            >
              {saving ? t('seller.settings.status.pausing') : t('seller.settings.status.pause')}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: isDirty ? '0 16px 16px' : undefined }}>
          <BlockSaveButton visible={isDirty} saving={saving} onClick={save} />
        </div>
      )}
    </>
  );
}

/**
 * Settings Hub: категории настроек вместо длинных форм.
 * Сложные настройки живут на дочерних экранах, boolean-статус —
 * inline toggle, Share/Preview — действия без Save. 12 §hub.
 */
export default function SellerSettingsView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentStore = useStore((s) => s.currentStore);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);
  const updateStoreStatus = useStore((s) => s.updateStoreStatus);
  const authLoading = useStore((s) => s.authLoading);
  const storefrontUrl = useStorefrontLink(currentStore?.publicId ?? '');
  const openTelegramLink = useOpenTelegramLink();

  useEffect(() => {
    if (!currentStore) void fetchCurrentStore();
  }, [currentStore, fetchCurrentStore]);

  if (authLoading && !currentStore) {
    return (
      <div className="screen">
        <div className="screen__header screen__header--row screen__header--center">
          <BackButton fallback="/seller/dashboard" />
          <h1 className="screen__title">{t('seller.settings.title')}</h1>
        </div>
        <div className="card card__muted" style={{ textAlign: 'center' }}>
          {t('seller.settings.loading')}
        </div>
      </div>
    );
  }

  if (!currentStore) {
    return (
      <div className="screen">
        <div className="screen__header screen__header--row screen__header--center">
          <BackButton fallback="/seller/dashboard" />
          <h1 className="screen__title">{t('seller.settings.title')}</h1>
        </div>
        <div className="card card__muted" style={{ textAlign: 'center' }}>
          {t('seller.settings.notFound')}
        </div>
      </div>
    );
  }

  const languageLabel = t(`language.${currentStore.language}`);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/dashboard" />
        <h1 className="screen__title">{t('seller.settings.title')}</h1>
      </div>

      <div className="settings-group__label">{t('seller.settings.groupStore')}</div>
      <section className="settings-group" aria-label={t('seller.settings.groupStore')}>
        <SettingsRow
          title={t('seller.settings.rowProfile')}
          value={currentStore.name}
          icon={StoreIcon}
          onClick={() => navigate('/seller/settings/profile')}
        />
        <SettingsRow
          title={t('seller.settings.rowLocalization')}
          value={`${languageLabel} · ${currentStore.currencyCode}`}
          icon={Languages}
          onClick={() => navigate('/seller/settings/localization')}
        />
        <SettingsRow
          title={t('seller.settings.rowContacts')}
          value={
            currentStore.supportHandle
              ? `@${currentStore.supportHandle}`
              : t('seller.settings.valueNotSpecified')
          }
          icon={Send}
          onClick={() => navigate('/seller/settings/contact')}
        />
        <HubStatusToggle
          key={currentStore.status}
          initialStatus={currentStore.status}
          onSaveStatus={updateStoreStatus}
        />
      </section>

      <div className="settings-group__label">{t('seller.settings.groupBuyers')}</div>
      <section className="settings-group" aria-label={t('seller.settings.groupBuyers')}>
        <SettingsRow
          title={t('seller.settings.rowShare')}
          icon={Share2}
          onClick={() => navigate('/seller/settings/share')}
        />
        <SettingsRow
          title={t('seller.settings.rowPreview')}
          icon={Eye}
          action
          onClick={() => openTelegramLink(storefrontUrl)}
        />
      </section>

      <div className="settings-group__label">{t('seller.settings.groupInterface')}</div>
      <section className="settings-group" aria-label={t('seller.settings.groupInterface')}>
        <div style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-secondary, #8E8E93)',
              marginBottom: 10,
            }}
          >
            {t('language.label')}
          </div>
          <LanguageSwitcher />
        </div>
      </section>
    </div>
  );
}
