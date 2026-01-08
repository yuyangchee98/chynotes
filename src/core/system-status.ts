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
  lastActivityAt: number | null  // Timestamp of last completed task
}

let status: SystemStatus = {
  indexing: { isActive: false, message: null },
  frequencyIndex: { isActive: false, message: null },
  embeddings: { isActive: false, queueLength: 0, message: null },
  ready: false,
  lastActivityAt: null,
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
  const wasActive = status.indexing.isActive
  status.indexing = { isActive, message }
  if (wasActive && !isActive) {
    status.lastActivityAt = Date.now()
  }
  notifyChange()
}

/**
 * Update frequency index status
 */
export function setFrequencyIndexStatus(isActive: boolean, message: string | null = null): void {
  const wasActive = status.frequencyIndex.isActive
  status.frequencyIndex = { isActive, message }
  if (wasActive && !isActive) {
    status.lastActivityAt = Date.now()
  }
  notifyChange()
}

/**
 * Update embeddings status
 */
export function setEmbeddingsStatus(isActive: boolean, queueLength: number, message: string | null = null): void {
  const wasActive = status.embeddings.isActive
  status.embeddings = { isActive, queueLength, message }
  if (wasActive && !isActive) {
    status.lastActivityAt = Date.now()
  }
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
