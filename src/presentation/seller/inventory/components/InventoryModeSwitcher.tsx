export type InventoryMode = 'products' | 'categories';

interface InventoryModeSwitcherProps {
  mode: InventoryMode;
  onChange: (mode: InventoryMode) => void;
}

const TABS: Array<{ mode: InventoryMode; label: string }> = [
  { mode: 'products', label: 'Товары' },
  { mode: 'categories', label: 'Категории' },
];

/** Компактный переключатель секций Inventory: Товары (по умолчанию) / Категории. */
export default function InventoryModeSwitcher({ mode, onChange }: InventoryModeSwitcherProps) {
  return (
    <div className="inv-switcher glass" role="tablist" aria-label="Разделы инвентаря">
      {TABS.map((tab) => (
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
