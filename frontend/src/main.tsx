import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

// Safely reload if a new deployment breaks cached chunk hashes, preventing infinite reload loops
function handleChunkLoadError(event: Event) {
  event.preventDefault();
  const lastReload = sessionStorage.getItem('last_chunk_reload');
  const now = Date.now();
  // Allow at most 1 reload attempt within 15 seconds to avoid infinite loop
  if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
    sessionStorage.setItem('last_chunk_reload', String(now));
    window.location.reload();
  } else {
    console.error('Chunk loading failed repeatedly. Suppressing reload loop.');
  }
}

window.addEventListener('vite:preloadError', handleChunkLoadError);

window.addEventListener('error', (event) => {
  if (
    event?.message?.includes('dynamically imported module') ||
    event?.message?.includes('Importing a module script failed')
  ) {
    handleChunkLoadError(event);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

