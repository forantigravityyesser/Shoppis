import { useSearchParams } from 'react-router';
import { useInventoryHome } from '../../../application/hooks/useInventory';
import ProductDraftEditor from '../components/ProductDraftEditor';
import { emptyFormValues } from '../components/product-form-values';
import '../inventory/inventory.css';

/**
 * Создание товара. Форма вынесена в ProductDraftEditor (сессия независимых черновиков)
 * и переиспользуется в EditProductView.
 * ADR-06.8: без вариантов доступно только «В архив».
 */
export default function CreateProductView() {
  const [params] = useSearchParams();
  const initialCategoryId = params.get('categoryId') ?? '';
  const { categories } = useInventoryHome();

  return (
    <div className="screen inv-form">
      <ProductDraftEditor
        headerTitle="Новый товар"
        categories={categories}
        initialValues={emptyFormValues(initialCategoryId || undefined)}
        mode="create"
        exitTo="/seller/inventory"
      />
    </div>
  );
}
