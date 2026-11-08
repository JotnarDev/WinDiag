import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './lib/theme'
// The full site (./App) is on hold while WinDiag is rebuilt
import { UnderConstruction } from './components/UnderConstruction'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <UnderConstruction />
    </ThemeProvider>
  </StrictMode>
)
