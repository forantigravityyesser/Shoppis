import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronDown, Circle } from 'lucide-react';
import type { ShopReadiness } from '../../../../domain/models/tutorial';

/**
 * Блок чек-листа подготовки магазина (docs/26 §4.5, TUT-03). Презентационный:
 * получает уже вычисленный `ShopReadiness` (derived из `currentStore` + серверных
 * counts) и только рендерит его. Своих проверок «по таблицам» не содержит.
 *
 * Свёрнутая карточка — заполняющийся по шагам бар (сегмент = шаг чек-листа); клик
 * раскрывает список задач. Число «N из M» совпадает с числом сегментов/пунктов.
 */

interface RowProps {
  label: string;
  hint?: string;
  status: 'incomplete' | 'completed';
}

function ChecklistRow({ label, hint, status }: RowProps) {
  const { t } = useTranslation();
  const statusText =
    status === 'completed'
      ? t('seller.dashboard.checklist.status.completed')
      : t('seller.dashboard.checklist.status.incomplete');
  const Icon = status === 'completed' ? CheckCircle2 : Circle;

  return (
    <li
      className={`dash-checklist__item dash-checklist__item--${status}`}
      data-testid="dashboard-checklist-item"
      aria-label={`${label}: ${statusText}`}
    >
      <Icon className="dash-checklist__icon" size={20} aria-hidden />
      <span className="dash-checklist__item-main">
        <span className="dash-checklist__item-label">{label}</span>
        {hint ? <span className="dash-checklist__item-hint">{hint}</span> : null}
      </span>
      <span className="dash-checklist__item-status">{statusText}</span>
    </li>
  );
}

interface Props {
  readiness: ShopReadiness;
  /** Ручной запуск/продолжение обучения (docs/26 §4.1). Скрыт, когда не нужен. */
  tutorialCta?: { label: string; onClick: () => void };
}

export default function DashboardChecklistBlock({ readiness, tutorialCta }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const ready = readiness.preparationReady;
  const { completed, total } = readiness.progress;
  const steps = Array.from({ length: total }, (_, index) => index < completed);
  const progressLabel = t('seller.dashboard.checklist.progress', { completed, total });

  return (
    <section
      className={`dash-card dash-checklist${ready ? ' dash-checklist--ready' : ''}`}
      data-testid="dashboard-checklist"
    >
      <button
        type="button"
        className="dash-checklist__head"
        aria-expanded={expanded}
        aria-label={`${ready ? t('seller.dashboard.checklist.readyTitle') : t('seller.dashboard.checklist.title')}, ${progressLabel}`}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="dash-checklist__row">
          <span className="dash-checklist__title">
            {ready
              ? t('seller.dashboard.checklist.readyTitle')
              : t('seller.dashboard.checklist.title')}
          </span>
          <span className="dash-checklist__count">{progressLabel}</span>
          <ChevronDown
            className={`dash-checklist__chevron${expanded ? ' dash-checklist__chevron--open' : ''}`}
            size={20}
            aria-hidden
          />
        </span>
        <span className="dash-checklist__steps" aria-hidden>
          {steps.map((done, index) => (
            <span
              key={index}
              className={`dash-checklist__step${done ? ' dash-checklist__step--done' : ''}`}
            />
          ))}
        </span>
      </button>

      {tutorialCta ? (
        <button type="button" className="dash-checklist__cta" onClick={tutorialCta.onClick}>
          {tutorialCta.label}
        </button>
      ) : null}

      {expanded ? (
        <ul className="dash-checklist__list">
          <ChecklistRow
            label={t('seller.dashboard.checklist.items.name')}
            status={readiness.storeName}
          />
          <ChecklistRow
            label={t('seller.dashboard.checklist.items.appearance')}
            status={readiness.storeAppearance}
            hint={
              readiness.storeAppearance === 'incomplete'
                ? t('seller.dashboard.checklist.hints.appearance')
                : undefined
            }
          />
          <ChecklistRow
            label={t('seller.dashboard.checklist.items.availableProduct')}
            status={readiness.availableProduct}
            hint={
              readiness.availableProduct === 'incomplete'
                ? t('seller.dashboard.checklist.hints.availableProduct')
                : undefined
            }
          />
          <ChecklistRow
            label={t('seller.dashboard.checklist.items.category')}
            status={readiness.category}
            hint={
              readiness.category === 'incomplete'
                ? t('seller.dashboard.checklist.hints.category')
                : undefined
            }
          />
          <ChecklistRow
            label={t('seller.dashboard.checklist.items.supportLinks')}
            status={readiness.supportLinks}
            hint={
              readiness.supportLinks === 'incomplete'
                ? t('seller.dashboard.checklist.hints.supportLinks')
                : undefined
            }
          />
        </ul>
      ) : null}
    </section>
  );
}
