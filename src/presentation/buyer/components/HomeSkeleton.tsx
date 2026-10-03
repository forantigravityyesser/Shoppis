/**
 * Скелетон Home под новый layout: шапка + белый лист (баннер, лента категорий,
 * сетка товаров). Без белого flash и layout jump — контент заменит блоки на месте.
 * docs/13 §23.
 */
export default function HomeSkeleton() {
  return (
    <div className="home-skel" aria-hidden>
      <div className="home-skel__header">
        <div className="skel skel--name" />
        <div className="home-skel__actions">
          <div className="skel skel--btn" />
          <div className="skel skel--btn" />
        </div>
      </div>
      <div className="home-skel__sheet">
        <div className="skel skel--banner" />
        <div className="home-skel__row">
          <div className="skel skel--cat" />
          <div className="skel skel--cat" />
          <div className="skel skel--cat" />
          <div className="skel skel--cat" />
        </div>
        <div className="home-skel__grid">
          <div className="skel skel--home-card" />
          <div className="skel skel--home-card" />
          <div className="skel skel--home-card" />
          <div className="skel skel--home-card" />
        </div>
      </div>
    </div>
  );
}
