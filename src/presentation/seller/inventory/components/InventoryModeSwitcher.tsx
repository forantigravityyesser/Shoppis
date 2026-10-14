import { useTranslation } from 'react-i18next';

export type InventoryMode = 'products' | 'categories';

interface InventoryModeSwitcherProps {
  mode: InventoryMode;
  onChange: (mode: InventoryMode) => void;
}

/** Компактный переключатель секций Inventory: Товары (по умолчанию) / Категории. */
export default function InventoryModeSwitcher({ mode, onChange }: InventoryModeSwitcherProps) {
  const { t } = useTranslation();
  const tabs: Array<{ mode: InventoryMode; label: string }> = [
    { mode: 'products', label: t('seller.inventory.mode.products') },
    { mode: 'categories', label: t('seller.inventory.mode.categories') },
  ];

  return (
    <div
      className="inv-switcher glass"
      role="tablist"
      aria-label={t('seller.inventory.switcherAria')}
    >
      {tabs.map((tab) => (
        <button
          key={tab.mode}
          type="button"
          role="tab"
          aria-selected={mode === tab.mode}
          className={`inv-switcher__tab${mode === tab.mode ? ' inv-switcher__tab--active' : ''}`}
          onClick={() => onChange(tab.mode)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
