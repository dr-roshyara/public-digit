import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Performance-optimized bootstrap for mobile
 */
function bootstrapMobileApp(): void {
  // Mobile performance optimizations
  enableMobileOptimizations();
  
  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
}

function enableMobileOptimizations(): void {
  // Disable context menu on long press
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Prevent zoom on double tap
  document.addEventListener('dblclick', (e) => e.preventDefault());
  
  // Optimize touch events
  document.body.style.touchAction = 'manipulation';
}

function initializeApp(): void {
  const rootElement = document.querySelector('app-root');
  
  if (!rootElement) {
    console.error('Root element not found');
    displayFatalError('Application configuration error');
    return;
  }

  // Bootstrap with error handling
  bootstrapApplication(App, appConfig) 
    .then(() => {
      setupSafeAreas();
      console.log('App bootstrapped successfully');
      hideLoadingScreen();
    })
    .catch(handleBootstrapError);
}


function setupSafeAreas() {
  // Add CSS custom properties for safe areas
  document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
  document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
  document.documentElement.style.setProperty('--safe-area-left', 'env(safe-area-inset-left)');
  document.documentElement.style.setProperty('--safe-area-right', 'env(safe-area-inset-right)');
  
  // Fallback for browsers that don't support env()
  if (!CSS.supports('top: env(safe-area-inset-top)')) {
    document.documentElement.style.setProperty('--safe-area-top', '0px');
    document.documentElement.style.setProperty('--safe-area-bottom', '0px');
    document.documentElement.style.setProperty('--safe-area-left', '0px');
    document.documentElement.style.setProperty('--safe-area-right', '0px');
  }
}

function hideLoadingScreen(): void {
  const loadingElement = document.getElementById('app-loading');
  if (loadingElement) {
    loadingElement.style.opacity = '0';
    loadingElement.style.transition = 'opacity 0.3s ease';
    setTimeout(() => loadingElement.remove(), 300);
  }
}

function handleBootstrapError(error: unknown): void {
  console.error('Bootstrap failed:', error);
  
  // Hide loading screen
  const loadingElement = document.getElementById('app-loading');
  if (loadingElement) {
    loadingElement.remove();
  }
  
  displayFatalError(getErrorMessage(error));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Application failed to start';
}

function displayFatalError(message: string): void {
  document.body.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; justify-content: center; align-items: center; padding: 2rem; text-align: center;">
      <div>
        <h1>App Error</h1>
        <p>${message}</p>
        <button onclick="window.location.reload()" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 10px 20px; border-radius: 5px; margin-top: 1rem;">
          Restart
        </button>
      </div>
    </div>
  `;
}

// Start the app
bootstrapMobileApp();