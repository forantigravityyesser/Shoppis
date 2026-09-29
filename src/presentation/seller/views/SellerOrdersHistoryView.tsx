import PlaceholderScreen from '../../shared/components/PlaceholderScreen';

/** История заказов продавца. Каркас без API. */
export default function SellerOrdersHistoryView() {
  return (
    <PlaceholderScreen
      title="История заказов"
      backTo="/seller/orders"
      hint="Завершённые и отменённые заказы появятся на следующем этапе"
    />
  );
}
