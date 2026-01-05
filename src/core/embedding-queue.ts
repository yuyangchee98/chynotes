import { getBlockById, upsertBlockEmbedding, getBlocksNeedingEmbedding } from './database'
import { generateEmbedding } from './embeddings'

/**
 * Queue of block IDs waiting to be embedded
 */
const embeddingQueue: string[] = []

/**
 * Whether the queue processor is currently running
 */
let isProcessing = false

/**
 * Whether embedding is enabled (Ollama available)
 */
let embeddingEnabled = true

/**
 * Callback for queue status updates
 */
type StatusCallback = (status: EmbeddingQueueStatus) => void
let statusCallback: StatusCallback | null = null

/**
 * Queue status for UI
 */
export interface EmbeddingQueueStatus {
  queueLength: number
  isProcessing: boolean
  lastError: string | null
  processedCount: number
}

let lastError: string | null = null
let processedCount = 0

/**
 * Get current queue status
 */
export function getQueueStatus(): EmbeddingQueueStatus {
  return {
    queueLength: embeddingQueue.length,
    isProcessing,
    lastError,
    processedCount,
  }
}

/**
 * Set callback for status updates
 */
export function setStatusCallback(callback: StatusCallback | null): void {
  statusCallback = callback
}

/**
 * Notify status change
 */
function notifyStatus(): void {
  if (statusCallback) {
    statusCallback(getQueueStatus())
  }
}

/**
 * Add a block ID to the embedding queue
 * Duplicates are ignored
 */
export function queueBlockForEmbedding(blockId: string): void {
  if (!embeddingEnabled) return

  if (!embeddingQueue.includes(blockId)) {
    embeddingQueue.push(blockId)
    notifyStatus()
  }

  // Start processing if not already running
  processQueue()
}

/**
 * Add multiple block IDs to the queue
 */
export function queueBlocksForEmbedding(blockIds: string[]): void {
  if (!embeddingEnabled) return

  for (const blockId of blockIds) {
    if (!embeddingQueue.includes(blockId)) {
      embeddingQueue.push(blockId)
    }
  }
  notifyStatus()
  processQueue()
}

/**
 * Process the embedding queue
 * Runs asynchronously, one block at a time
 */
async function processQueue(): Promise<void> {
  if (isProcessing || embeddingQueue.length === 0 || !embeddingEnabled) {
    return
  }

  isProcessing = true
  notifyStatus()

  while (embeddingQueue.length > 0 && embeddingEnabled) {
    const blockId = embeddingQueue.shift()!
    notifyStatus()

    try {
      await embedSingleBlock(blockId)
      processedCount++
      lastError = null
    } catch (err) {
      lastError = (err as Error).message
      console.error(`Failed to embed block ${blockId}:`, err)

      // If we get too many errors, pause embedding
      if (lastError.includes('connection refused') || lastError.includes('ECONNREFUSED')) {
        console.warn('Ollama appears to be unavailable, pausing embedding')
        embeddingEnabled = false
        break
      }
    }

    notifyStatus()
  }

  isProcessing = false
  notifyStatus()
}

/**
 * Embed a single block
 */
async function embedSingleBlock(blockId: string): Promise<void> {
  const block = getBlockById(blockId)
  if (!block) {
    return // Block was deleted
  }

  // Skip very short content
  const content = block.content.trim()
  if (content.length < 10) {
    return
  }

  // Generate embedding
  const embedding = await generateEmbedding(content)

  // Store in database
  upsertBlockEmbedding(blockId, embedding)
}

/**
 * Enable or disable embedding
 */
export function setEmbeddingEnabled(enabled: boolean): void {
  embeddingEnabled = enabled
  if (enabled) {
    processQueue()
  }
  notifyStatus()
}

/**
 * Check if embedding is enabled
 */
export function isEmbeddingEnabled(): boolean {
  return embeddingEnabled
}

/**
 * Clear the queue
 */
export function clearQueue(): void {
  embeddingQueue.length = 0
  notifyStatus()
}

/**
 * Get queue length
 */
export function getQueueLength(): number {
  return embeddingQueue.length
}

/**
 * Rebuild all embeddings
 * Queues all blocks that need embedding
 */
export async function rebuildAllEmbeddings(): Promise<void> {
  const blocks = getBlocksNeedingEmbedding(10000)
  queueBlocksForEmbedding(blocks.map((b) => b.id))
}

/**
 * Process any blocks that need embedding on startup
 */
export function processBacklogOnStartup(): void {
  const blocks = getBlocksNeedingEmbedding(100)
  if (blocks.length > 0) {
    queueBlocksForEmbedding(blocks.map((b) => b.id))
  }
}
