import { useTranslation } from 'react-i18next';

interface ScreenLoaderProps {
  /** Компактный вариант — для загрузки раздела внутри уже отрисованного экрана. */
  compact?: boolean;
  label?: string;
}

/**
 * Единый индикатор загрузки для Suspense-fallback при переходах на lazy-экраны:
 * центрированный спиннер вместо «пустого» экрана. При `compact` — для загрузки
 * вложенного раздела (shell/шапка остаются видимыми).
 */
export default function ScreenLoader({ compact, label }: ScreenLoaderProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`screen-loader${compact ? ' screen-loader--compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="loading-spinner" aria-hidden />
      <span className="screen-loader__label">{label ?? t('common.loading')}</span>
    </div>
  );
}
