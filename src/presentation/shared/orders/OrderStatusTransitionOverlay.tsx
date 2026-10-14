import { useEffect, useRef, useState, type ComponentProps, type ComponentType } from 'react';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { Ban, CircleCheckBig, PackageCheck, PackageX, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Целевое состояние перехода продавца (DELIVERED — успех, RECEIVED — вручение). */
export type TransitionVisual = 'IN_TRANSIT' | 'DELIVERED' | 'RECEIVED' | 'CANCELLED' | 'REFUSED';

type IconComponent = ComponentType<ComponentProps<typeof Truck>>;

type TransitionLabelKey =
  | 'seller.orders.transition.inTransit'
  | 'seller.orders.transition.delivered'
  | 'seller.orders.transition.received'
  | 'seller.orders.transition.cancelled'
  | 'seller.orders.transition.refused';

interface VisualSpec {
  Icon: IconComponent;
  modifier: string;
  labelKey: TransitionLabelKey;
  initial: MotionProps['initial'];
  animate: MotionProps['animate'];
  transition: MotionProps['transition'];
}

/**
 * «Подпись» каждого перехода: иконка + направление движения. Только transform/
 * opacity (GPU), без тяжёлых библиотек — не утяжеляет бандл и не бьёт по FPS.
 */
const VISUALS: Record<TransitionVisual, VisualSpec> = {
  IN_TRANSIT: {
    Icon: Truck,
    modifier: 'order-transition--transit',
    labelKey: 'seller.orders.transition.inTransit',
    initial: { x: -32, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { type: 'spring', stiffness: 320, damping: 26 },
  },
  DELIVERED: {
    Icon: PackageCheck,
    modifier: 'order-transition--delivered',
    labelKey: 'seller.orders.transition.delivered',
    initial: { scale: 0.6, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: 'spring', stiffness: 360, damping: 22 },
  },
  RECEIVED: {
    Icon: CircleCheckBig,
    modifier: 'order-transition--received',
    labelKey: 'seller.orders.transition.received',
    initial: { scale: 0.5, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: 'spring', stiffness: 380, damping: 20 },
  },
  CANCELLED: {
    Icon: Ban,
    modifier: 'order-transition--cancelled',
    labelKey: 'seller.orders.transition.cancelled',
    initial: { scale: 1.15, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: 0.28, ease: 'easeOut' },
  },
  REFUSED: {
    Icon: PackageX,
    modifier: 'order-transition--refused',
    labelKey: 'seller.orders.transition.refused',
    initial: { x: 0, opacity: 0 },
    animate: { x: [0, -6, 6, -4, 4, 0], opacity: 1 },
    transition: { duration: 0.45, ease: 'easeInOut' },
  },
};

/** Минимальная выдержка подписи, чтобы анимация успела прочитаться. */
const MIN_VISIBLE_MS = 750;
/** Короткий фейд-аут перед сменой экрана. */
const EXIT_MS = 200;

interface Props {
  visual: TransitionVisual | null;
  /** Мутация ещё в полёте: ждём сервер, прежде чем уходить. */
  pending: boolean;
  /** Вызывается, когда анимация отыграна и мутация завершена. */
  onComplete: () => void;
}

/**
 * Полноэкранный оверлей смены статуса (docs/22 ORD-10). Играет «подпись» выбранного
 * перехода сразу при клике, а по завершении анимации и ответа сервера сообщает
 * `onComplete`, чтобы view ушёл в список заказов. Уважает `prefers-reduced-motion`.
 */
export default function OrderStatusTransitionOverlay({ visual, pending, onComplete }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [minElapsed, setMinElapsed] = useState(false);
  const firedRef = useRef(false);

  // onComplete читаем через ref: его смена не должна перезапускать exit-таймер.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // Минимальная выдержка подписи. Сброс на новый переход — через remount по `key`.
  useEffect(() => {
    if (!visual) return;
    const timer = window.setTimeout(() => setMinElapsed(true), reduce ? 120 : MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [visual, reduce]);

  // Оба условия монотонны в рамках перехода: выдержка сначала false → true,
  // pending true → false. Значит `exiting` безвозвратно становится true один раз.
  const exiting = Boolean(visual) && minElapsed && !pending;

  // Фейд-аут, затем отдаём управление view (ровно один раз).
  useEffect(() => {
    if (!visual || !exiting || firedRef.current) return;
    firedRef.current = true;
    const timer = window.setTimeout(onCompleteRef.current, reduce ? 60 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [visual, exiting, reduce]);

  if (!visual) return null;
  const spec = VISUALS[visual];

  return (
    <motion.div
      className={`order-transition ${spec.modifier}`}
      role="status"
      aria-live="polite"
      data-testid="order-transition"
      data-visual={visual}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: reduce ? 0.08 : 0.18 }}
    >
      {reduce ? null : <span className="order-transition__ring" aria-hidden />}
      <motion.span
        className="order-transition__icon"
        initial={reduce ? false : spec.initial}
        animate={spec.animate}
        transition={reduce ? { duration: 0 } : spec.transition}
        aria-hidden
      >
        <spec.Icon size={44} strokeWidth={2} />
      </motion.span>
      <span className="order-transition__label">{t(spec.labelKey)}</span>
    </motion.div>
  );
}
