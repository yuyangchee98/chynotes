/**
 * Unified system status tracking for background processes
 */

export interface SystemStatus {
  indexing: {
    isActive: boolean
    message: string | null
  }
  frequencyIndex: {
    isActive: boolean
    message: string | null
  }
  embeddings: {
    isActive: boolean
    queueLength: number
    message: string | null
  }
  ready: boolean  // All startup tasks complete
}

let status: SystemStatus = {
  indexing: { isActive: false, message: null },
  frequencyIndex: { isActive: false, message: null },
  embeddings: { isActive: false, queueLength: 0, message: null },
  ready: false,
}

type StatusCallback = (status: SystemStatus) => void
let statusCallback: StatusCallback | null = null

/**
 * Get current system status
 */
export function getSystemStatus(): SystemStatus {
  return { ...status }
}

/**
 * Set callback for status updates (used by IPC to push to renderer)
 */
export function setSystemStatusCallback(callback: StatusCallback | null): void {
  statusCallback = callback
}

function notifyChange(): void {
  if (statusCallback) {
    statusCallback(getSystemStatus())
  }
}

/**
 * Update indexing status
 */
export function setIndexingStatus(isActive: boolean, message: string | null = null): void {
  status.indexing = { isActive, message }
  notifyChange()
}

/**
 * Update frequency index status
 */
export function setFrequencyIndexStatus(isActive: boolean, message: string | null = null): void {
  status.frequencyIndex = { isActive, message }
  notifyChange()
}

/**
 * Update embeddings status
 */
export function setEmbeddingsStatus(isActive: boolean, queueLength: number, message: string | null = null): void {
  status.embeddings = { isActive, queueLength, message }
  notifyChange()
}

/**
 * Mark system as ready (all startup tasks complete)
 */
export function setSystemReady(ready: boolean): void {
  status.ready = ready
  notifyChange()
}

/**
 * Check if any background process is active
 */
export function isProcessing(): boolean {
  return status.indexing.isActive ||
         status.frequencyIndex.isActive ||
         status.embeddings.isActive
}
