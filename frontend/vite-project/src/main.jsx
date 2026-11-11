
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import ClickSoundProvider from './component/ClickSoundProvider'

import './index.css'

createRoot(document.getElementById('root')).render(

  <StrictMode>

    <BrowserRouter>

      <ClickSoundProvider>

        <App />

      </ClickSoundProvider>

    </BrowserRouter>

  </StrictMode>

)
