import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import MathPage from './MathPage.jsx'
import P3OrbifoldPage from './P3OrbifoldPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/math" element={<MathPage />} />
        <Route path="/p3orbifold" element={<P3OrbifoldPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
