import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import './index.css';
import './presentation/styles/globals.css';
import './presentation/styles/components.css';
import App from './App';
import { queryClient } from './application/queryClient';
import { initI18n } from './infrastructure/i18n/i18n';
import { initApp, logTelegramDiagnostics } from './infrastructure/telegram/telegram-app';
import { useKeyboardFix } from './application/hooks/useKeyboardFix';

initApp();
logTelegramDiagnostics();

function Root() {
  useKeyboardFix();
  return <App />;
}

void initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Root />
        </MemoryRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
