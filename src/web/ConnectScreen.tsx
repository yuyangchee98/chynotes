/**
 * Connection Screen
 *
 * Shown on first load to connect to a Chynotes server.
 */

import { useState, useEffect } from 'react'
import { testConnection, getServerUrl, saveServerUrl, initializeApi } from './api-shim'

interface ConnectScreenProps {
  onConnected: () => void
}

export function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const [serverUrl, setServerUrl] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoConnecting, setAutoConnecting] = useState(true)

  // Try auto-connect on mount
  useEffect(() => {
    const savedUrl = getServerUrl()
    if (savedUrl) {
      setServerUrl(savedUrl)
      handleConnect(savedUrl, true)
    } else {
      setAutoConnecting(false)
    }
  }, [])

  const handleConnect = async (url?: string, isAuto = false) => {
    const targetUrl = (url || serverUrl).trim().replace(/\/$/, '')

    if (!targetUrl) {
      setError('Please enter a server URL')
      return
    }

    setIsConnecting(true)
    setError(null)

    const result = await testConnection(targetUrl)

    if (result.ok) {
      saveServerUrl(targetUrl)
      initializeApi(targetUrl)
      onConnected()
    } else {
      setError(result.error || 'Connection failed')
      if (isAuto) {
        setAutoConnecting(false)
      }
    }

    setIsConnecting(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleConnect()
  }

  // Show loading while auto-connecting
  if (autoConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Connecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Chynotes
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect to your notes server
          </p>
        </div>

        {/* Connection Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <div className="mb-4">
            <label
              htmlFor="server-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Server URL
            </label>
            <input
              id="server-url"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://your-mac:60008"
              className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="url"
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Find this in Chynotes desktop → Settings → Remote Access
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors"
          >
            {isConnecting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </span>
            ) : (
              'Connect'
            )}
          </button>
        </form>

        {/* Help text */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p className="mb-2">Using Tailscale? Your URL looks like:</p>
          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
            http://100.x.x.x:60008
          </code>
        </div>
      </div>
    </div>
  )
}
