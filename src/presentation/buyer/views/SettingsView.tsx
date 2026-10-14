import { useTranslation } from 'react-i18next';

/** SettingsView for buyer - placeholder page */
export default function SettingsView() {
  const { t } = useTranslation();
  return (
    <div style={styles.container}>
      <h2>{t('buyer.settings.title')}</h2>
      <p>{t('buyer.settings.hint')}</p>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'var(--color-bg-app, #F0EDFF)',
  },
};
