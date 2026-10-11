import { useRef } from 'react';
import BackButton from '../../../shared/components/BackButton';
import { useStuck } from '../../../shared/hooks/useStuck';

/**
 * Header Inventory: кнопка «назад» + центрированный заголовок.
 * Поиск разнесён по секциям: в «Товарах» — инлайн-поиск; в «Категориях» поиска нет
 * (категорий не бывает настолько много). docs/19 Phase F.
 * «Назад» живёт в залипающем рейле: пока шапка видна — она в шапке, при скролле
 * залипает слева вверху и становится прозрачнее. Логика перехода не меняется.
 */
export default function InventoryHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const stuck = useStuck(headerRef);

  return (
    <>
      <div className="sticky-rail sticky-rail--start">
        <BackButton
          fallback="/seller/dashboard"
          className={stuck ? 'back-btn--floating' : undefined}
        />
      </div>
      <header className="inv-header" ref={headerRef}>
        <span className="inv-header__spacer" aria-hidden />
        <h1 className="inv-header__title">Инвентарь</h1>
        <span className="inv-header__spacer" aria-hidden />
      </header>
    </>
  );
}
