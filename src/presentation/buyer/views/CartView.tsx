import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useBuyerCart } from '../../../application/hooks/useBuyerCart';
import { useCheckout } from '../../../application/hooks/useCheckout';
import { useStorefrontHome } from '../../../application/hooks/useStorefrontHome';
import { cartItemKey } from '../../../domain/rules/cart-rules';
import CatalogHeader from '../components/CatalogHeader';
import StoreStatusView from '../components/StoreStatusView';
import CartSelectionToolbar from '../components/cart/CartSelectionToolbar';
import CartItemCard from '../components/cart/CartItemCard';
import CartCheckoutBar from '../components/cart/CartCheckoutBar';
import CartEmptyState from '../components/cart/CartEmptyState';
import CartSkeleton from '../components/cart/CartSkeleton';
import CheckoutFormSheet from '../components/cart/checkout/CheckoutFormSheet';
import CheckoutSuccess from '../components/cart/checkout/CheckoutSuccess';
import '../home.css';
import '../catalog.css';
import '../cart.css';
import '../checkout.css';

/**
 * Корзина покупателя (docs/18). Визуал — от Home/Каталога/Избранного: тот же фон
 * `.home` + белый лист `.home-sheet`, та же шапка. Данные — из `useBuyerCart()`
 * (Cart + текущая публичная проекция + реконсиляция); экран логику не держит.
 *
 * Состояния (CART-04): skeleton при первичной реконсиляции; пусто; полный экран
 * ошибки, если проекция не пришла вовсе; inline-ошибка с сохранением списка, если
 * упал пере-запрос; недостаток стока («Уменьшить до N»); индикатор реконсиляции.
 * CTA заблокирован, пока корзина не готова к оформлению (docs/18 §22).
 *
 * Закрытый магазин: как Home/Каталог/Избранное — на паузе (или «не найден») экран
 * `StoreStatusView`, корзина недоступна. Открытыми остаются только Заказы.
 *
 * Checkout (CART-05): нижний CTA открывает форму (`useCheckout`), успех показывает
 * полноэкранный оверлей. Заказ/уведомления — не здесь, а в application/edge.
 */
export default function CartView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewedStore = useStore((s) => s.viewedStore);
  const serverUser = useStore((s) => s.serverUser);
  const publicId = viewedStore?.publicId ?? null;

  const { home, loading, error, notFound, refresh } = useStorefrontHome(publicId);
  // Закрытый магазин — не торговая поверхность: корзину не резолвим, пока не ACTIVE
  // (parity с Каталогом/Избранным; реконсиляция не трогает сохранённые позиции).
  const storeActive = home?.store.status === 'ACTIVE';
  const cart = useBuyerCart(publicId, storeActive);
  const checkout = useCheckout();
  // Один товар в состоянии подтверждения за раз (docs/18 §19).
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const currencySymbol = cart.store?.currencySymbol ?? '';

  const header = (
    <CatalogHeader
      title={t('buyer.cart.title')}
      buyerAvatarUrl={serverUser?.photoUrl ?? null}
      buyerName={serverUser?.firstName ?? ''}
      onProfile={() => navigate('/account')}
    />
  );

  const shell = (content: ReactNode) => (
    <div className="home">
      {header}
      <div className="home-sheet cart-sheet">{content}</div>
    </div>
  );

  const errorScreen = (
    <div className="catalog-error" role="alert">
      <p className="catalog-error__title">{t('buyer.cart.loadError')}</p>
      <p className="catalog-error__text">{t('buyer.catalog.loadErrorHint')}</p>
      <button
        type="button"
        className="home-retry"
        onClick={() => {
          refresh();
          cart.refresh();
        }}
      >
        {t('common.retry')}
      </button>
    </div>
  );

  // Таймаут просто скрывает модалку — остаёмся в корзине (ничего не перенаправляем).
  const dismissSuccess = () => {
    checkout.reset();
    setCheckoutOpen(false);
  };

  // Явная кнопка «Перейти к заказам» — единственный переход из окна успеха.
  const goToOrders = () => {
    dismissSuccess();
    navigate('/orders');
  };

  const checkoutSheet = (
    <CheckoutFormSheet
      open={checkoutOpen && checkout.status !== 'success'}
      recipient={checkout.recipient}
      validation={checkout.validation}
      status={checkout.status}
      error={checkout.error}
      supportHandle={viewedStore?.supportHandle ?? null}
      storeName={viewedStore?.name}
      onFieldChange={checkout.setField}
      onSubmit={() => {
        void checkout.submit();
      }}
      onClose={() => setCheckoutOpen(false)}
    />
  );

  const successOverlay =
    checkout.status === 'success' ? (
      <CheckoutSuccess
        order={checkout.lastOrder}
        notificationsGranted={checkout.notificationsGranted}
        notificationsPending={checkout.notificationsPending}
        currencySymbol={currencySymbol}
        onClose={goToOrders}
        onDismiss={dismissSuccess}
        onEnableNotifications={() => {
          void checkout.enableNotifications(checkout.lastOrder?.orderId);
        }}
        autoClose={checkout.notificationsGranted}
      />
    ) : null;

  // Экран + оверлеи: форма и успех рендерятся поверх любой ветки (успех очищает
  // корзину, поэтому оверлей должен жить и в пустой ветке).
  const page = (screen: ReactNode) => (
    <>
      {screen}
      {checkoutSheet}
      {successOverlay}
    </>
  );

  if (loading || cart.loading) {
    return page(<CartSkeleton />);
  }

  if (error) {
    return page(shell(errorScreen));
  }

  if (notFound || !home) {
    return <StoreStatusView variant="notFound" />;
  }

  // Закрытый/приостановленный магазин — та же отбивка, что на Home и в Каталоге:
  // покупка недоступна. Открытыми остаются только Заказы.
  if (home.store.status === 'PAUSED') {
    return (
      <StoreStatusView
        variant="paused"
        storeName={home.store.name}
        logoUrl={viewedStore?.logoUrl ?? null}
        supportHandle={viewedStore?.supportHandle}
      />
    );
  }

  if (cart.isEmpty) {
    return page(shell(<CartEmptyState onGoCatalog={() => navigate('/catalog')} />));
  }

  // Локальные позиции есть, но проекция не разрешилась (ошибка/недоступный магазин).
  // Реконсиляция, удалившая все ссылки, даёт `isEmpty`, а не эту ветку (docs/18 §10).
  if (!cart.resolved) {
    return page(shell(errorScreen));
  }

  const selectedItems = cart.items.filter((entry) => entry.item.selected);
  const total = selectedItems.reduce(
    (sum, entry) => sum + entry.view.unitPrice * entry.item.quantity,
    0,
  );
  const allSelected = cart.selectionState === 'all';

  return page(
    shell(
      <>
        {cart.error ? (
          <div className="cart-inline-error" role="alert" data-testid="cart-inline-error">
            <span className="cart-inline-error__text">{t('buyer.cart.inlineError')}</span>
            <button type="button" className="cart-inline-error__retry" onClick={cart.refresh}>
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        <CartSelectionToolbar
          selectedCount={selectedItems.length}
          allSelected={allSelected}
          onToggleAll={() => cart.toggleAllOrderable()}
          updating={cart.reconciling}
        />

        <div className="cart-list">
          {cart.items.map((entry) => {
            const { item } = entry;
            const key = cartItemKey(item.productId, item.productVariantId);
            return (
              <CartItemCard
                key={key}
                item={item}
                view={entry.view}
                orderable={entry.orderable}
                confirming={pendingRemoveKey === key}
                onToggleSelected={() => cart.toggleSelected(item.productId, item.productVariantId)}
                onQuantityChange={(quantity) =>
                  cart.updateQty(item.productId, item.productVariantId, quantity)
                }
                onFixQuantity={() =>
                  cart.updateQty(item.productId, item.productVariantId, entry.view.availableQuantity)
                }
                onRequestRemove={() => setPendingRemoveKey(key)}
                onCancelRemove={() => setPendingRemoveKey(null)}
                onConfirmRemove={() => {
                  cart.remove(item.productId, item.productVariantId);
                  setPendingRemoveKey(null);
                }}
                onOpenProduct={() => navigate(`/product/${item.productId}`)}
              />
            );
          })}
        </div>

        <CartCheckoutBar
          total={total}
          currencySymbol={currencySymbol}
          disabled={!cart.canCheckout}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </>,
    ),
  );
}
