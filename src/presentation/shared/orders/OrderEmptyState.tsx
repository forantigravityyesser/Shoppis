import type { ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';

interface Props {
  text: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** Пустое состояние списка заказов (per-tab текст задаёт view, docs/22 §5.7/ORD-06). */
export default function OrderEmptyState({ text, icon, action }: Props) {
  return (
    <div className="order-empty" data-testid="order-empty">
      <span className="order-empty__icon" aria-hidden>
        {icon ?? <PackageOpen size={40} strokeWidth={1.5} />}
      </span>
      <p className="order-empty__text">{text}</p>
      {action ? <div className="order-empty__action">{action}</div> : null}
    </div>
  );
}
