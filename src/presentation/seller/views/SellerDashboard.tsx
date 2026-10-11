import { useNavigate } from 'react-router';
import { useStore } from '../../../application/store';

/**
 * Операционная панель продавца. Профиль и параметры магазина — в Настройках.
 * Блок «Заказы» ведёт в список заказов; остальные блоки — каркас без API.
 */
export default function SellerDashboard() {
  const navigate = useNavigate();
  const currentStore = useStore((s) => s.currentStore);

  return (
    <div className="screen">
      <div className="screen__header">
        <h1 className="screen__title">Главная</h1>
        {currentStore ? <p className="screen__subtitle">{currentStore.name}</p> : null}
      </div>

      <Block title="Продажи" hint="Выручка и динамика — следующий этап" />
      <Block
        title="Заказы"
        hint="Новые и активные заказы"
        onClick={() => navigate('/seller/orders')}
      />
      <Block title="Инвентарь" hint="Остатки и позиции к пополнению — следующий этап" />
      <Block title="Требует внимания" hint="Здесь появятся задачи, требующие действия" />
    </div>
  );
}

function Block({ title, hint, onClick }: { title: string; hint: string; onClick?: () => void }) {
  const content = (
    <>
      <div className="card__title">{title}</div>
      <div className="card__muted">{hint}</div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="card" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <section className="card">{content}</section>;
}
