import type { ReactNode } from 'react';

interface ProductTabEmptyProps {
  icon: ReactNode;
  title: string;
  hint: string;
}

/** Пустое стеклянное состояние для вкладок товара (Отзывы / Вопросы / Витрина). */
export default function ProductTabEmpty({ icon, title, hint }: ProductTabEmptyProps) {
  return (
    <div className="glass inv-state prod-tab-empty">
      <div className="inv-state__icon" aria-hidden>
        {icon}
      </div>
      <p className="inv-state__title">{title}</p>
      <p className="inv-state__subtitle">{hint}</p>
    </div>
  );
}
