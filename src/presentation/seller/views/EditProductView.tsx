import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useInventoryHome } from '../../../application/hooks/useInventory';
import { useProductDetail } from '../../../application/hooks/useProduct';
import { useSmartBack } from '../../shared/hooks/useSmartBack';
import ProductDraftEditor from '../components/ProductDraftEditor';
import { detailToFormValues } from '../components/product-form-values';
import '../inventory/inventory.css';

/**
 * Редактирование карточки: та же форма и сессия черновиков, что при создании,
 * с предзаполненными данными товара. Копирование создаёт независимый товар (docs/23 §3.2).
 */
export default function EditProductView() {
  const { t } = useTranslation();
  const { productId = '' } = useParams();
  const goBack = useSmartBack();
  const { categories } = useInventoryHome();
  const { product, loading } = useProductDetail(productId);

  if (!product) {
    return (
      <div className="screen inv-form">
        <div className="form-header form-header--center">
          <button
            type="button"
            className="inv-icon-btn"
            onClick={() => goBack('/seller/inventory')}
            aria-label={t('common.back')}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="form-header__title">{t('seller.product.editTitle')}</h1>
          <span className="form-header__spacer" aria-hidden />
        </div>
        <div className="card card__muted">
          {loading ? t('common.loading') : t('seller.product.notFound')}
        </div>
      </div>
    );
  }

  return (
    <div className="screen inv-form">
      <ProductDraftEditor
        key={product.id}
        headerTitle={t('seller.product.editTitle')}
        categories={categories}
        initialValues={detailToFormValues(product)}
        mode="edit"
        productId={product.id}
        exitTo={`/seller/inventory/product/${product.id}`}
        // После сохранения открываем карточку последнего сохранённого товара (сверка;
        // если сохранили копию — откроется именно её карточка).
        savedTo={(savedId) => `/seller/inventory/product/${savedId}`}
      />
    </div>
  );
}
