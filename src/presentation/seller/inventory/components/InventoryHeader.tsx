import BackButton from '../../../shared/components/BackButton';

/**
 * Header Inventory: кнопка «назад» + центрированный заголовок.
 * Поиск разнесён по секциям: в «Товарах» — инлайн-поиск; в «Категориях» поиска нет
 * (категорий не бывает настолько много). docs/19 Phase F.
 */
export default function InventoryHeader() {
  return (
    <header className="inv-header">
      <BackButton fallback="/seller/dashboard" />
      <h1 className="inv-header__title">Инвентарь</h1>
      <span className="inv-header__spacer" aria-hidden />
    </header>
  );
}
