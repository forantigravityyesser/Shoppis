import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../../shared/components/BottomSheet';
import SafeImage from '../../shared/components/SafeImage';
import CreateCategorySheet from './CreateCategorySheet';
import { UNCATEGORIZED_ID } from '../../../domain/constants/categories';
import type { InventoryCategoryItem } from '../../../application/hooks/useInventory';

interface ProductCategoryPickerProps {
  categories: InventoryCategoryItem[];
  /** Выбранная категория (id), включая системную «Без категории». */
  value: string;
  onChange: (id: string) => void;
}

/** Порог, после которого в шите появляется поиск. */
const SEARCH_THRESHOLD = 8;

/**
 * Выбор категории товара: компактная строка-триггер с обложкой выбранной
 * категории и bottom sheet с сеткой плиток (фото/эмодзи + название).
 * Заменяет нативный `<select>` — выбор визуальный и в стиле витрины (docs/19).
 */
export default function ProductCategoryPicker({
  categories,
  value,
  onChange,
}: ProductCategoryPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const selected = categories.find((c) => c.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        className="cat-select"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t('seller.inventory.categoryPicker.triggerAria')}
      >
        <span className="cat-select__thumb" aria-hidden>
          <SafeImage
            src={selected?.imageUrl ?? null}
            alt=""
            className="cat-select__img"
            fallback={<span className="cat-select__emoji">{selected?.emoji ?? '📦'}</span>}
          />
        </span>
        <span className="cat-select__body">
          <span className="cat-select__name">
            {selected
              ? selected.id === UNCATEGORIZED_ID
                ? t('seller.inventory.categoryPicker.uncategorized')
                : selected.name
              : t('seller.inventory.categoryPicker.uncategorized')}
          </span>
          <span className="cat-select__meta">
            {selected
              ? t('seller.inventory.productCount', { count: selected.productCount })
              : t('seller.inventory.categoryPicker.chooseFromList')}
          </span>
        </span>
        <ChevronDown size={18} className="cat-select__chevron" aria-hidden />
      </button>

      <BottomSheet open={open} onClose={close}>
        <div className="cat-pick__head">
          <span className="inv-header__spacer" aria-hidden />
          <h2 className="sheet__title">{t('seller.inventory.categoryPicker.sheetTitle')}</h2>
          <button
            type="button"
            className="inv-icon-btn"
            onClick={() => setCreateOpen(true)}
            aria-label={t('seller.inventory.categoryPicker.newCategory')}
          >
            <Plus size={20} />
          </button>
        </div>

        {categories.length > SEARCH_THRESHOLD ? (
          <div className="inv-search inv-search--section">
            <Search size={16} className="inv-search__icon" aria-hidden />
            <input
              className="inv-search__input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('seller.inventory.categoryPicker.search')}
              aria-label={t('seller.inventory.categoryPicker.search')}
            />
            {query ? (
              <button
                type="button"
                className="inv-search__clear"
                onClick={() => setQuery('')}
                aria-label={t('seller.inventory.categoryPicker.clear')}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="cat-picker__empty">{t('seller.inventory.noResults')}</p>
        ) : (
          <div
            className="cat-picker"
            role="listbox"
            aria-label={t('seller.inventory.categoryPicker.listAria')}
          >
            {filtered.map((category) => {
              const active = category.id === value;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`cat-picker__tile${active ? ' cat-picker__tile--active' : ''}`}
                  onClick={() => {
                    onChange(category.id);
                    close();
                  }}
                >
                  <span className="cat-picker__thumb" aria-hidden>
                    <SafeImage
                      src={category.imageUrl}
                      alt=""
                      className="cat-picker__img"
                      fallback={<span className="cat-picker__emoji">{category.emoji}</span>}
                    />
                    {active ? (
                      <span className="cat-picker__check">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>
                  <span className="cat-picker__name">
                    {category.id === UNCATEGORIZED_ID
                      ? t('seller.inventory.categoryPicker.uncategorized')
                      : category.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </BottomSheet>

      <CreateCategorySheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(category) => {
          setCreateOpen(false);
          onChange(category.id);
          close();
        }}
      />
    </>
  );
}
