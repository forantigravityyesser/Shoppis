import PlaceholderScreen from '../../shared/components/PlaceholderScreen';

/** Профиль покупателя. Открывается только из шапки (аватар справа вверху). docs/13 §4. */
export default function AccountView() {
  return <PlaceholderScreen title="Профиль" hint="Профиль появится на следующем этапе" backTo="/" />;
}
