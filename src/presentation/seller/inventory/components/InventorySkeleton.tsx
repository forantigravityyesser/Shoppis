/** Skeleton Home: повторяет реальную композицию wide/pair (спека §47). */
export default function InventorySkeleton() {
  return (
    <div className="inv-grid" aria-hidden>
      <div className="inv-grid__row inv-grid__row--pair">
        <div className="inv-skel inv-skel--compact skeleton" />
        <div className="inv-skel inv-skel--compact skeleton" />
      </div>
      <div className="inv-grid__row">
        <div className="inv-skel inv-skel--wide skeleton" />
      </div>
      <div className="inv-grid__row inv-grid__row--pair">
        <div className="inv-skel inv-skel--compact skeleton" />
        <div className="inv-skel inv-skel--compact skeleton" />
      </div>
    </div>
  );
}
