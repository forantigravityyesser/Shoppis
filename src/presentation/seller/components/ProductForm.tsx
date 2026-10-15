import { useRef, useState } from 'react';
import { ImagePlus, ListTree, Plus, ShoppingBag, Type, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InventoryCategoryItem } from '../../../application/hooks/useInventory';
import ProductCategoryPicker from './ProductCategoryPicker';
import { uploadCatalogImages } from '../../../application/services/image-service';
import type { Characteristic, ProductFormValues } from './product-form-values';
import type {
  InventoryImageItem,
  ProductFormPayload,
} from '../../../application/read-models/inventory-view';
import {
  inheritVariantField,
  parseDiscountPercent,
  parsePriceMinor,
  setVariantDiscount,
  setVariantName,
  setVariantPrice,
  syncInherited,
  updateVariantField,
  validateVariantsForPublish,
  variantFromBase,
} from '../../../application/rules/variant-form';
import { MAX_IMAGES, MAX_VARIANTS } from '../../../domain/constants/limits';
import type { ProductStatus } from '../../../domain/models/product';

export type { ProductFormPayload };

export type { Characteristic, ProductFormValues } from './product-form-values';

interface ProductFormProps {
  categories: InventoryCategoryItem[];
  /** Управляемое значение формы (данные активного черновика). docs/23 §13.3 */
  value: ProductFormValues;
  onChange: (value: ProductFormValues) => void;
  onSubmit: (payload: ProductFormPayload) => Promise<void> | void;
  /**
   * Снятие фото пользователем. Вызывающий решает, нужно ли удалять файл из Storage:
   * загрузки этой сессии чистятся сразу, фото из БД — только после успешного сохранения.
   */
  onImageRemove?: (image: InventoryImageItem) => void;
  /** Ошибка последней операции сохранения этой карточки (из сессии черновиков). */
  submissionError?: string | null;
  /** Сохранение карточки в полёте (из сессии черновиков) — блокирует повторную отправку. */
  savePending?: boolean;
}

/**
 * Форма карточки товара: Фото → Основное (название/описание/категория) →
 * Характеристики → Варианты покупки. Управляемая: данные приходят через `value`,
 * изменения — через `onChange`, чтобы одна форма работала с выбранным черновиком
 * (docs/23 §13.3). Используется и при создании, и при редактировании.
 * ADR-06.8: без вариантов доступно только «В архив».
 */
export default function ProductForm({
  categories,
  value,
  onChange,
  onSubmit,
  onImageRemove,
  submissionError = null,
  savePending = false,
}: ProductFormProps) {
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedVariant, setExpandedVariant] = useState(0);

  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ProductStatus | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const photos = value.images;
  const title = value.title;
  const description = value.description;
  const categoryId = value.categoryId;
  const characteristics = value.attributes;
  const variants = value.variants;

  const patch = (part: Partial<ProductFormValues>) => onChange({ ...value, ...part });

  const canArchive = title.trim().length > 0;
  const canPublish = canArchive && validateVariantsForPublish(variants).length === 0;

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_IMAGES - photos.length;
    const selected = Array.from(files).slice(0, remaining);
    if (!selected.length) return;

    setProcessing(true);
    setUploadError(null);
    try {
      const uploaded = await uploadCatalogImages(selected);
      patch({ images: [...photos, ...uploaded].slice(0, MAX_IMAGES) });
    } catch (e) {
      console.error('[inventory] photo upload failed', e);
      setUploadError(t('seller.inventory.editCategory.uploadError'));
    } finally {
      setProcessing(false);
    }
  };

  const removePhoto = (target: InventoryImageItem) => {
    onImageRemove?.(target);
    patch({ images: photos.filter((p) => p !== target) });
  };

  const addCharacteristic = () =>
    patch({ attributes: [...characteristics, { name: '', value: '' }] });

  const updateCharacteristic = (index: number, part: Partial<Characteristic>) =>
    patch({
      attributes: characteristics.map((c, i) => (i === index ? { ...c, ...part } : c)),
    });

  const removeCharacteristic = (index: number) =>
    patch({ attributes: characteristics.filter((_, i) => i !== index) });

  const addVariant = () => {
    if (variants.length >= MAX_VARIANTS) return;
    setExpandedVariant(variants.length);
    patch({ variants: [...variants, variantFromBase(variants[0])] });
  };

  const removeVariant = (index: number) => {
    patch({
      variants:
        variants.length <= 1 ? variants : syncInherited(variants.filter((_, i) => i !== index)),
    });
    setExpandedVariant((cur) => {
      if (index === cur) return Math.max(0, index - 1);
      if (index < cur) return cur - 1;
      return cur;
    });
  };

  const setNameAt = (index: number, v: string) =>
    patch({ variants: setVariantName(variants, index, v) });
  const setValueAt = (index: number, v: string) =>
    patch({ variants: updateVariantField(variants, index, { value: v }) });
  const setQuantityAt = (index: number, v: string) =>
    patch({ variants: updateVariantField(variants, index, { quantity: v }) });
  const setPriceAt = (index: number, v: string) =>
    patch({ variants: setVariantPrice(variants, index, v) });
  const setDiscountAt = (index: number, v: string) =>
    patch({ variants: setVariantDiscount(variants, index, v) });
  const inheritPrice = (index: number) =>
    patch({ variants: inheritVariantField(variants, index, 'price') });
  const inheritDiscount = (index: number) =>
    patch({ variants: inheritVariantField(variants, index, 'discount') });

  const buildPayload = (status: ProductStatus): ProductFormPayload => ({
    title,
    description,
    categoryId,
    status,
    images: photos,
    attributes: characteristics.filter((c) => c.name.trim() || c.value.trim()),
    variants: variants
      .filter((v) => v.value.trim())
      .map((v) => ({
        id: v.id,
        name: v.name,
        value: v.value,
        quantity: Number(v.quantity) || 0,
        priceMinor: parsePriceMinor(v.price),
        discountPercent: parseDiscountPercent(v.discount),
        priceMode: v.priceMode,
        discountMode: v.discountMode,
      })),
  });

  const submit = async (status: ProductStatus) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setPendingStatus(status);
    setSubmitError(null);
    try {
      await onSubmit(buildPayload(status));
    } catch (e) {
      setSubmitError(
        e instanceof Error && e.message ? e.message : t('seller.product.form.saveError'),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setPendingStatus(null);
    }
  };

  return (
    <>
      <section className="card" data-tour="product-photo">
        <div className="card__title card__title--row">
          <span className="card__title-icon" aria-hidden>
            <ImagePlus size={16} />
          </span>
          {t('seller.product.form.photoTitle')}
          <span className="card__title-badge">
            {photos.length}/{MAX_IMAGES}
          </span>
        </div>
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <div className={`photo-slot${index === 0 ? ' photo-slot--cover' : ''}`} key={photo.url}>
              <img
                className="photo-slot__img"
                src={photo.thumbUrl ?? photo.url}
                alt=""
                decoding="async"
              />
              {index === 0 ? (
                <span className="photo-slot__cover-tag">{t('seller.product.form.coverTag')}</span>
              ) : null}
              <button
                type="button"
                className="photo-slot__remove"
                onClick={() => removePhoto(photo)}
                aria-label={t('seller.inventory.editCategory.removePhoto')}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {photos.length < MAX_IMAGES ? (
            <button
              type="button"
              className="photo-slot photo-slot--add"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
              aria-label={t('seller.inventory.editCategory.addPhoto')}
            >
              {processing ? (
                <span className="photo-slot__loading" aria-hidden />
              ) : (
                <>
                  <ImagePlus size={22} strokeWidth={1.8} />
                  <span className="photo-slot__add-label">
                    {t('seller.product.form.addPhotoShort')}
                  </span>
                </>
              )}
            </button>
          ) : null}
        </div>
        <div className="card__muted">{t('seller.product.form.photoHint', { max: MAX_IMAGES })}</div>
        {uploadError ? (
          <div className="photo-upload-error" role="alert">
            {uploadError}
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </section>

      <section className="card">
        <div className="card__title card__title--row">
          <span className="card__title-icon" aria-hidden>
            <Type size={16} />
          </span>
          {t('seller.product.form.sectionMain')}
        </div>
        <label className="field" data-tour="product-title">
          <span className="field__label">{t('seller.product.form.nameLabel')}</span>
          <input
            className="field__input"
            value={title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={t('seller.product.form.namePlaceholder')}
          />
        </label>
        <label className="field" data-tour="product-description">
          <span className="field__label">{t('seller.product.form.descriptionLabel')}</span>
          <textarea
            className="field__input field__input--area"
            value={description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder={t('seller.product.form.descriptionPlaceholder')}
            rows={3}
          />
        </label>
        <div className="field">
          <span className="field__label">{t('seller.product.form.categoryLabel')}</span>
          <ProductCategoryPicker
            categories={categories}
            value={categoryId}
            onChange={(id) => patch({ categoryId: id })}
          />
        </div>
      </section>

      <section className="card">
        <div className="card__title card__title--row">
          <span className="card__title-icon" aria-hidden>
            <ListTree size={16} />
          </span>
          {t('seller.product.form.featuresTitle')}
        </div>
        {characteristics.map((c, index) => (
          <div className="char-row" key={index}>
            <input
              className="field__input"
              value={c.name}
              onChange={(e) => updateCharacteristic(index, { name: e.target.value })}
              placeholder={t('seller.product.form.featureNamePlaceholder')}
            />
            <input
              className="field__input"
              value={c.value}
              onChange={(e) => updateCharacteristic(index, { value: e.target.value })}
              placeholder={t('seller.product.form.featureValuePlaceholder')}
            />
            <button
              type="button"
              className="char-remove"
              onClick={() => removeCharacteristic(index)}
              aria-label={t('seller.product.form.removeFeature')}
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="char-add" onClick={addCharacteristic}>
          <Plus size={16} strokeWidth={2.5} />
          <span>{t('seller.product.form.addFeature')}</span>
        </button>
      </section>

      <section className="card">
        <div className="card__title card__title--row">
          <span className="card__title-icon" aria-hidden>
            <ShoppingBag size={16} />
          </span>
          {t('seller.product.form.variantsTitle')}
        </div>
        {variants.map((v, index) => {
          const expanded = index === expandedVariant;
          return (
            <div
              className={`variant-block${expanded ? '' : ' variant-block--collapsed'}`}
              key={index}
            >
              <div className="variant-block__head">
                <button
                  type="button"
                  className="variant-block__toggle"
                  onClick={() => setExpandedVariant(index)}
                  aria-expanded={expanded}
                >
                  <span className="variant-block__title">
                    {t('seller.product.form.variantN', { number: index + 1 })}
                  </span>
                  {!expanded && (v.value.trim() || v.price.trim()) ? (
                    <span className="variant-block__summary">
                      {[v.value.trim(), v.price.trim()].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </button>
                {variants.length > 1 ? (
                  <button
                    type="button"
                    className="char-remove"
                    onClick={() => removeVariant(index)}
                    aria-label={t('seller.product.form.removeVariant')}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              {expanded ? (
                <>
                  <div className="field__row">
                    <label className="field" data-tour="product-dimension">
                      <span className="field__label">
                        {t('seller.product.form.dimensionLabel')}
                      </span>
                      <input
                        className="field__input"
                        value={v.name}
                        onChange={(e) => setNameAt(index, e.target.value)}
                        placeholder={t('seller.product.form.dimensionPlaceholder')}
                      />
                    </label>
                    <label className="field" data-tour="product-value">
                      <span className="field__label">{t('seller.product.form.valueLabel')}</span>
                      <input
                        className="field__input"
                        value={v.value}
                        onChange={(e) => setValueAt(index, e.target.value)}
                        placeholder={t('seller.product.form.valuePlaceholder')}
                      />
                    </label>
                  </div>
                  <label className="field" data-tour="product-quantity">
                    <span className="field__label">{t('seller.product.form.quantityLabel')}</span>
                    <input
                      className="field__input"
                      type="number"
                      inputMode="numeric"
                      value={v.quantity}
                      onChange={(e) => setQuantityAt(index, e.target.value)}
                    />
                  </label>
                  <div className="field__row">
                    <label className="field" data-tour="product-price">
                      <span className="field__label">{t('seller.product.form.priceLabel')}</span>
                      <input
                        className="field__input"
                        inputMode="decimal"
                        value={v.price}
                        onChange={(e) => setPriceAt(index, e.target.value)}
                        placeholder="0.00"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">{t('seller.product.form.discountLabel')}</span>
                      <input
                        className="field__input"
                        inputMode="numeric"
                        value={v.discount}
                        onChange={(e) => setDiscountAt(index, e.target.value)}
                        placeholder="0"
                      />
                    </label>
                  </div>
                  {index > 0 ? (
                    <div className="variant-block__custom">
                      {v.priceMode === 'CUSTOM' || v.discountMode === 'CUSTOM' ? (
                        <>
                          <span>{t('seller.product.form.customValues')}</span>
                          <div className="variant-block__inherit">
                            {v.priceMode === 'CUSTOM' ? (
                              <button
                                type="button"
                                className="variant-inherit"
                                onClick={() => inheritPrice(index)}
                              >
                                {t('seller.product.form.priceLikeProduct')}
                              </button>
                            ) : null}
                            {v.discountMode === 'CUSTOM' ? (
                              <button
                                type="button"
                                className="variant-inherit"
                                onClick={() => inheritDiscount(index)}
                              >
                                {t('seller.product.form.discountLikeProduct')}
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <span>{t('seller.product.form.inheritsBase')}</span>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}

        {variants.length < MAX_VARIANTS ? (
          <button type="button" className="char-add" onClick={addVariant}>
            <Plus size={16} strokeWidth={2.5} />
            <span>{t('seller.product.stock.addVariant')}</span>
          </button>
        ) : null}
        <div className="card__muted">
          {t('seller.product.form.variantsHint', { max: MAX_VARIANTS })}
        </div>
      </section>

      <div className="form-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={!canArchive || submitting || savePending}
          onClick={() => void submit('ARCHIVED')}
        >
          {pendingStatus === 'ARCHIVED' ? t('common.saving') : t('seller.product.form.archive')}
        </button>
        <button
          type="button"
          className="btn-primary"
          data-tour="product-publish"
          disabled={!canPublish || submitting || savePending}
          onClick={() => void submit('ACTIVE')}
        >
          {pendingStatus === 'ACTIVE'
            ? t('seller.product.form.publishing')
            : t('seller.product.form.publish')}
        </button>
      </div>
      {(submitError ?? submissionError) ? (
        <p className="prod-hint prod-hint--error" role="alert">
          {submitError ?? submissionError}
        </p>
      ) : null}
    </>
  );
}
