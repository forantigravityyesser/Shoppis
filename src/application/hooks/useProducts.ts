import { useStore } from '../store';

export function useProducts() {
  const storeId = useStore((s) => s.storeId);
  const products = useStore((s) => s.products);
  const variants = useStore((s) => s.variants);
  const inventories = useStore((s) => s.inventories);
  const images = useStore((s) => s.images);
  const attributes = useStore((s) => s.attributes);
  const linkAttributes = useStore((s) => s.linkAttributes);
  const catalogLoading = useStore((s) => s.catalogLoading);
  const catalogError = useStore((s) => s.catalogError);
  const categories = useStore((s) => s.categories);
  const fetchCatalog = useStore((s) => s.fetchCatalog);
  const saveProduct = useStore((s) => s.saveProduct);
  const archiveProduct = useStore((s) => s.archiveProduct);
  const restoreProduct = useStore((s) => s.restoreProduct);
  const deleteProduct = useStore((s) => s.deleteProduct);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const addCategory = useStore((s) => s.addCategory);
  const archiveCategory = useStore((s) => s.archiveCategory);
  return {
    storeId,
    products,
    variants,
    inventories,
    images,
    attributes,
    linkAttributes,
    catalogLoading,
    catalogError,
    categories,
    fetchCatalog,
    saveProduct,
    archiveProduct,
    restoreProduct,
    deleteProduct,
    fetchCategories,
    addCategory,
    archiveCategory,
  };
}
