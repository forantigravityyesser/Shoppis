interface Props {
  title: string;
  text?: string;
}

/** Пустое/неактивное состояние главной продавца (docs/25 SDB-05). */
export default function DashboardEmpty({ title, text }: Props) {
  return (
    <div className="dash-empty" role="status" data-testid="dashboard-empty">
      <p className="dash-empty__title">{title}</p>
      {text ? <p className="dash-empty__text">{text}</p> : null}
    </div>
  );
}
