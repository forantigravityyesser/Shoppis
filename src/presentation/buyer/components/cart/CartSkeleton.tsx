/**
 * Скелетон корзины на время первичной реконсиляции (docs/18 §33): фон/шапка/лист
 * как у Home, каркас карточек на месте списка — без белого flash и layout jump.
 */
export default function CartSkeleton() {
  return (
    <div className="home" aria-hidden data-testid="cart-skeleton">
      <div className="catalog-header">
        <div className="catalog-header__left">
          <div className="skel skel--btn" />
        </div>
        <div className="skel catalog-skel-title" />
        <div className="catalog-header__actions">
          <div className="skel skel--btn" />
        </div>
      </div>
      <div className="home-sheet cart-sheet">
        <div className="cart-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="cart-item">
              <div className="cart-item__row">
                <div className="skel cart-skel-select" />
                <div className="skel cart-skel-media" />
                <div className="cart-item__info">
                  <div className="skel cart-skel-title" />
                  <div className="skel cart-skel-variant" />
                  <div className="skel cart-skel-price" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
