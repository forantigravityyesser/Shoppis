import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { useInventoryHome } from '../../../application/hooks/useInventory';
import { useInventoryActions } from '../../../application/hooks/useInventoryActions';
import { UNCATEGORIZED_ID } from '../../../domain/constants/categories';
import ProductForm from '../components/ProductForm';
import '../inventory/inventory.css';

/**
 * Создание товара. Форма вынесена в ProductForm и переиспользуется в EditProductView.
 * ADR-06.8: без вариантов доступно только «В архив».
 */
export default function CreateProductView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialCategoryId = params.get('categoryId') ?? '';
  const { categories } = useInventoryHome();
  const { createProduct } = useInventoryActions();

  return (
    <div className="screen inv-form">
      <div className="form-header form-header--center">
        <button type="button" className="inv-icon-btn" onClick={() => navigate(-1)} aria-label="Назад">
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-header__title">Новый товар</h1>
        <span className="form-header__spacer" aria-hidden />
      </div>

      <ProductForm
        categories={categories}
        initial={{ categoryId: initialCategoryId || UNCATEGORIZED_ID }}
        onSubmit={createProduct}
      />
    </div>
  );
}
