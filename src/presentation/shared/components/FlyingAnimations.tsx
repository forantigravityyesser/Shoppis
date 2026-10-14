import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../../application/store';
import type { FlyingDot } from '../../../application/store/slices/ui-slice';

/** Размеры «малюсенькой карточки», летящей в таб навигации. */
const CARD_W = 26;
const CARD_H = 34;
/** Длительность полёта (подсчитана как 2× от быстрого варианта). */
const DURATION = 1.32;
/** Чем больше точек, тем плавнее дуга по кривой. */
const ARC_SAMPLES = 24;

/**
 * Точки траектории полёта по квадратичной кривой Безье: старт у сердца,
 * выраженная дуга вверх-в сторону, финиш в таб навигации.
 */
function arcPath(startX: number, startY: number, endX: number, endY: number) {
  const dist = Math.hypot(endX - startX, endY - startY);
  // Дуга тем выше, чем длиннее путь (но с потолком, чтобы не улетать за экран).
  const lift = Math.min(170, dist * 0.55);
  // Контрольная точка: выше старта и смещена наружу от вертикали — «закид» вбок.
  const controlX = (startX + endX) / 2 + (endX - startX) * 0.35;
  const controlY = Math.min(startY, endY) - lift;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const t = i / ARC_SAMPLES;
    const mt = 1 - t;
    xs.push(mt * mt * startX + 2 * mt * t * controlX + t * t * endX);
    ys.push(mt * mt * startY + 2 * mt * t * controlY + t * t * endY);
  }
  return { xs, ys };
}

/** Центр вкладки нижней навигации в координатах вьюпорта (или null, если бара нет). */
function targetCenter(target: FlyingDot['target']): { x: number; y: number } | null {
  const path = target === 'favorites' ? '/favorites' : '/cart';
  const el = document.querySelector<HTMLElement>(`[data-nav-id="${path}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Одна летящая карточка: старт у сердца товара → дуга → финиш в таб навигации. */
function FlyingCard({ dot, onDone }: { dot: FlyingDot; onDone: () => void }) {
  const dest = useMemo(() => targetCenter(dot.target), [dot.target]);

  const startX = dot.x - CARD_W / 2;
  const startY = dot.y - CARD_H / 2;
  const endX = (dest?.x ?? dot.x) - CARD_W / 2;
  const endY = (dest?.y ?? dot.y + 120) - CARD_H / 2;

  const { xs, ys } = useMemo(
    () => arcPath(startX, startY, endX, endY),
    [startX, startY, endX, endY],
  );

  return (
    <motion.div
      className="fly-card"
      aria-hidden
      style={{ width: CARD_W, height: CARD_H }}
      initial={{ x: startX, y: startY, scale: 0.4, opacity: 0 }}
      animate={{ x: xs, y: ys, scale: [0.4, 1, 1, 0.5], opacity: [0, 1, 1, 0] }}
      transition={{
        x: { duration: DURATION, ease: 'linear' },
        y: { duration: DURATION, ease: 'linear' },
        scale: { duration: DURATION, ease: 'easeInOut', times: [0, 0.15, 0.85, 1] },
        opacity: { duration: DURATION, ease: 'easeInOut', times: [0, 0.12, 0.85, 1] },
      }}
      onAnimationComplete={onDone}
    >
      {dot.imageUrl ? (
        <img className="fly-card__img" src={dot.imageUrl} alt="" />
      ) : (
        <span className="fly-card__fallback" aria-hidden />
      )}
    </motion.div>
  );
}

/**
 * Слой «летящих» карточек (например, сердце → вкладка «Избранное»). Читает
 * очередь анимаций из `UiSlice.animations`, каждая карточка летит из точки,
 * где нажали сердце, к соответствующему табу нижней навигации, после чего
 * удаляется из очереди. Монтируется в `BuyerLayout`.
 */
export default function FlyingAnimations() {
  const animations = useStore((s) => s.animations);
  const dropAnimation = useStore((s) => s.dropAnimation);

  if (animations.length === 0) return null;

  return (
    <>
      {animations.map((dot) => (
        <FlyingCard key={dot.id} dot={dot} onDone={() => dropAnimation(dot.id)} />
      ))}
    </>
  );
}
