import './composition-root';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import './index.css';
import './presentation/styles/globals.css';
import './presentation/styles/components.css';
import App from './App';
import { queryClient } from './application/queryClient';
import { INSFORGE_URL } from './infrastructure/insforge/config';
import { initI18n } from './infrastructure/i18n/i18n';
import { initApp, logTelegramDiagnostics } from './infrastructure/telegram/telegram-app';

initApp();
logTelegramDiagnostics();

/** Прогреваем соединение с доменом Storage/API до загрузки изображений (preconnect). */
function preconnectBackend(): void {
  try {
    const origin = new URL(INSFORGE_URL).origin;
    for (const rel of ['preconnect', 'dns-prefetch']) {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = origin;
      document.head.appendChild(link);
    }
  } catch {
    /* невалидный URL — пропускаем */
  }
}

preconnectBackend();

void initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
