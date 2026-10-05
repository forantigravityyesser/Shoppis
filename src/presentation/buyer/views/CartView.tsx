import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../../../application/store';
import { useBuyerCart } from '../../../application/hooks/useBuyerCart';
import { useCheckout } from '../../../application/hooks/useCheckout';
import { cartItemKey } from '../../../domain/rules/cart-rules';
import CatalogHeader from '../components/CatalogHeader';
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
 * упал пере-запрос; пауза магазина; недостаток стока («Уменьшить до N»); индикатор
 * реконсиляции. CTA заблокирован, пока корзина не готова к оформлению (docs/18 §22).
 *
 * Checkout (CART-05): нижний CTA открывает форму (`useCheckout`), успех показывает
 * полноэкранный оверлей. Заказ/уведомления — не здесь, а в application/edge.
 */
export default function CartView() {
  const navigate = useNavigate();
  const viewedStore = useStore((s) => s.viewedStore);
  const serverUser = useStore((s) => s.serverUser);
  const publicId = viewedStore?.publicId ?? null;

  const cart = useBuyerCart(publicId);
  const checkout = useCheckout();
  // Один товар в состоянии подтверждения за раз (docs/18 §19).
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const currencySymbol = cart.store?.currencySymbol ?? '';

  const header = (
    <CatalogHeader
      title="Корзина"
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
      <p className="catalog-error__title">Не удалось загрузить корзину</p>
      <p className="catalog-error__text">Проверьте соединение и попробуйте снова.</p>
      <button type="button" className="home-retry" onClick={cart.refresh}>
        Повторить
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

  if (cart.loading) {
    return page(<CartSkeleton />);
  }

  if (cart.isEmpty) {
    return page(shell(<CartEmptyState onGoCatalog={() => navigate('/catalog')} />));
  }

  // Локальные позиции есть, но проекция не разрешилась (ошибка/недоступный магазин).
  if (cart.items.length === 0) {
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
        {cart.storePaused ? (
          <p className="cart-pause" role="status">
            Магазин временно недоступен для оформления заказов.
          </p>
        ) : null}

        {cart.error ? (
          <div className="cart-inline-error" role="alert" data-testid="cart-inline-error">
            <span className="cart-inline-error__text">Не удалось обновить корзину.</span>
            <button type="button" className="cart-inline-error__retry" onClick={cart.refresh}>
              Повторить
            </button>
          </div>
        ) : null}

        <CartSelectionToolbar
          selectedCount={selectedItems.length}
          allSelected={allSelected}
          onToggleAll={() => cart.setAllSelected(!allSelected)}
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
