/**
 * Скелетон Каталога: заголовок, поиск, чипы, сетка. Без белого flash и layout
 * jump — блоки заменяются на месте. docs/13 §23.
 */
export default function CatalogSkeleton() {
  return (
    <div className="catalog" aria-hidden>
      <div className="skel skel--title" />
      <div className="skel skel--search" />
      <div className="catalog__skel-chips">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skel skel--chip" />
        ))}
      </div>
      <div className="product-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skel skel--card" />
        ))}
      </div>
    </div>
  );
}
