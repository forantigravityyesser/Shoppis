import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Boxes, Check, PackagePlus, Search, X } from 'lucide-react';
import BottomSheet from '../../../shared/components/BottomSheet';
import SafeImage from '../../../shared/components/SafeImage';
import type { InventoryProductItem } from '../../../../application/hooks/useInventory';

interface CategoryAddSheetProps {
  open: boolean;
  categoryName: string;
  /** Все товары магазина (активные + архивные). */
  products: InventoryProductItem[];
  /** id товаров, уже находящихся в категории (отмечены и недоступны для выбора). */
  existingIds: string[];
  /** Названия категорий по id (для подписи текущей категории товара). */
  categoryNameById: Record<string, string>;
  onClose: () => void;
  /** Создать новый товар в контексте категории. */
  onCreateProduct: () => void;
  /** Добавить/перенести выбранные товары в категорию. Reject → ошибка показывается в sheet. */
  onAssign: (productIds: string[]) => Promise<void>;
}

/**
 * Кнопка «+» в блоке категории: выбор «Новый товар» / «Товар из магазина»
 * (visual `.sheet__options`/`.sheet-option`) и мультивыбор товаров для быстрого
 * добавления/переноса в категорию. docs/19 Phase E/F (доработка).
 */
export default function CategoryAddSheet({
  open,
  categoryName,
  products,
  existingIds,
  categoryNameById,
  onClose,
  onCreateProduct,
  onAssign,
}: CategoryAddSheetProps) {
  const [step, setStep] = useState<'menu' | 'pick'>('menu');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => new Set(existingIds), [existingIds]);

  useEffect(() => {
    if (!open) return;
    setStep('menu');
    setSelected(new Set());
    setQuery('');
    setError(null);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => product.title.toLowerCase().includes(q));
  }, [products, query]);

  const toggle = (id: string) => {
    if (existing.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assign = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAssign([...selected]);
      onClose();
    } catch (e) {
      console.error('[inventory] assignProductsToCategory failed', e);
      setError('Не удалось добавить товары. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = (product: InventoryProductItem): string =>
    product.categoryId ? (categoryNameById[product.categoryId] ?? 'Без категории') : 'Без категории';

  return (
    <BottomSheet open={open} onClose={saving ? () => {} : onClose}>
      {step === 'menu' ? (
        <>
          <h2 className="sheet__title">Добавить в «{categoryName}»</h2>
          <div className="sheet__options">
            <button type="button" className="sheet-option" onClick={onCreateProduct}>
              <span className="sheet-option__icon" aria-hidden>
                <PackagePlus size={26} strokeWidth={1.8} />
              </span>
              <span className="sheet-option__label">Новый товар</span>
              <span className="sheet-option__hint">Создать с нуля</span>
            </button>
            <button type="button" className="sheet-option" onClick={() => setStep('pick')}>
              <span className="sheet-option__icon" aria-hidden>
                <Boxes size={26} strokeWidth={1.8} />
              </span>
              <span className="sheet-option__label">Товар из магазина</span>
              <span className="sheet-option__hint">Выбрать из каталога</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="cat-pick__head">
            <button
              type="button"
              className="inv-icon-btn"
              onClick={() => setStep('menu')}
              aria-label="Назад"
              disabled={saving}
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="sheet__title">Товары магазина</h2>
            <span className="inv-header__spacer" aria-hidden />
          </div>

          <div className="inv-search inv-search--section">
            <Search size={16} className="inv-search__icon" aria-hidden />
            <input
              className="inv-search__input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти товар"
              aria-label="Найти товар"
            />
            {query ? (
              <button
                type="button"
                className="inv-search__clear"
                onClick={() => setQuery('')}
                aria-label="Очистить"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>

          {products.length === 0 ? (
            <p className="cat-pick__empty">В магазине пока нет товаров</p>
          ) : filtered.length === 0 ? (
            <p className="cat-pick__empty">Ничего не найдено</p>
          ) : (
            <div className="cat-pick__list" role="group" aria-label="Товары магазина">
              {filtered.map((product) => {
                const isExisting = existing.has(product.id);
                const checked = isExisting || selected.has(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`cat-pick__row${checked ? ' cat-pick__row--checked' : ''}`}
                    onClick={() => toggle(product.id)}
                    aria-pressed={checked}
                    disabled={isExisting || saving}
                  >
                    <span className="cat-pick__check" aria-hidden>
                      {checked ? <Check size={15} strokeWidth={3} /> : null}
                    </span>
                    <span className="cat-pick__thumb" aria-hidden>
                      <SafeImage
                        src={product.imageUrl}
                        alt=""
                        fallback={
                          <span className="cat-pick__thumb-fallback">
                            {product.emoji || '📦'}
                          </span>
                        }
                      />
                    </span>
                    <span className="cat-pick__body">
                      <span className="cat-pick__title">{product.title}</span>
                      <span className="cat-pick__meta">{categoryLabel(product)}</span>
                    </span>
                    {isExisting ? <span className="cat-pick__tag">уже здесь</span> : null}
                  </button>
                );
              })}
            </div>
          )}

          {error ? (
            <p className="prod-hint prod-hint--error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="btn-primary btn-primary--wide"
              disabled={selected.size === 0 || saving}
              onClick={() => void assign()}
            >
              {saving
                ? 'Добавление…'
                : selected.size > 0
                  ? `Добавить (${selected.size})`
                  : 'Выберите товары'}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
