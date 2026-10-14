import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const initialCategoryId = params.get('categoryId') ?? '';
  const { categories } = useInventoryHome();

  return (
    <div className="screen inv-form">
      <ProductDraftEditor
        headerTitle={t('seller.product.createTitle')}
        categories={categories}
        initialValues={emptyFormValues(initialCategoryId || undefined)}
        mode="create"
        exitTo="/seller/inventory"
        // После создания открываем карточку товара для сверки; «назад» оттуда — в инвентарь.
        savedTo={(productId) => `/seller/inventory/product/${productId}`}
      />
    </div>
  );
}
