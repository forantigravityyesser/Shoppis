import { useTranslation } from 'react-i18next';
import { Eye, PackagePlus, Share2, Sparkles } from 'lucide-react';
import BottomSheet from '../../shared/components/BottomSheet';
import './tutorial.css';

interface Props {
  open: boolean;
  onStart: () => void;
  /** Явный отказ ИЛИ закрытие шита (backdrop/свайп) — по решению §8.8. */
  onDecline: () => void;
}

/**
 * Предложение пройти короткое обучение (docs/26 §4.1, TUT-04). Центрированная
 * карточка-приглашение: показывает ценность шагов, а не «инструкцию». Кнопки:
 * «Начать знакомство» (primary) и «Позже» (ghost). Закрытие по фону = «Позже»
 * (docs/26 §8.8): явных подтверждений нет, кнопки всегда видимы.
 */
export default function TutorialWelcomeSheet({ open, onStart, onDecline }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onDecline} variant="center">
      <div className="tutorial-welcome">
        <span className="tutorial-welcome__badge" aria-hidden>
          <Sparkles size={30} />
        </span>
        <h2 className="tutorial-welcome__title">{t('seller.tutorial.welcome.title')}</h2>
        <p className="tutorial-welcome__lead">{t('seller.tutorial.welcome.lead')}</p>
        <ul className="tutorial-welcome__points">
          <li className="tutorial-welcome__point">
            <PackagePlus className="tutorial-welcome__point-icon" size={20} aria-hidden />
            <span>{t('seller.tutorial.welcome.points.product')}</span>
          </li>
          <li className="tutorial-welcome__point">
            <Eye className="tutorial-welcome__point-icon" size={20} aria-hidden />
            <span>{t('seller.tutorial.welcome.points.preview')}</span>
          </li>
          <li className="tutorial-welcome__point">
            <Share2 className="tutorial-welcome__point-icon" size={20} aria-hidden />
            <span>{t('seller.tutorial.welcome.points.share')}</span>
          </li>
        </ul>
        <div className="tutorial-sheet__actions">
          <button type="button" className="btn-ghost" onClick={onDecline}>
            {t('seller.tutorial.welcome.decline')}
          </button>
          <button type="button" className="btn-primary" onClick={onStart}>
            {t('seller.tutorial.welcome.start')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
