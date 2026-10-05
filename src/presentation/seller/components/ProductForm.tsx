import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { InventoryCategoryItem } from '../../../application/hooks/useInventory';
import type { InventoryProductDetail } from '../../../application/hooks/useProduct';
import { uploadCatalogImages } from '../../../application/services/image-service';
import type {
  InventoryImageItem,
  ProductFormPayload,
} from '../../../application/read-models/inventory-view';
import {
  emptyVariant,
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
  type VariantForm,
} from '../../../application/rules/variant-form';
import { UNCATEGORIZED_ID } from '../../../domain/constants/categories';
import { MAX_IMAGES, MAX_VARIANTS } from '../../../domain/constants/limits';
import type { ProductStatus } from '../../../domain/models/product';

export interface Characteristic {
  name: string;
  value: string;
}

export interface ProductFormValues {
  title: string;
  description: string;
  categoryId: string;
  images: InventoryImageItem[];
  attributes: Characteristic[];
  variants: VariantForm[];
}

export type { ProductFormPayload };

interface ProductFormProps {
  categories: InventoryCategoryItem[];
  initial?: Partial<ProductFormValues>;
  onSubmit: (payload: ProductFormPayload) => Promise<void> | void;
}

/** Плоские данные товара → значения формы (для режима редактирования). */
export function detailToFormValues(detail: InventoryProductDetail): ProductFormValues {
  const variants: VariantForm[] = detail.variants.map((v, index) => ({
    id: v.id,
    name: v.name,
    value: v.value,
    quantity: String(v.availableQuantity),
    price: (v.originalAmountMinor / 100).toFixed(2),
    discount: String(v.discountPercent),
    priceMode:
      index > 0 && v.priceMode === 'CUSTOM_PRICE' && v.customOriginalAmountMinor != null
        ? 'CUSTOM'
        : 'INHERITED',
    discountMode:
      index > 0 && v.priceMode === 'CUSTOM_PRICE' && v.customDiscountPercent != null
        ? 'CUSTOM'
        : 'INHERITED',
  }));

  return {
    title: detail.title,
    description: detail.description,
    categoryId: detail.categoryId ?? UNCATEGORIZED_ID,
    images: detail.images,
    attributes: detail.attributes.map((a) => ({ name: a.name, value: a.value })),
    variants: variants.length ? variants : [emptyVariant()],
  };
}

/**
 * Форма карточки товара: Фото → Основное (название/описание/категория) →
 * Характеристики → Варианты покупки. Используется и при создании, и при редактировании.
 * ADR-06.8: без вариантов доступно только «В архив».
 */
export default function ProductForm({ categories, initial, onSubmit }: ProductFormProps) {
  const [photos, setPhotos] = useState<InventoryImageItem[]>(initial?.images ?? []);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? UNCATEGORIZED_ID);

  const [characteristics, setCharacteristics] = useState<Characteristic[]>(
    initial?.attributes ?? [],
  );
  const [variants, setVariants] = useState<VariantForm[]>(initial?.variants ?? [emptyVariant()]);
  const [expandedVariant, setExpandedVariant] = useState(0);

  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ProductStatus | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      setPhotos((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
    } catch (e) {
      console.error('[inventory] photo upload failed', e);
      setUploadError('Не удалось загрузить фото. Попробуйте ещё раз.');
    } finally {
      setProcessing(false);
    }
  };

  const removePhoto = (target: InventoryImageItem) => {
    setPhotos((prev) => prev.filter((p) => p !== target));
  };

  const addCharacteristic = () => setCharacteristics((prev) => [...prev, { name: '', value: '' }]);

  const updateCharacteristic = (index: number, patch: Partial<Characteristic>) =>
    setCharacteristics((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const removeCharacteristic = (index: number) =>
    setCharacteristics((prev) => prev.filter((_, i) => i !== index));

  const addVariant = () => {
    if (variants.length >= MAX_VARIANTS) return;
    setExpandedVariant(variants.length);
    setVariants((prev) => [...prev, variantFromBase(prev[0])]);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) =>
      prev.length <= 1 ? prev : syncInherited(prev.filter((_, i) => i !== index)),
    );
    setExpandedVariant((cur) => {
      if (index === cur) return Math.max(0, index - 1);
      if (index < cur) return cur - 1;
      return cur;
    });
  };

  const setNameAt = (index: number, value: string) =>
    setVariants((prev) => setVariantName(prev, index, value));
  const setValueAt = (index: number, value: string) =>
    setVariants((prev) => updateVariantField(prev, index, { value }));
  const setQuantityAt = (index: number, value: string) =>
    setVariants((prev) => updateVariantField(prev, index, { quantity: value }));
  const setPriceAt = (index: number, value: string) =>
    setVariants((prev) => setVariantPrice(prev, index, value));
  const setDiscountAt = (index: number, value: string) =>
    setVariants((prev) => setVariantDiscount(prev, index, value));
  const inheritPrice = (index: number) =>
    setVariants((prev) => inheritVariantField(prev, index, 'price'));
  const inheritDiscount = (index: number) =>
    setVariants((prev) => inheritVariantField(prev, index, 'discount'));

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
        e instanceof Error && e.message
          ? e.message
          : 'Не удалось сохранить товар. Попробуйте ещё раз.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setPendingStatus(null);
    }
  };

  return (
    <>
      <section className="card">
        <div className="card__title">Фото</div>
        <div className="photo-grid">
          {photos.map((photo) => (
            <div className="photo-slot" key={photo.url}>
              <img
                className="photo-slot__img"
                src={photo.thumbUrl ?? photo.url}
                alt=""
                decoding="async"
              />
              <button
                type="button"
                className="photo-slot__remove"
                onClick={() => removePhoto(photo)}
                aria-label="Удалить фото"
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
              aria-label="Добавить фото"
            >
              {processing ? (
                <span className="photo-slot__loading" aria-hidden />
              ) : (
                <Plus size={22} />
              )}
            </button>
          ) : null}
        </div>
        <div className="card__muted">
          До {MAX_IMAGES} фото — Shoppis сам подготовит их для каталога.
        </div>
        {uploadError ? (
          <div style={{ marginTop: 8, color: '#FF3B30', fontSize: 13 }}>{uploadError}</div>
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
        <label className="field">
          <span className="field__label">Название</span>
          <input
            className="field__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, Морковь"
          />
        </label>
        <label className="field">
          <span className="field__label">Описание</span>
          <textarea
            className="field__input field__input--area"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Необязательно"
            rows={3}
          />
        </label>
        <label className="field">
          <span className="field__label">Категория</span>
          <select
            className="field__input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <div className="card__title">Характеристики</div>
        {characteristics.map((c, index) => (
          <div className="char-row" key={index}>
            <input
              className="field__input"
              value={c.name}
              onChange={(e) => updateCharacteristic(index, { name: e.target.value })}
              placeholder="Материал"
            />
            <input
              className="field__input"
              value={c.value}
              onChange={(e) => updateCharacteristic(index, { value: e.target.value })}
              placeholder="Кожа"
            />
            <button
              type="button"
              className="char-remove"
              onClick={() => removeCharacteristic(index)}
              aria-label="Удалить характеристику"
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="char-add" onClick={addCharacteristic}>
          <Plus size={16} strokeWidth={2.5} />
          <span>Добавить характеристику</span>
        </button>
      </section>

      <section className="card">
        <div className="card__title">Варианты покупки</div>
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
                  <span className="variant-block__title">Вариант {index + 1}</span>
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
                    aria-label="Удалить вариант"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              {expanded ? (
                <>
                  <div className="field__row">
                    <label className="field">
                      <span className="field__label">Размерность</span>
                      <input
                        className="field__input"
                        value={v.name}
                        onChange={(e) => setNameAt(index, e.target.value)}
                        placeholder="размер / объём / память"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Значение</span>
                      <input
                        className="field__input"
                        value={v.value}
                        onChange={(e) => setValueAt(index, e.target.value)}
                        placeholder="42 / XL / 500 мл / 128 GB"
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span className="field__label">Остаток</span>
                    <input
                      className="field__input"
                      type="number"
                      inputMode="numeric"
                      value={v.quantity}
                      onChange={(e) => setQuantityAt(index, e.target.value)}
                    />
                  </label>
                  <div className="field__row">
                    <label className="field">
                      <span className="field__label">Цена</span>
                      <input
                        className="field__input"
                        inputMode="decimal"
                        value={v.price}
                        onChange={(e) => setPriceAt(index, e.target.value)}
                        placeholder="0.00"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Скидка %</span>
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
                          <span>Свои значения для этого варианта</span>
                          <div className="variant-block__inherit">
                            {v.priceMode === 'CUSTOM' ? (
                              <button
                                type="button"
                                className="variant-inherit"
                                onClick={() => inheritPrice(index)}
                              >
                                Цена как у товара
                              </button>
                            ) : null}
                            {v.discountMode === 'CUSTOM' ? (
                              <button
                                type="button"
                                className="variant-inherit"
                                onClick={() => inheritDiscount(index)}
                              >
                                Скидка как у товара
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <span>Наследует цену и скидку варианта 1</span>
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
            <span>Добавить вариант</span>
          </button>
        ) : null}
        <div className="card__muted">
          До {MAX_VARIANTS} вариантов. Без варианта товар нельзя выставить на витрину — только в
          архив.
        </div>
      </section>

      <div className="form-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={!canArchive || submitting}
          onClick={() => void submit('ARCHIVED')}
        >
          {pendingStatus === 'ARCHIVED' ? 'Сохранение…' : 'В архив'}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canPublish || submitting}
          onClick={() => void submit('ACTIVE')}
        >
          {pendingStatus === 'ACTIVE' ? 'Публикация…' : 'На витрину'}
        </button>
      </div>
      {submitError ? (
        <p className="prod-hint prod-hint--error" role="alert">
          {submitError}
        </p>
      ) : null}
    </>
  );
}
