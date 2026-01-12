/**
 * Web Entry Point
 *
 * Entry point for the web version of Chynotes.
 * Shows connection screen first, then the main app.
 */

import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from '../App'
import { ConnectScreen } from './ConnectScreen'
import { isApiInitialized } from './api-shim'
import '../index.css'

function WebApp() {
  const [connected, setConnected] = useState(isApiInitialized())

  if (!connected) {
    return <ConnectScreen onConnected={() => setConnected(true)} />
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebApp />
  </React.StrictMode>,
)
