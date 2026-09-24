/** SettingsView for buyer - placeholder page */
export default function SettingsView() {
  return (
    <div style={styles.container}>
      <h2>Настройки</h2>
      <p>Раздел настроек будет доступен после авторизации</p>
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