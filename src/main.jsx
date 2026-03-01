import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

// デバッグ情報を出力
console.log('=== Multi-PDF Sync Viewer Debug Info ===')
console.log('Current URL:', window.location.href)
console.log('Base path:', import.meta.env.BASE_URL)
console.log('Mode:', import.meta.env.MODE)
console.log('Scripts loaded:', document.scripts.length)
console.log('Root element:', document.getElementById('root'))

// エラーハンドリング
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
  console.error('Error message:', event.message)
  console.error('Error source:', event.filename, ':', event.lineno)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    console.error('Root element not found!')
    document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Root element not found</div>'
  } else {
    console.log('Initializing React app...')
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
    console.log('React app initialized successfully')
  }
} catch (error) {
  console.error('Failed to initialize app:', error)
  document.body.innerHTML = `<div style="padding: 20px; color: red;">
    <h2>Application Error</h2>
    <p>${error.message}</p>
    <pre>${error.stack}</pre>
  </div>`
}
