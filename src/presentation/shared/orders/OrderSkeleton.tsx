interface Props {
  variant?: 'list' | 'detail';
  /** Кол-во карточек-заглушек для списка. */
  count?: number;
}

/** Скелетон загрузки списка/деталей (docs/22 §5.7) — без layout shift. */
export default function OrderSkeleton({ variant = 'list', count = 3 }: Props) {
  if (variant === 'detail') {
    return (
      <div className="order-skeleton" data-testid="order-skeleton" aria-hidden>
        <div className="order-skeleton__block order-skeleton__block--head" />
        <div className="order-skeleton__block">
          <div className="order-skeleton__line" />
          <div className="order-skeleton__line order-skeleton__line--short" />
        </div>
        <div className="order-skeleton__block">
          <div className="order-skeleton__line" />
          <div className="order-skeleton__line" />
          <div className="order-skeleton__line order-skeleton__line--short" />
        </div>
      </div>
    );
  }

  return (
    <div className="order-skeleton" data-testid="order-skeleton" aria-hidden>
      {Array.from({ length: Math.max(1, count) }).map((_, index) => (
        <div className="order-skeleton__block" key={index}>
          <div className="order-skeleton__line" />
          <div className="order-skeleton__line order-skeleton__line--short" />
        </div>
      ))}
    </div>
  );
}
