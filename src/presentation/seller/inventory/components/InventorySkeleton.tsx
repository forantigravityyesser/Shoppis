/** Skeleton Home: полноширинные строки категорий (docs/19 Phase E). */
export default function InventorySkeleton() {
  return (
    <div className="inv-grid" aria-hidden>
      {Array.from({ length: 3 }, (_, index) => (
        <div className="inv-grid__row" key={index}>
          <div className="inv-skel inv-skel--wide skeleton" />
        </div>
      ))}
    </div>
  );
}
