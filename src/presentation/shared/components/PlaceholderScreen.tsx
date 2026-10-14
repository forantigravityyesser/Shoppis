import { useTranslation } from 'react-i18next';
import BackButton from './BackButton';

interface PlaceholderScreenProps {
  title: string;
  hint?: string;
  /** Маршрут возврата, если в истории нет предыдущего перехода. */
  backTo?: string;
}

/** Каркас экрана-заглушки: заголовок + пояснение. Без API. */
export default function PlaceholderScreen({ title, hint, backTo }: PlaceholderScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="screen">
      <div className={`screen__header${backTo ? ' screen__header--row' : ''}`}>
        {backTo ? <BackButton fallback={backTo} /> : null}
        <h1 className="screen__title">{title}</h1>
      </div>
      <div className="card card__muted">{hint ?? t('common.comingSoon')}</div>
    </div>
  );
}
