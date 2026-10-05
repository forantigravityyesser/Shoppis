/** Skeleton Home: полноширинные строки категорий (docs/19 Phase E). */
export default function InventorySkeleton() {
  return (
    <div className="inv-cat-list" aria-hidden>
      {Array.from({ length: 3 }, (_, index) => (
        <div className="inv-cat-row" key={index}>
          <div className="inv-skel inv-skel--wide skeleton" />
        </div>
      ))}
    </div>
  );
}
