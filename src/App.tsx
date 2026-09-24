import { useStore } from './application/store';
import { useAppInit } from './application/hooks/useAppInit';
import AppRouter from './router';

/** Точка входа: init/resolve auth → роутер buyer/seller */
export default function App() {
  const isAppInitializing = useStore((s) => s.isAppInitializing);

  useAppInit();

  if (isAppInitializing) {
    return (
      <div style={styles.loader}>
        <div style={styles.spinner} />
      </div>
    );
  }

  return <AppRouter />;
}

const styles: Record<string, React.CSSProperties> = {
  loader: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg-app, #F0EDFF)',
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '4px solid var(--color-input-bg, #F2F2F7)',
    borderTop: '4px solid var(--color-accent, #6C5CE7)',
    animation: 'spin 0.8s linear infinite',
  },
};
