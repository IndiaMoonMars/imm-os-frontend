import React from 'react'
import ReactDOM from 'react-dom/client'
import { initAuth } from './auth'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

// Log in before loading the app: dashboards read the crew ID from the token at import time
initAuth()
  .then(() => import('./App'))
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })
  .catch(err => {
    console.error('IMM-OS login failed', err)
    root.render(
      <div style={{ padding: 40, color: '#ff6b6b', fontFamily: 'monospace' }}>
        Could not reach the IMM-OS identity service. Check that Keycloak is running and reload.
      </div>
    )
  })
