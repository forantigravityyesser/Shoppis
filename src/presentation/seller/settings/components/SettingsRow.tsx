import type { ComponentType } from 'react';
import { ChevronRight } from 'lucide-react';

type IconProps = {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
};

export interface SettingsToggle {
  /** Текущее состояние переключателя. */
  checked: boolean;
  /** Accessible-имя переключателя. */
  label: string;
  disabled?: boolean;
  onChange: () => void;
}

interface Props {
  title: string;
  /** Краткое значение справа (например, «Русский · RUB»). */
  value?: string;
  icon?: ComponentType<IconProps>;
  /** Навигационная строка (chevron). Взаимоисключающе с `toggle`. */
  onClick?: () => void;
  toggle?: SettingsToggle;
  disabled?: boolean;
  /**
   * Строка-действие (немедленное действие вроде «Предпросмотр»):
   * без chevron, заголовок выделен акцентным цветом.
   */
  action?: boolean;
}

/**
 * Универсальная строка Settings Hub: иконка + заголовок + значение +
 * chevron (navigation) либо switch (boolean) либо акцент без chevron (action).
 * Высота и отступы едины для всех строк; разделители — через CSS. 12 §hub.
 */
export default function SettingsRow({
  title,
  value,
  icon: Icon,
  onClick,
  toggle,
  disabled,
  action,
}: Props) {
  if (toggle) {
    return (
      <div className="settings-row">
        {Icon ? (
          <span className="settings-row__icon" aria-hidden="true">
            <Icon size={20} />
          </span>
        ) : null}
        <span className="settings-row__title">{title}</span>
        <button
          type="button"
          role="switch"
          aria-checked={toggle.checked}
          aria-label={toggle.label}
          disabled={disabled || toggle.disabled}
          onClick={toggle.onChange}
          className="settings-switch"
          data-on={toggle.checked}
        >
          <span className="settings-switch__knob" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`settings-row${action ? ' settings-row--action' : ''}`}
    >
      {Icon ? (
        <span className="settings-row__icon" aria-hidden="true">
          <Icon size={20} />
        </span>
      ) : null}
      <span className="settings-row__title">{title}</span>
      {value ? <span className="settings-row__value">{value}</span> : null}
      {action ? null : (
        <span className="settings-row__chevron" aria-hidden="true">
          <ChevronRight size={20} />
        </span>
      )}
    </button>
  );
}
