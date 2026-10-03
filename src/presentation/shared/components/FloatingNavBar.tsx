import { Heart, Home, LayoutGrid, Package, ShoppingCart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import BottomNavBar, { type NavTab } from './BottomNavBar';
import { useHaptic } from '../../../application/hooks/useHaptic';

/** Вкладки покупателя: Home · Catalog · Favorites · Orders · Cart. docs/13 §1, §3. */
const TABS: NavTab[] = [
  { id: '/', icon: Home, label: 'Главная' },
  { id: '/catalog', icon: LayoutGrid, label: 'Каталог' },
  { id: '/favorites', icon: Heart, label: 'Избранное' },
  { id: '/orders', icon: Package, label: 'Заказы' },
  { id: '/cart', icon: ShoppingCart, label: 'Корзина' },
];

/** Активная вкладка по pathname; `/` — только точное совпадение. */
function resolveActive(pathname: string): string {
  if (pathname === '/') return '/';
  const tab = TABS.find(
    (t) => t.id !== '/' && (pathname === t.id || pathname.startsWith(`${t.id}/`)),
  );
  return tab?.id ?? '';
}

/**
 * Адаптер маршрутов покупателя к переиспользуемому BottomNavBar (тот же бар,
 * что у продавца, только 5 вкладок): Home · Catalog · Favorites · Orders · Cart.
 */
export default function FloatingNavBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { selectTick } = useHaptic();
  const active = resolveActive(pathname);

  const handleChange = (id: string) => {
    if (id === active) return;
    selectTick();
    navigate(id);
  };

  return <BottomNavBar tabs={TABS} activeTab={active} onTabChange={handleChange} />;
}
