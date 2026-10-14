import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  /** Публичное описание магазина (уже непустое). */
  description: string;
  onClose: () => void;
}

/**
 * Плавающая панель описания магазина на главной покупателя. Появляется поверх
 * баннера «выпадением» сверху (framer-motion), высота — по размеру текста
 * (max-height + внутренний скролл для длинного описания). Закрывается тапом по
 * фону или Escape. Позиционируется относительно `.home-sheet` (position: relative).
 */
export default function StoreDescriptionPopover({ open, description, onClose }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="store-about__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="store-about"
            role="dialog"
            aria-label={t('buyer.home.descriptionTitle')}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="store-about__title">{t('buyer.home.descriptionTitle')}</div>
            <p className="store-about__text">{description}</p>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
