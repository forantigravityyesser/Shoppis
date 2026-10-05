/**
 * Скелетон Каталога: фон/шапка/лист как у Home, 8 карточек категорий, поиск, сетка.
 * docs/17 §4 (CAT-07c).
 */
export default function CatalogSkeleton() {
  return (
    <div className="home" aria-hidden>
      <div className="catalog-header">
        <div className="catalog-header__left">
          <div className="skel skel--btn" />
        </div>
        <div className="skel catalog-skel-title" />
        <div className="catalog-header__actions">
          <div className="skel skel--btn" />
        </div>
      </div>
      <div className="home-sheet catalog-sheet">
        <div className="catalog-cats">
          <div className="catalog-cats__head">
            <div className="skel catalog-arrow-skel" />
          </div>
          <div className="catalog-cats__grid">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="catalog-cat-skel">
                <div className="skel catalog-cat-skel__img" />
                <div className="skel catalog-cat-skel__name" />
              </div>
            ))}
          </div>
        </div>
        <div className="skel skel--search" />
        <div className="product-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skel skel--card" />
          ))}
        </div>
      </div>
    </div>
  );
}
