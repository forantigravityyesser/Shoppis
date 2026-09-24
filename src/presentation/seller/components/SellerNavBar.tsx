import { LayoutDashboard, Package, ClipboardList, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import BottomNavBar, { type NavTab } from '../../shared/components/BottomNavBar';
import { selectTick } from '../../../infrastructure/telegram/telegram-haptic';

const TABS: NavTab[] = [
  { id: '/seller/dashboard', icon: LayoutDashboard, label: 'Главная' },
  { id: '/seller/inventory', icon: Package, label: 'Склад' },
  { id: '/seller/orders', icon: ClipboardList, label: 'Заказы' },
  { id: '/seller/settings', icon: Settings, label: 'Настройки' },
];

/** Активная вкладка по pathname; вложенный /seller/orders/history подсвечивает «Заказы». */
function resolveActive(pathname: string): string {
  const byPrefix = TABS.find((t) => pathname === t.id || pathname.startsWith(`${t.id}/`));
  return byPrefix?.id ?? '/seller/dashboard';
}

/** Адаптер маршрутов продавца к переиспользуемому BottomNavBar. */
export default function SellerNavBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = resolveActive(pathname);

  const handleChange = (id: string) => {
    if (id === active) return;
    selectTick();
    navigate(id);
  };

  return <BottomNavBar tabs={TABS} activeTab={active} onTabChange={handleChange} />;
}
