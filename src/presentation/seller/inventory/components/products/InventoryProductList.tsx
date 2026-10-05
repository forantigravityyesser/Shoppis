import type { InventoryProductItem } from '../../../../../application/hooks/useInventory';
import InventoryProductRow from './InventoryProductRow';

interface InventoryProductListProps {
  products: InventoryProductItem[];
  onOpenProduct: (id: string) => void;
}

/** Масштабируемый список товаров (docs/19 §6.2, Phase D). */
export default function InventoryProductList({
  products,
  onOpenProduct,
}: InventoryProductListProps) {
  return (
    <div className="inv-products">
      {products.map((product) => (
        <InventoryProductRow
          key={product.id}
          product={product}
          onClick={() => onOpenProduct(product.id)}
        />
      ))}
    </div>
  );
}
