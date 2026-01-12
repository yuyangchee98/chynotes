/**
 * Server Controller
 *
 * Controls the HTTP server lifecycle from within the Electron app.
 * Used to start/stop the remote access server from Settings.
 */

import { serve } from '@hono/node-server'
import type { ServerType } from '@hono/node-server'
import { createServer } from './index'
import { networkInterfaces } from 'os'

const DEFAULT_PORT = 60008

let server: ServerType | null = null
let serverPort: number = DEFAULT_PORT

export interface ServerStatus {
  running: boolean
  port: number
  localUrl: string | null
  tailscaleUrl: string | null
  lanAddresses: string[]
}

/**
 * Get the Tailscale IP address if available
 */
function getTailscaleAddress(): string | null {
  const interfaces = networkInterfaces()

  // Tailscale interface is usually named 'utun' on macOS or 'tailscale0' on Linux
  // or has IP in 100.x.x.x range
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue

    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // Check for Tailscale IP range (100.64.0.0/10 - CGNAT range used by Tailscale)
        if (addr.address.startsWith('100.')) {
          return addr.address
        }
      }
    }
  }

  return null
}

/**
 * Get all LAN addresses
 */
function getLanAddresses(): string[] {
  const interfaces = networkInterfaces()
  const addresses: string[] = []

  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue

    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // Skip Tailscale addresses
        if (!addr.address.startsWith('100.')) {
          addresses.push(addr.address)
        }
      }
    }
  }

  return addresses
}

/**
 * Start the HTTP server
 */
export async function startServer(port: number = DEFAULT_PORT): Promise<ServerStatus> {
  if (server) {
    // Already running
    return getServerStatus()
  }

  serverPort = port
  const app = await createServer()

  return new Promise((resolve, reject) => {
    try {
      server = serve({
        fetch: app.fetch,
        port: serverPort,
      }, () => {
        console.log(`✅ Remote access server started on port ${serverPort}`)
        resolve(getServerStatus())
      })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Stop the HTTP server
 */
export async function stopServer(): Promise<void> {
  if (!server) {
    return
  }

  return new Promise((resolve) => {
    server!.close(() => {
      console.log('🛑 Remote access server stopped')
      server = null
      resolve()
    })
  })
}

/**
 * Get current server status
 */
export function getServerStatus(): ServerStatus {
  const running = server !== null
  const tailscaleIp = getTailscaleAddress()
  const lanAddresses = getLanAddresses()

  return {
    running,
    port: serverPort,
    localUrl: running ? `http://localhost:${serverPort}` : null,
    tailscaleUrl: running && tailscaleIp ? `http://${tailscaleIp}:${serverPort}` : null,
    lanAddresses: running ? lanAddresses.map(ip => `http://${ip}:${serverPort}`) : [],
  }
}

/**
 * Check if server is running
 */
export function isServerRunning(): boolean {
  return server !== null
}
