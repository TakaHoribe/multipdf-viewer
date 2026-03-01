import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

if (import.meta.env.DEV) {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)
  })
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
  })
}

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found')
  }
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
  console.error('Failed to initialize app:', error)
  document.body.innerHTML = `<div style="padding: 20px; color: red;">
    <h2>Application Error</h2>
    <p>${error.message}</p>
    <pre>${error.stack}</pre>
  </div>`
}
