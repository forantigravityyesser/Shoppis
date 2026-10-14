import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  /** Подзаголовок/подсказка под заголовком. */
  subtitle?: string;
  /** Если задан — кликабельна вся карточка (кнопка с шевроном). */
  onClick?: () => void;
  /**
   * Если задан (и нет `onClick`) — кликабелен только заголовок (кнопка с
   * шевроном), а тело остаётся свободным для собственных интерактивных элементов.
   */
  onTitleClick?: () => void;
  children?: ReactNode;
}

/**
 * Карточка-блок главной продавца (docs/25 §4). Презентационный примитив: без
 * навигации и данных. `onClick` делает кликабельной всю карточку; `onTitleClick`
 * — только заголовок (когда внутри есть свои кнопки — избегаем вложенных button).
 */
export default function DashboardCard({ title, subtitle, onClick, onTitleClick, children }: Props) {
  const head =
    onTitleClick && !onClick ? (
      <div className="dash-card__head">
        <button type="button" className="dash-card__title-btn" onClick={onTitleClick}>
          <span className="dash-card__title">{title}</span>
          <ChevronRight className="dash-card__chevron" size={20} aria-hidden />
        </button>
      </div>
    ) : (
      <div className="dash-card__head">
        <span className="dash-card__title">{title}</span>
        {onClick ? <ChevronRight className="dash-card__chevron" size={20} aria-hidden /> : null}
      </div>
    );

  const content = (
    <>
      {head}
      {subtitle ? <p className="dash-card__subtitle">{subtitle}</p> : null}
      {children ? <div className="dash-card__body">{children}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="dash-card" onClick={onClick} data-testid="dashboard-card">
        {content}
      </button>
    );
  }

  return (
    <section className="dash-card" data-testid="dashboard-card">
      {content}
    </section>
  );
}
