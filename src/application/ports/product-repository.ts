import type { Product, ProductStatus, Variant } from '../../domain/models/product';
import type {
  AddVariantInput,
  NewProductInput,
  ProductCatalog,
  UpdateProductPatch,
  VariantStockPatch,
} from '../contracts/product';

export interface ProductRepository {
  fetchCatalog(storeId: string): Promise<ProductCatalog>;
  addProduct(input: NewProductInput): Promise<Product>;
  updateProduct(id: string, patch: UpdateProductPatch): Promise<void>;
  updateVariantStock(variantId: string, patch: VariantStockPatch): Promise<void>;
  addVariantToProduct(productId: string, variant: AddVariantInput): Promise<Variant>;
  setProductStatus(id: string, status: ProductStatus): Promise<void>;
  deleteProduct(id: string): Promise<Array<{ storageKey: string; thumbStorageKey: string | null }>>;
}
