import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../../../shared/components/BottomSheet';
import { useInventoryActions } from '../../../../application/hooks/useInventoryActions';
import {
  parseDiscountPercent,
  parsePriceMinor,
} from '../../../../application/rules/variant-form';

interface AddVariantSheetProps {
  open: boolean;
  productId: string;
  onClose: () => void;
}

/**
 * Быстрое добавление варианта из «Контроля остатков».
 * Поля 1:1 блоку «Варианты покупки» формы создания/редактирования:
 * Размерность · Значение · Остаток · Цена · Скидка %.
 */
export default function AddVariantSheet({ open, productId, onClose }: AddVariantSheetProps) {
  const { t } = useTranslation();
  const { addVariant } = useInventoryActions();

  const [name, setName] = useState(() => t('seller.product.variant.nameDefault'));
  const [value, setValue] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave = value.trim().length > 0 && parsePriceMinor(price) > 0;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addVariant(productId, {
        name,
        value,
        quantity: Number(quantity) || 0,
        priceMinor: parsePriceMinor(price),
        discountPercent: parseDiscountPercent(discount),
      });
      onClose();
    } catch (e) {
      console.error('[inventory] addVariant failed', e);
      setSaveError(t('seller.product.variant.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} nested>
      <h2 className="sheet__title">{t('seller.product.variant.title')}</h2>

      <div className="field__row">
        <label className="field">
          <span className="field__label">{t('seller.product.variant.nameLabel')}</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('seller.product.variant.namePlaceholder')}
          />
        </label>
        <label className="field">
          <span className="field__label">{t('seller.product.variant.valueLabel')}</span>
          <input
            className="field__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('seller.product.variant.valuePlaceholder')}
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">{t('seller.product.variant.quantityLabel')}</span>
        <input
          className="field__input"
          type="number"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>

      <div className="field__row">
        <label className="field">
          <span className="field__label">{t('seller.product.variant.priceLabel')}</span>
          <input
            className="field__input"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label className="field">
          <span className="field__label">{t('seller.product.variant.discountLabel')}</span>
          <input
            className="field__input"
            inputMode="numeric"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>

      {saveError ? (
        <div style={{ marginTop: 8, color: '#FF3B30', fontSize: 13 }}>{saveError}</div>
      ) : null}

      <div className="form-actions">
        <button
          type="button"
          className="btn-primary btn-primary--wide"
          disabled={!canSave || saving}
          onClick={() => void save()}
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </BottomSheet>
  );
}
