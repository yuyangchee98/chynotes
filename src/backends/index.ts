/**
 * Backend exports and auto-detection
 */

export * from './interface'
export { createElectronBackend, ElectronBackend } from './electron'
export { createRemoteBackend, RemoteBackend } from './remote'

import type { Backend } from './interface'
import { createElectronBackend } from './electron'
import { createRemoteBackend } from './remote'

/**
 * Detect and create the appropriate backend
 *
 * - If window.api exists (Electron), use ElectronBackend
 * - If VITE_SERVER_URL is set, use RemoteBackend
 * - Otherwise, check localStorage for saved server URL
 */
export function createBackend(): Backend {
  // In Electron environment
  if (typeof window !== 'undefined' && window.api) {
    return createElectronBackend()
  }

  // Check for server URL in environment or localStorage
  const serverUrl =
    import.meta.env?.VITE_SERVER_URL ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('chynotes_server_url'))

  if (serverUrl) {
    return createRemoteBackend(serverUrl)
  }

  throw new Error(
    'No backend available. Either run in Electron or set VITE_SERVER_URL / localStorage.chynotes_server_url'
  )
}

/**
 * Check if we're running in Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.api
}

/**
 * Check if a remote server is configured
 */
export function hasRemoteServer(): boolean {
  return !!(
    import.meta.env?.VITE_SERVER_URL ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('chynotes_server_url'))
  )
}
