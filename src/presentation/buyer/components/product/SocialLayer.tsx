import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router';
import BackButton from '../../../shared/components/BackButton';
import { canGoBack } from '../../../shared/can-go-back';

interface Props {
  title: string;
  backTo: string;
  children: ReactNode;
}

/**
 * Общий слой соц-разделов карточки (Отзывы / Вопросы): fixed на весь экран,
 * собственный header с «назад» и заголовком, собственный скролл и safe-area.
 * Состояние карточки под слоем не перезагружается (shell остаётся смонтирован).
 * Рендерится через портал в `document.body`: иначе слой попадает в stacking
 * context `.pd__panel` (z-index 3) и миниатюры галереи (z-index 4) рисуются
 * поверх него.
 *
 * Анимация (PD-12): появление — выезд снизу; выход — по кнопке «назад» слой
 * уезжает вниз и только после анимации выполняется навигация (self-managed
 * exit; при reduced-motion — переход сразу). docs/14 §16.
 */
export default function SocialLayer({ title, backTo, children }: Props) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);

  const navigateBack = () => {
    if (canGoBack()) {
      navigate(-1);
    } else {
      navigate(backTo, { replace: true });
    }
  };

  const requestClose = () => {
    if (reduceMotion) {
      navigateBack();
      return;
    }
    setClosing(true);
  };

  // Вызывается по завершении и входной, и выходной анимации; навигация — только
  // когда мы уже закрываемся (иначе guard отсекает завершение появления).
  const handleAnimationComplete = () => {
    if (closing) navigateBack();
  };

  return createPortal(
    <motion.div
      className="pd-layer"
      initial={{ y: '100%' }}
      animate={{ y: closing ? '100%' : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      onAnimationComplete={handleAnimationComplete}
    >
      <header className="pd-layer__head">
        <BackButton fallback={backTo} onClick={requestClose} />
        <h2 className="pd-layer__title">{title}</h2>
        <span className="pd-layer__spacer" aria-hidden />
      </header>
      <div className="pd-layer__scroll">{children}</div>
    </motion.div>,
    document.body,
  );
}
