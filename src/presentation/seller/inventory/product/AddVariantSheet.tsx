import { useEffect, useState } from 'react';
import BottomSheet from '../../../shared/components/BottomSheet';
import { useInventoryActions } from '../../../../application/hooks/useInventoryActions';

interface AddVariantSheetProps {
  open: boolean;
  productId: string;
  onClose: () => void;
}

function parsePriceMinor(value: string): number {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

function parseDiscountPercent(value: string): number {
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Быстрое добавление варианта из «Контроля остатков».
 * Поля 1:1 блоку «Варианты покупки» формы создания/редактирования:
 * Размерность · Значение · Остаток · Цена · Скидка %.
 */
export default function AddVariantSheet({ open, productId, onClose }: AddVariantSheetProps) {
  const { addVariant } = useInventoryActions();

  const [name, setName] = useState('Объём');
  const [value, setValue] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');

  useEffect(() => {
    if (open) {
      setName('Объём');
      setValue('');
      setQuantity('0');
      setPrice('');
      setDiscount('');
    }
  }, [open]);

  const canSave = value.trim().length > 0 && parsePriceMinor(price) > 0;

  const save = () => {
    if (!canSave) return;
    addVariant(productId, {
      name,
      value,
      quantity: Number(quantity) || 0,
      priceMinor: parsePriceMinor(price),
      discountPercent: parseDiscountPercent(discount),
    });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} nested>
      <h2 className="sheet__title">Новый вариант</h2>

      <div className="field__row">
        <label className="field">
          <span className="field__label">Размерность</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Размер / Объём"
          />
        </label>
        <label className="field">
          <span className="field__label">Значение</span>
          <input
            className="field__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="1 кг"
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Остаток</span>
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
          <span className="field__label">Цена</span>
          <input
            className="field__input"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label className="field">
          <span className="field__label">Скидка %</span>
          <input
            className="field__input"
            inputMode="numeric"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn-primary btn-primary--wide"
          disabled={!canSave}
          onClick={save}
        >
          Сохранить
        </button>
      </div>
    </BottomSheet>
  );
}
