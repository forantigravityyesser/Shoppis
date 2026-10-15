import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useSellerDashboard } from '../../../application/hooks/useSellerDashboard';
import { useSellerTutorial } from '../../../application/hooks/useSellerTutorial';
import { currencySymbol } from '../../../domain/constants/currencies';
import { computeShopReadiness } from '../../../domain/rules/readiness-rules';
import DashboardStoreHeader from '../dashboard/components/DashboardStoreHeader';
import DashboardChecklistBlock from '../dashboard/components/DashboardChecklistBlock';
import DashboardGrowthBlock from '../dashboard/components/DashboardGrowthBlock';
import DashboardSalesBlock from '../dashboard/components/DashboardSalesBlock';
import DashboardOrdersBlock from '../dashboard/components/DashboardOrdersBlock';
import DashboardInventoryBlock from '../dashboard/components/DashboardInventoryBlock';
import DashboardSkeleton from '../dashboard/components/DashboardSkeleton';
import DashboardError from '../dashboard/components/DashboardError';
import DashboardEmpty from '../dashboard/components/DashboardEmpty';
import TutorialWelcomeSheet from '../tutorial/TutorialWelcomeSheet';
import '../dashboard/dashboard.css';

/**
 * Операционная панель продавца (docs/25). Один серверный read (`useSellerDashboard`)
 * + состояния. Блоки: чек-лист подготовки (docs/26 §4.5, первым), Продажи/Заказы/Инвентарь.
 * Обучение (docs/26 §4.1): welcome-шит при первом входе + ручной запуск из чек-листа;
 * шаги/подсветка — глобальный `TutorialOverlay` в seller-shell.
 */
export default function SellerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentStore = useStore((s) => s.currentStore);
  const { summary, loading, error, disabledReason, refetch } = useSellerDashboard();
  const tutorial = useSellerTutorial();
  const [welcomeClosed, setWelcomeClosed] = useState(false);

  const symbol = currentStore
    ? currentStore.currencySymbol || currencySymbol(currentStore.currencyCode)
    : '';

  // Предложение обучения: только до первого решения и при наличии магазина (§4.1).
  const showWelcome = !!currentStore && tutorial.shouldOffer && !welcomeClosed;
  const startTutorial = async () => {
    setWelcomeClosed(true);
    try {
      await tutorial.accept();
    } catch {
      // Не удалось записать состояние — не оставляем тупик, возвращаем предложение.
      setWelcomeClosed(false);
    }
  };
  const declineTutorial = async () => {
    setWelcomeClosed(true);
    try {
      await tutorial.decline();
    } catch {
      setWelcomeClosed(false);
    }
  };
  const openTutorial = () => {
    void tutorial.accept();
  };

  // Ручной вход в чек-листе: после отказа — «Пройти обучение», в процессе — «Продолжить».
  const tutorialCta = tutorial.interrupted
    ? { label: t('seller.tutorial.resume'), onClick: openTutorial }
    : tutorial.state.welcomeDecision === 'declined' && tutorial.state.status === 'not_started'
      ? { label: t('seller.tutorial.start'), onClick: openTutorial }
      : undefined;

  // Готовность магазина (docs/26 §3.4): derived из `currentStore` + серверных counts.
  const readiness =
    summary && currentStore
      ? computeShopReadiness({
          storeName: currentStore.name ?? '',
          bannerUrl: currentStore.bannerUrl ?? '',
          description: currentStore.description ?? '',
          supportHandle: currentStore.supportHandle ?? '',
          buyerAvailableProducts: summary.inventory.buyerAvailableProducts,
          activeCategories: summary.inventory.activeCategories,
        })
      : null;

  const body = error ? (
    <DashboardError onRetry={refetch} />
  ) : loading ? (
    <DashboardSkeleton />
  ) : disabledReason ? (
    <DashboardEmpty
      title={t('seller.dashboard.empty.noStoreTitle')}
      text={t('seller.dashboard.empty.noStoreText')}
    />
  ) : !summary ? (
    <DashboardEmpty
      title={t('seller.dashboard.empty.noSummaryTitle')}
      text={t('seller.dashboard.empty.noSummaryText')}
    />
  ) : (
    <>
      {/* docs/26 §4.5: при готовности магазина (5/5) чек-лист убирается —
          «Развитие магазина» остаётся единственным блоком такого формата. */}
      {readiness && !readiness.preparationReady ? (
        <DashboardChecklistBlock tutorialCta={tutorialCta} readiness={readiness} />
      ) : null}
      <DashboardGrowthBlock
        growth={summary.growth}
        onShare={() => navigate('/seller/settings/share')}
      />
      <DashboardSalesBlock
        sales={summary.sales}
        currencySymbol={symbol}
        onOpen={() => navigate('/seller/sales')}
      />
      <DashboardOrdersBlock
        counts={summary.orders}
        onOpenAll={() => navigate('/seller/orders')}
        onOpenStatus={(filter) => navigate(`/seller/orders?status=${filter}`)}
      />
      <DashboardInventoryBlock
        inventory={summary.inventory}
        onOpenProducts={() => navigate('/seller/inventory')}
        onOpenCategories={() => navigate('/seller/inventory?mode=categories')}
      />
    </>
  );

  return (
    <div className="screen dash">
      {currentStore ? (
        <DashboardStoreHeader store={currentStore} />
      ) : (
        <div className="screen__header">
          <h1 className="screen__title">{t('seller.dashboard.title')}</h1>
        </div>
      )}
      {body}
      <TutorialWelcomeSheet
        open={showWelcome}
        onStart={startTutorial}
        onDecline={declineTutorial}
      />
    </div>
  );
}
