import { Heart, Home, LayoutGrid, Package, ShoppingCart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import BottomNavBar, { type NavTab } from './BottomNavBar';
import { useHaptic } from '../../../application/hooks/useHaptic';

/** Активная вкладка по pathname; `/` — только точное совпадение. */
function resolveActive(pathname: string, tabs: NavTab[]): string {
  if (pathname === '/') return '/';
  const tab = tabs.find(
    (t) => t.id !== '/' && (pathname === t.id || pathname.startsWith(`${t.id}/`)),
  );
  return tab?.id ?? '';
}

/**
 * Адаптер маршрутов покупателя к переиспользуемому BottomNavBar (тот же бар,
 * что у продавца, только 5 вкладок): Home · Catalog · Favorites · Orders · Cart.
 */
export default function FloatingNavBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { selectTick } = useHaptic();

  /** Вкладки покупателя: Home · Catalog · Favorites · Orders · Cart. docs/13 §1, §3. */
  const tabs: NavTab[] = [
    { id: '/', icon: Home, label: t('nav.buyer.home') },
    { id: '/catalog', icon: LayoutGrid, label: t('nav.buyer.catalog') },
    { id: '/favorites', icon: Heart, label: t('nav.buyer.favorites') },
    { id: '/orders', icon: Package, label: t('nav.buyer.orders') },
    { id: '/cart', icon: ShoppingCart, label: t('nav.buyer.cart') },
  ];

  const active = resolveActive(pathname, tabs);

  const handleChange = (id: string) => {
    if (id === active) return;
    selectTick();
    navigate(id);
  };

  return <BottomNavBar tabs={tabs} activeTab={active} onTabChange={handleChange} />;
}
