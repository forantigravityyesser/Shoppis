import { useStore } from '../../../application/store';

/**
 * Операционная панель продавца. Профиль и параметры магазина — в Настройках.
 * Пока каркас: блоки без API и расчётов.
 */
export default function SellerDashboard() {
  const currentStore = useStore((s) => s.currentStore);

  return (
    <div className="screen">
      <div className="screen__header">
        <h1 className="screen__title">Главная</h1>
        {currentStore ? <p className="screen__subtitle">{currentStore.name}</p> : null}
      </div>

      <Block title="Продажи" hint="Выручка и динамика — следующий этап" />
      <Block title="Заказы" hint="Новые и активные заказы — следующий этап" />
      <Block title="Склад" hint="Остатки и позиции к пополнению — следующий этап" />
      <Block title="Требует внимания" hint="Здесь появятся задачи, требующие действия" />
    </div>
  );
}

function Block({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="card">
      <div className="card__title">{title}</div>
      <div className="card__muted">{hint}</div>
    </section>
  );
}
