import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/instrument-serif/400.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/shell.css'
import './styles/home.css'
import App from './App.tsx'
import { reloadForNewVersion } from './lib/reload'

// Vite fires this when a page's file is missing after a deploy.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewVersion()) e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
