import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Вложенный sheet поверх уже открытого (например, добавление варианта из контроля остатков). */
  nested?: boolean;
}

/** Модальный bottom sheet: затемнение + выезд снизу, закрытие по свайпу вниз. */
export default function BottomSheet({ open, onClose, children, nested = false }: BottomSheetProps) {
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
