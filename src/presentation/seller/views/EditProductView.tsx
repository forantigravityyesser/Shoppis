import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useInventoryHome } from '../../../application/hooks/useInventory';
import { useInventoryActions } from '../../../application/hooks/useInventoryActions';
import { useProductDetail } from '../../../application/hooks/useProduct';
import ProductForm, { detailToFormValues } from '../components/ProductForm';
import '../inventory/inventory.css';

/** Редактирование карточки: та же форма, что при создании, с предзаполненными данными. */
export default function EditProductView() {
  const { productId = '' } = useParams();
  const navigate = useNavigate();
  const { categories } = useInventoryHome();
  const { product, loading } = useProductDetail(productId);
  const { updateProduct } = useInventoryActions();

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

      {!product ? (
        <div className="card card__muted">{loading ? 'Загрузка…' : 'Товар не найден.'}</div>
      ) : (
        <ProductForm
          categories={categories}
          initial={detailToFormValues(product)}
          onSubmit={async (payload) => {
            await updateProduct(product.id, payload);
            navigate(`/seller/inventory/product/${product.id}`);
          }}
        />
      )}
    </div>
  );
}
