import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from '../infrastructure/i18n/resources';

// Компонентные тесты прогоняются в jsdom (`// @vitest-environment jsdom`).
// Cleanup подгружается лениво, чтобы node-env unit-тесты не тянули DOM-слой.
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});

// i18n для тестов: инициализируем реальный инстанс русской локалью (`ru`).
// Благодаря этому `t('key')` в компонентах отдаёт те же тексты, что были
// захардкожены, и существующие ассерты на русский текст остаются валидными.
// `initAsync: false` — синхронная инициализация (без backend), чтобы
// `useTranslation` не вернул ключи в первом рендере.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: 'ru',
    fallbackLng: 'ru',
    initAsync: false,
    interpolation: { escapeValue: false },
  });
}
