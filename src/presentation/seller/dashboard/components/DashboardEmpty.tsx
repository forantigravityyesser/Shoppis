interface Props {
  title: string;
  text?: string;
  /** Необязательное действие восстановления (например, повторный вход). */
  action?: { label: string; onClick: () => void };
}

/** Пустое/неактивное состояние главной продавца (docs/25 SDB-05). */
export default function DashboardEmpty({ title, text, action }: Props) {
  return (
    <div className="dash-empty" role="status" data-testid="dashboard-empty">
      <p className="dash-empty__title">{title}</p>
      {text ? <p className="dash-empty__text">{text}</p> : null}
      {action ? (
        <button type="button" className="dash-retry" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
