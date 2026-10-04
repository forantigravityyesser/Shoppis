/**
 * Скелетон карточки товара: галерея + белый лист (название, цена, варианты,
 * контент). Без белого flash и layout jump. docs/14 §15.
 */
export default function ProductDetailSkeleton() {
  return (
    <div className="pd-root" aria-hidden data-testid="product-detail-skeleton">
      <div className="pd">
        <div className="skel pd-skel__media" />
        <div className="pd-skel__sheet">
          <div className="skel pd-skel__line" />
          <div className="skel pd-skel__line pd-skel__line--short" />
          <div className="pd-skel__thumbs">
            <div className="skel pd-skel__thumb" />
            <div className="skel pd-skel__thumb" />
            <div className="skel pd-skel__thumb" />
          </div>
          <div className="skel pd-skel__line" />
          <div className="skel pd-skel__line pd-skel__line--short" />
        </div>
      </div>
    </div>
  );
}
