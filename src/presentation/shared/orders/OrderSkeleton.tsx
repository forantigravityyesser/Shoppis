interface Props {
  variant?: 'list' | 'detail';
  /** Кол-во карточек-заглушек для списка. */
  count?: number;
}

/**
 * Скелетон загрузки списка/деталей (docs/22 §5.7) — без layout shift.
 * Визуальные блоки `aria-hidden`; для screen reader объявляется live-статус
 * «Загрузка заказов» (docs/24 §2.7 D9 / ORD-HARDEN-10).
 */
export default function OrderSkeleton({ variant = 'list', count = 3 }: Props) {
  if (variant === 'detail') {
    return (
      <div className="order-skeleton" data-testid="order-skeleton" role="status">
        <span className="sr-only">Загрузка заказа…</span>
        <div className="order-skeleton__block order-skeleton__block--head" aria-hidden />
        <div className="order-skeleton__block" aria-hidden>
          <div className="order-skeleton__line" />
          <div className="order-skeleton__line order-skeleton__line--short" />
        </div>
        <div className="order-skeleton__block" aria-hidden>
          <div className="order-skeleton__line" />
          <div className="order-skeleton__line" />
          <div className="order-skeleton__line order-skeleton__line--short" />
        </div>
      </div>
    );
  }

  return (
    <div className="order-skeleton" data-testid="order-skeleton" role="status">
      <span className="sr-only">Загрузка заказов…</span>
      {Array.from({ length: Math.max(1, count) }).map((_, index) => (
        <div className="order-skeleton__block" key={index} aria-hidden>
          <div className="order-skeleton__line" />
          <div className="order-skeleton__line order-skeleton__line--short" />
        </div>
      ))}
    </div>
  );
}
