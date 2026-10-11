import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useInventoryHome } from '../../../application/hooks/useInventory';
import { useProductDetail } from '../../../application/hooks/useProduct';
import ProductDraftEditor from '../components/ProductDraftEditor';
import { detailToFormValues } from '../components/product-form-values';
import '../inventory/inventory.css';

/**
 * Редактирование карточки: та же форма и сессия черновиков, что при создании,
 * с предзаполненными данными товара. Копирование создаёт независимый товар (docs/23 §3.2).
 */
export default function EditProductView() {
  const { productId = '' } = useParams();
  const navigate = useNavigate();
  const { categories } = useInventoryHome();
  const { product, loading } = useProductDetail(productId);

  if (!product) {
    return (
      <div className="screen inv-form">
        <div className="form-header form-header--center">
          <button
            type="button"
            className="inv-icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Назад"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="form-header__title">Редактировать товар</h1>
          <span className="form-header__spacer" aria-hidden />
        </div>
        <div className="card card__muted">{loading ? 'Загрузка…' : 'Товар не найден.'}</div>
      </div>
    );
  }

  return (
    <div className="screen inv-form">
      <ProductDraftEditor
        key={product.id}
        headerTitle="Редактировать товар"
        categories={categories}
        initialValues={detailToFormValues(product)}
        mode="edit"
        productId={product.id}
        exitTo={`/seller/inventory/product/${product.id}`}
      />
    </div>
  );
}
