import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Вложенный sheet поверх уже открытого (например, добавление варианта из контроля остатков). */
  nested?: boolean;
  /** `bottom` — выезд снизу (по умолчанию); `center` — всплывающая карточка по центру экрана. */
  variant?: 'bottom' | 'center';
}

/** Модальный оверлей: затемнение + `bottom`-sheet со свайпом вниз либо центрированная карточка. */
export default function BottomSheet({
  open,
  onClose,
  children,
  nested = false,
  variant = 'bottom',
}: BottomSheetProps) {
  if (variant === 'center') {
    return createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            className={`sheet__overlay sheet__overlay--center${nested ? ' sheet__overlay--nested' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className={`sheet sheet--center${nested ? ' sheet--nested' : ''}`}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              onClick={(event) => event.stopPropagation()}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    );
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={`sheet__overlay${nested ? ' sheet__overlay--nested' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`sheet${nested ? ' sheet--nested' : ''}`}
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            <div className="sheet__handle" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
