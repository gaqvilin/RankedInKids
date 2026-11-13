import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { captureInstallPrompt } from './lib/install';
import { startAnalytics } from './lib/analytics';
import { reportError, startErrorReporting } from './lib/errors';

captureInstallPrompt();
startAnalytics();
startErrorReporting();

createRoot(document.getElementById('root')!, {
  onUncaughtError: (error) => reportError('crash', (error as Error)?.message ?? String(error)),
}).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
