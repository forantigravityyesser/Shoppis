import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useStore } from '../../../application/store';

/**
 * Лёгкий тост-фидбек приложения (например, «Добавлено в корзину»). Читает
 * сообщение из `UiSlice.toast` (текст + опциональная миниатюра), авто-скрывает
 * через 2с. Плавное появление/уход — PD-12. Монтируется в layout.
 */
export default function Toast() {
  const toast = useStore((s) => s.toast);
  const clearToast = useStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => clearToast(), 2000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          className="toast"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          {toast.imageUrl ? <img className="toast__thumb" src={toast.imageUrl} alt="" /> : null}
          <CheckCircle2 className="toast__icon" size={18} aria-hidden />
          <span className="toast__text">{toast.text}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
