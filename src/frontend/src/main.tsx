import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeApiBaseUrl } from './api/client'

async function bootstrap(): Promise<void> {
  await initializeApiBaseUrl()
  
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
