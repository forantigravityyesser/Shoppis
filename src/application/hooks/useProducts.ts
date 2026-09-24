import { useStore } from '../store';

export function useProducts() {
  const storeId = useStore((s) => s.storeId);
  const products = useStore((s) => s.products);
  const variants = useStore((s) => s.variants);
  const characteristics = useStore((s) => s.characteristics);
  const catalogLoading = useStore((s) => s.catalogLoading);
  const catalogError = useStore((s) => s.catalogError);
  const categories = useStore((s) => s.categories);
  const fetchCatalog = useStore((s) => s.fetchCatalog);
  const saveProduct = useStore((s) => s.saveProduct);
  const deleteProduct = useStore((s) => s.deleteProduct);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const addCategory = useStore((s) => s.addCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  return {
    storeId,
    products,
    variants,
    characteristics,
    catalogLoading,
    catalogError,
    categories,
    fetchCatalog,
    saveProduct,
    deleteProduct,
    fetchCategories,
    addCategory,
    removeCategory,
  };
}
