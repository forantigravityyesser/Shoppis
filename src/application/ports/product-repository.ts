import type { ProductStatus } from '../../domain/models/product';
import type {
  AddVariantInput,
  NewProductInput,
  ProductCatalog,
  UpdateProductPatch,
  VariantStockPatch,
} from '../contracts/product';

/**
 * Мутации каталога идут через edge-диспетчер catalog-actions и требуют серверную
 * сессию (`token`). При `token === null` (dev/anon без session) используется
 * прямой SDK-путь — см. infrastructure/repositories/product-repository.ts.
 */
export interface ProductRepository {
  fetchCatalog(storeId: string): Promise<ProductCatalog>;
  addProduct(input: NewProductInput, token: string | null): Promise<void>;
  updateProduct(id: string, patch: UpdateProductPatch, token: string | null): Promise<void>;
  updateVariantStock(variantId: string, patch: VariantStockPatch): Promise<void>;
  addVariantToProduct(
    productId: string,
    variant: AddVariantInput,
    token: string | null,
  ): Promise<void>;
  setProductStatus(id: string, status: ProductStatus, token: string | null): Promise<void>;
  deleteProduct(
    id: string,
    token: string | null,
  ): Promise<Array<{ storageKey: string; thumbStorageKey: string | null }>>;
  /** Связать товар с другим («Похожее»); двусторонне, без транзитивности. */
  linkProducts(productId: string, targetId: string, token: string | null): Promise<void>;
  /** Убрать связь товаров. */
  unlinkProducts(productId: string, targetId: string, token: string | null): Promise<void>;
}
