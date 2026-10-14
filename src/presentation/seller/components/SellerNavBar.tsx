import { LayoutDashboard, Package, ClipboardList, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import BottomNavBar, { type NavTab } from '../../shared/components/BottomNavBar';
import { useHaptic } from '../../../application/hooks/useHaptic';

/** Активная вкладка по pathname; вложенный /seller/orders/history подсвечивает «Заказы». */
function resolveActive(pathname: string, tabs: NavTab[]): string {
  const byPrefix = tabs.find((t) => pathname === t.id || pathname.startsWith(`${t.id}/`));
  return byPrefix?.id ?? '/seller/dashboard';
}

/** Адаптер маршрутов продавца к переиспользуемому BottomNavBar. */
export default function SellerNavBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { selectTick } = useHaptic();

  const tabs: NavTab[] = [
    { id: '/seller/dashboard', icon: LayoutDashboard, label: t('nav.seller.dashboard') },
    { id: '/seller/inventory', icon: Package, label: t('nav.seller.inventory') },
    { id: '/seller/orders', icon: ClipboardList, label: t('nav.seller.orders') },
    { id: '/seller/settings', icon: Settings, label: t('nav.seller.settings') },
  ];
  const active = resolveActive(pathname, tabs);

  const handleChange = (id: string) => {
    if (id === active) return;
    selectTick();
    navigate(id);
  };

  return <BottomNavBar tabs={tabs} activeTab={active} onTabChange={handleChange} />;
}
