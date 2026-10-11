import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { useStuck } from '../../../shared/hooks/useStuck';

interface InventorySectionHeadProps {
  title: string;
  onAdd: () => void;
  addLabel?: string;
}

/**
 * Шапка секции Inventory: заголовок + «+ Добавить». Кнопка живёт в залипающем рейле —
 * пока шапка видна, она в шапке; при скролле залипает справа вверху и становится
 * прозрачнее, а при прокрутке назад возвращается на место. Невидимый дубль кнопки
 * держит высоту/ширину шапки, пока сама кнопка уезжает в рейл.
 */
export default function InventorySectionHead({
  title,
  onAdd,
  addLabel = 'Добавить',
}: InventorySectionHeadProps) {
  const headRef = useRef<HTMLDivElement>(null);
  const stuck = useStuck(headRef);

  return (
    <>
      <div className="sticky-rail sticky-rail--end">
        <button
          type="button"
          className={`inv-add-btn inv-add-btn--header${stuck ? ' inv-add-btn--floating' : ''}`}
          onClick={onAdd}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>{addLabel}</span>
        </button>
      </div>
      <div className="inv-section__head" ref={headRef}>
        <h2 className="inv-section__title">{title}</h2>
        <span className="inv-add-btn inv-add-btn--header inv-add-btn--ghost" aria-hidden>
          <Plus size={16} strokeWidth={2.5} />
          <span>{addLabel}</span>
        </span>
      </div>
    </>
  );
}
