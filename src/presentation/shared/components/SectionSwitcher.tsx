export interface SectionTab<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  tabs: Array<SectionTab<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * Компактный переключатель секций (тот же визуал, что у Inventory: pill + glass).
 * Общий презентационный примитив: значения/метки задаёт вызывающий экран.
 */
export default function SectionSwitcher<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div className="section-switcher" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`section-switcher__tab${active ? ' section-switcher__tab--active' : ''}`}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
