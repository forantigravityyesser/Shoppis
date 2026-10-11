import { useEffect, useMemo, useState } from 'react';
import { useViewportSnapshot } from '../../../application/hooks/useViewportSnapshot';

/** Включение оверлея: `?debug=safe` / `#debug=safe` либо localStorage.safeDebug='1'. */
function isDebugEnabled(): boolean {
  try {
    const raw = `${window.location.search}&${window.location.hash.replace(/^#/, '')}`;
    if (new URLSearchParams(raw).get('debug') === 'safe') return true;
    return window.localStorage.getItem('safeDebug') === '1';
  } catch {
    return false;
  }
}

function readCssInset(name: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '0px';
  } catch {
    return '0px';
  }
}

function hasFullscreenClass(): boolean {
  try {
    return document.documentElement.classList.contains('tg-fullscreen');
  } catch {
    return false;
  }
}

/**
 * Отладочный оверлей safe-area/fullscreen (Phase 1).
 *
 * Показывает live-значения инсетов и высот Telegram и подсвечивает верхнюю/нижнюю
 * безопасные зоны. Рендерится только при `?debug=safe` или `localStorage.safeDebug='1'`,
 * иначе — `null` (никакого влияния на обычных пользователей).
 */
export default function SafeAreaDebug() {
  const enabled = useMemo(() => isDebugEnabled(), []);
  return enabled ? <SafeAreaDebugPanel /> : null;
}

function SafeAreaDebugPanel() {
  const snapshot = useViewportSnapshot();
  const [css, setCss] = useState(() => ({
    top: readCssInset('--safe-top'),
    bottom: readCssInset('--safe-bottom'),
    fallback: readCssInset('--tg-inset-top-fallback'),
    fullscreenClass: hasFullscreenClass(),
  }));

  useEffect(() => {
    const read = () =>
      setCss({
        top: readCssInset('--safe-top'),
        bottom: readCssInset('--safe-bottom'),
        fallback: readCssInset('--tg-inset-top-fallback'),
        fullscreenClass: hasFullscreenClass(),
      });
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, []);

  const rows: Array<[string, string | number]> = [
    ['fullscreen', String(snapshot.isFullscreen)],
    ['html.tg-fullscreen', String(css.fullscreenClass)],
    ['safe.top', snapshot.safeTop],
    ['safe.bottom', snapshot.safeBottom],
    ['content.top', snapshot.contentTop],
    ['content.bottom', snapshot.contentBottom],
    ['vp.height', snapshot.viewportHeight],
    ['vp.stable', snapshot.viewportStableHeight],
    ['--tg-inset-top-fallback', css.fallback],
    ['css --safe-top', css.top],
    ['css --safe-bottom', css.bottom],
    ['innerHeight', typeof window !== 'undefined' ? window.innerHeight : 0],
    [
      'vv.height',
      typeof window !== 'undefined' ? Math.round(window.visualViewport?.height ?? 0) : 0,
    ],
  ];

  return (
    <>
      <div style={{ ...styles.band, top: 0, height: 'var(--safe-top, 0px)' }}>
        <span style={styles.bandLabel}>safe-top</span>
      </div>
      <div
        style={{
          ...styles.band,
          bottom: 0,
          height: 'var(--safe-bottom, 0px)',
          background: 'rgba(16, 185, 129, 0.35)',
        }}
      >
        <span style={styles.bandLabel}>safe-bottom</span>
      </div>
      <div style={styles.panel}>
        <div style={styles.panelTitle}>safe-area debug</div>
        {rows.map(([key, value]) => (
          <div key={key} style={styles.row}>
            <span style={styles.key}>{key}</span>
            <span style={styles.value}>{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  band: {
    position: 'fixed',
    left: 0,
    right: 0,
    zIndex: 9998,
    background: 'rgba(234, 88, 12, 0.35)',
    pointerEvents: 'none',
  },
  bandLabel: {
    position: 'absolute',
    right: 4,
    top: 2,
    fontSize: 10,
    fontFamily: 'ui-monospace, monospace',
    color: '#7c2d12',
  },
  panel: {
    position: 'fixed',
    left: 8,
    bottom: 'calc(var(--safe-bottom, 0px) + 8px)',
    zIndex: 9999,
    minWidth: 172,
    padding: '6px 8px',
    borderRadius: 8,
    background: 'rgba(17, 24, 39, 0.86)',
    color: '#f9fafb',
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    lineHeight: 1.35,
    pointerEvents: 'auto',
  },
  panelTitle: {
    marginBottom: 4,
    fontWeight: 700,
    color: '#fbbf24',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  key: {
    color: '#93c5fd',
  },
  value: {
    fontVariantNumeric: 'tabular-nums',
  },
};
