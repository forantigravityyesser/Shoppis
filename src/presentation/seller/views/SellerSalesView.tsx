import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSellerSales } from '../../../application/hooks/useSellerSales';
import { useOrdersRealtime } from '../../../application/hooks/useOrdersRealtime';
import { useStore } from '../../../application/store';
import { currencySymbol } from '../../../domain/constants/currencies';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import type { SalesGroup } from '../../../application/read-models/order';
import BackButton from '../../shared/components/BackButton';
import SectionSwitcher from '../../shared/components/SectionSwitcher';
import OrdersListBody from '../../shared/orders/OrdersListBody';
import '../../shared/components/section-switcher.css';
import '../../shared/orders/orders.css';

/** Разбор `?group=` в доменную группу; неизвестно/пусто → `earned` (первый раздел). */
function parseGroup(value: string | null): SalesGroup {
  return value === 'potential' ? 'potential' : 'earned';
}

/**
 * Экран «Продажи» продавца (docs/25 §4.3). Две отдельные секции с переключением
 * (как в Inventory): «Заработано» (зелёный) / «Потенциальные» (жёлтый). Карточки —
 * существующий `OrderCard` (цвет суммы через `priceTone`); клик → деталь заказа.
 * Раздел держим в URL (`?group=potential`), чтобы «назад» из детали возвращался в
 * тот же раздел.
 */
export default function SellerSalesView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useStore((s) => s.currentStore);
  const symbol = store ? store.currencySymbol || currencySymbol(store.currencyCode) : '';

  const group = parseGroup(searchParams.get('group'));
  const sales = useSellerSales({ group });

  // Новый заказ/смена статуса → инвалидация `['orders']` → списки продаж (docs/25 §3.4).
  useOrdersRealtime({ scope: 'seller' });

  const setGroup = (next: SalesGroup) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'earned') params.delete('group');
    else params.set('group', next);
    setSearchParams(params, { replace: true });
  };

  const groups: Array<{ value: SalesGroup; label: string }> = [
    { value: 'earned', label: t('seller.sales.groupEarned') },
    { value: 'potential', label: t('seller.sales.groupPotential') },
  ];
  const activeLabel = groups.find((g) => g.value === group)?.label ?? t('seller.sales.groupEarned');
  const open = (id: string) => navigate(`/seller/orders/${id}`);

  /** Текст неактивного запроса: отдельное состояние вместо ложного «продаж нет». */
  const disabled =
    sales.disabledReason === 'no-session'
      ? t('seller.sales.disabledNoSession')
      : sales.disabledReason
        ? t('seller.sales.disabledNoStore')
        : null;

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/dashboard" />
        <h1 className="screen__title">{t('seller.sales.title')}</h1>
        <span className="screen__header-spacer" aria-hidden />
      </div>

      <SectionSwitcher
        tabs={groups}
        value={group}
        onChange={setGroup}
        ariaLabel={t('seller.sales.switcherAria')}
      />

      <section className="sales-section" aria-label={activeLabel}>
        <div className="sales-section__head">
          <h2 className="sales-section__title">{activeLabel}</h2>
          <span
            className={`sales-section__sum sales-section__sum--${group}`}
            data-testid="sales-total"
          >
            {formatMoneyMinor(sales.totalMinor, symbol)}
          </span>
        </div>
        <OrdersListBody
          orders={sales.orders}
          loading={sales.loading}
          fetching={sales.fetching}
          error={sales.error}
          hasNextPage={sales.hasNextPage}
          emptyText={
            group === 'earned' ? t('seller.sales.emptyEarned') : t('seller.sales.emptyPotential')
          }
          priceTone={group}
          disabledText={disabled}
          onRetry={sales.refetch}
          onLoadMore={sales.fetchNextPage}
          onOpen={open}
        />
      </section>
    </div>
  );
}
