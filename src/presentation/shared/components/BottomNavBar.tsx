import type { ComponentType } from 'react';
import { motion } from 'framer-motion';

export interface NavTab {
  id: string;
  icon: ComponentType<{ className?: string; size?: number | string; strokeWidth?: number | string }>;
  label: string;
}

interface BottomNavBarProps {
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Кастомный акцент активной вкладки. По умолчанию — брендовый --color-accent. */
  accentColor?: string;
}

/** Пружина для «жидкого» скольжения pill с лёгким overshoot. */
const PILL_SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const;

/**
 * Переиспользуемая нижняя навигация (pill-shaped bar).
 * Router-agnostic: активная вкладка и обработчик переключения передаются извне.
 * Неактивная вкладка — белый круг, активная — акцентный pill с иконкой и label.
 */
export default function BottomNavBar({ tabs, activeTab, onTabChange, accentColor }: BottomNavBarProps) {
  return (
    <nav className="bottom-nav" role="tablist" aria-label="Основная навигация">
      <div className="bottom-nav__bar">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`bottom-nav__tab ${active ? 'bottom-nav__tab--active' : 'bottom-nav__tab--inactive'}`}
              onClick={() => onTabChange(tab.id)}
            >
              {active && (
                <motion.span
                  layout
                  layoutId="bottom-nav-pill"
                  className="bottom-nav__pill"
                  style={accentColor ? { background: accentColor } : undefined}
                  transition={PILL_SPRING}
                />
              )}
              <Icon className="bottom-nav__icon" size={22} strokeWidth={2} />
              <motion.span
                className="bottom-nav__label"
                initial={false}
                animate={
                  active
                    ? { maxWidth: 160, opacity: 1, marginLeft: 8 }
                    : { maxWidth: 0, opacity: 0, marginLeft: 0 }
                }
                transition={{
                  duration: active ? 0.35 : 0.28,
                  delay: active ? 0.12 : 0,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                {tab.label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
