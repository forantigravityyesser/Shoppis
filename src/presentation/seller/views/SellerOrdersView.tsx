import PlaceholderScreen from '../../shared/components/PlaceholderScreen';

/** Заказы продавца: активные заказы и смена статусов. Каркас без API. */
export default function SellerOrdersView() {
  return (
    <PlaceholderScreen
      title="Заказы"
      backTo="/seller/dashboard"
      hint="Активные заказы и управление статусами появятся на следующем этапе"
    />
  );
}
