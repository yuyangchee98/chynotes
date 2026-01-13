/**
 * Chynotes HTTP Server
 *
 * Exposes all core functionality as REST API endpoints.
 * This allows web/mobile clients to access notes stored on this machine.
 *
 * Default port: 60008
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as fs from 'fs/promises'
import path from 'path'

// Core imports
import {
  readNote,
  writeNote,
  listAllNotes,
  ensureNotesDirectorySync,
  ensurePagesDirectorySync,
  formatDateForFileName,
  updateNoteLine,
  readPage,
  writePage,
  pageFileExists,
  createPageIfNotExists,
  listAllPages,
  replaceTermWithTag,
  saveAsset,
  resolveAssetPath,
  isImageFile,
  getAssetsDirectory,
} from '../core/file-manager'
import { generateImageDescription } from '../core/vision'
import { initDatabase, closeDatabase } from '../core/database'
import {
  reindexAll,
  indexNote,
  getAllTagsWithCounts,
  getTagOccurrences,
  searchTags,
  buildTagTree,
} from '../core/index-manager'
import {
  generateTagPageCode,
  checkOllamaConnection,
  listOllamaModels,
} from '../core/code-generator'
import { getPromptForTag, setPromptForTag } from '../core/prompt-manager'
import {
  setSetting,
  getSetting,
  getCachedCodeByTagName,
  saveSnapshot,
  getSnapshotsForNote,
  getSnapshot,
  getSnapshotCount,
  pruneSnapshotsByAge,
  autoCleanupSnapshots,
  upsertPage,
  DocumentType,
  getEmbeddedBlockCount,
  getTotalBlockCount,
  getBlockById,
  getBlockWithChildren,
  getTagCooccurrences,
} from '../core/database'
import {
  findSemanticallySimilar,
  checkEmbeddingModelAvailable,
  listEmbeddingModels,
  getSemanticTagConnections,
} from '../core/embeddings'
import {
  getQueueStatus,
  rebuildAllEmbeddings,
  processBacklogOnStartup,
  setEmbeddingEnabled,
  isEmbeddingEnabled,
} from '../core/embedding-queue'
import { getSuggestionsForBlockAsync } from '../core/tag-suggester'
import { buildFrequencyIndex, updateFrequencyIndexForNote } from '../core/frequency-index'
import {
  getSystemStatus,
  setIndexingStatus,
  setFrequencyIndexStatus,
  setSystemReady,
} from '../core/system-status'

// ============================================================================
// Helpers
// ============================================================================

function parseLocalDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, year, month, day] = match
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  return new Date(dateStr)
}

// ============================================================================
// Server Setup
// ============================================================================

const DEFAULT_PORT = 60008

export async function createServer() {
  // Initialize filesystem and database
  ensureNotesDirectorySync()
  ensurePagesDirectorySync()
  initDatabase()

  const app = new Hono()

  // CORS for cross-origin requests (phone accessing mac)
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }))

  // ============================================================================
  // Note Routes
  // ============================================================================

  app.get('/api/notes', async (c) => {
    const dates = await listAllNotes()
    return c.json(dates.map(d => formatDateForFileName(d)))
  })

  app.get('/api/notes/:date', async (c) => {
    const dateStr = c.req.param('date')
    const date = parseLocalDate(dateStr)
    const content = await readNote(date)
    return c.json({ content })
  })

  app.put('/api/notes/:date', async (c) => {
    const dateStr = c.req.param('date')
    const date = parseLocalDate(dateStr)
    const { content } = await c.req.json()
    await writeNote(date, content)
    await indexNote(date)
    updateFrequencyIndexForNote(formatDateForFileName(date), content)
    return c.json({ success: true })
  })

  app.patch('/api/notes/:date/line/:lineNumber', async (c) => {
    const dateStr = c.req.param('date')
    const lineNumber = parseInt(c.req.param('lineNumber'))
    const date = parseLocalDate(dateStr)
    const { content } = await c.req.json()
    await updateNoteLine(date, lineNumber, content)
    await indexNote(date)
    return c.json({ success: true })
  })

  // ============================================================================
  // Page Routes
  // ============================================================================

  app.get('/api/pages', async (c) => {
    const pages = await listAllPages()
    return c.json(pages)
  })

  app.get('/api/pages/:name{.+}', async (c) => {
    const name = c.req.param('name')
    const content = await readPage(name)
    return c.json({ content })
  })

  app.put('/api/pages/:name{.+}', async (c) => {
    const name = c.req.param('name')
    const { content } = await c.req.json()
    await writePage(name, content)
    upsertPage(name)
    return c.json({ success: true })
  })

  app.get('/api/pages/:name{.+}/exists', async (c) => {
    const name = c.req.param('name')
    const exists = await pageFileExists(name)
    return c.json({ exists })
  })

  app.post('/api/pages/:name{.+}', async (c) => {
    const name = c.req.param('name')
    const created = await createPageIfNotExists(name)
    if (created) {
      upsertPage(name)
    }
    return c.json({ created })
  })

  // ============================================================================
  // Tag Routes
  // ============================================================================

  app.post('/api/reindex', async (c) => {
    const result = await reindexAll()
    await buildFrequencyIndex()
    return c.json({ count: result })
  })

  app.get('/api/tags', async (c) => {
    const tags = getAllTagsWithCounts()
    return c.json(tags)
  })

  app.get('/api/tags/search', async (c) => {
    const query = c.req.query('q') || ''
    const tags = searchTags(query)
    return c.json(tags)
  })

  app.get('/api/tags/tree', async (c) => {
    const tree = buildTagTree()
    return c.json(tree)
  })

  app.get('/api/tags/cooccurrences', async (c) => {
    const cooccurrences = getTagCooccurrences()
    return c.json(cooccurrences)
  })

  app.get('/api/tags/semantic-connections', async (c) => {
    const cooccurrences = getTagCooccurrences()
    const cooccurrencePairs = new Set<string>()
    for (const co of cooccurrences) {
      const [t1, t2] = co.tag1 < co.tag2 ? [co.tag1, co.tag2] : [co.tag2, co.tag1]
      cooccurrencePairs.add(`${t1}|${t2}`)
    }
    const connections = getSemanticTagConnections(cooccurrencePairs)
    return c.json(connections)
  })

  app.get('/api/tags/:name/occurrences', async (c) => {
    const tagName = c.req.param('name')
    const occurrences = getTagOccurrences(tagName)
    return c.json(occurrences)
  })

  app.get('/api/tags/:name/prompt', async (c) => {
    const tagName = c.req.param('name')
    const prompt = getPromptForTag(tagName)
    return c.json({ prompt })
  })

  app.put('/api/tags/:name/prompt', async (c) => {
    const tagName = c.req.param('name')
    const { prompt } = await c.req.json()
    setPromptForTag(tagName, prompt)
    return c.json({ success: true })
  })

  // ============================================================================
  // AI/Code Generation Routes
  // ============================================================================

  app.post('/api/tags/:name/generate', async (c) => {
    const tagName = c.req.param('name')
    const code = await generateTagPageCode(tagName)
    return c.json({ code })
  })

  app.get('/api/tags/:name/cached-code', async (c) => {
    const tagName = c.req.param('name')
    const code = getCachedCodeByTagName(tagName.toLowerCase())
    return c.json({ code })
  })

  app.get('/api/ollama/status', async (c) => {
    const status = await checkOllamaConnection()
    return c.json(status)
  })

  app.get('/api/ollama/models', async (c) => {
    const models = await listOllamaModels()
    return c.json(models)
  })

  // ============================================================================
  // Settings Routes
  // ============================================================================

  app.get('/api/settings/:key', async (c) => {
    const key = c.req.param('key')
    const value = getSetting(key)
    return c.json({ value })
  })

  app.put('/api/settings/:key', async (c) => {
    const key = c.req.param('key')
    const { value } = await c.req.json()
    setSetting(key, value)
    return c.json({ success: true })
  })

  // ============================================================================
  // Snapshot Routes
  // ============================================================================

  app.post('/api/snapshots', async (c) => {
    const { noteDate, content, documentType = 'note' } = await c.req.json()
    const snapshot = saveSnapshot(noteDate, content, documentType as DocumentType)
    return c.json({ snapshot })
  })

  app.get('/api/snapshots/:noteDate', async (c) => {
    const noteDate = c.req.param('noteDate')
    const documentType = (c.req.query('type') || 'note') as DocumentType
    const snapshots = getSnapshotsForNote(noteDate, documentType)
    return c.json(snapshots)
  })

  app.get('/api/snapshots/by-id/:id', async (c) => {
    const id = parseInt(c.req.param('id'))
    const snapshot = getSnapshot(id)
    return c.json({ snapshot })
  })

  app.get('/api/snapshots/count', async (c) => {
    const count = getSnapshotCount()
    return c.json({ count })
  })

  app.delete('/api/snapshots/prune', async (c) => {
    const { retentionDays } = await c.req.json()
    const deleted = pruneSnapshotsByAge(retentionDays)
    return c.json({ deleted })
  })

  // ============================================================================
  // Embedding Routes
  // ============================================================================

  app.get('/api/embeddings/similar/:tagName', async (c) => {
    const tagName = c.req.param('tagName')
    const limit = parseInt(c.req.query('limit') || '20')
    const results = await findSemanticallySimilar(tagName, limit)
    return c.json(results)
  })

  app.get('/api/embeddings/stats', async (c) => {
    return c.json({
      embeddedBlocks: getEmbeddedBlockCount(),
      totalBlocks: getTotalBlockCount(),
      queueStatus: getQueueStatus(),
      enabled: isEmbeddingEnabled(),
    })
  })

  app.post('/api/embeddings/rebuild', async (c) => {
    await rebuildAllEmbeddings()
    return c.json(getQueueStatus())
  })

  app.put('/api/embeddings/enabled', async (c) => {
    const { enabled } = await c.req.json()
    setEmbeddingEnabled(enabled)
    return c.json({ enabled: isEmbeddingEnabled() })
  })

  app.get('/api/embeddings/model/status', async (c) => {
    const status = await checkEmbeddingModelAvailable()
    return c.json(status)
  })

  app.get('/api/embeddings/models', async (c) => {
    const models = await listEmbeddingModels()
    return c.json(models)
  })

  // ============================================================================
  // Block Routes
  // ============================================================================

  app.get('/api/blocks/:id', async (c) => {
    const id = c.req.param('id')
    const block = getBlockById(id)
    return c.json({ block })
  })

  app.get('/api/blocks/:id/children', async (c) => {
    const id = c.req.param('id')
    const blocks = getBlockWithChildren(id)
    return c.json(blocks)
  })

  // ============================================================================
  // Tag Suggestions Routes
  // ============================================================================

  app.post('/api/suggestions', async (c) => {
    const { text, currentNoteDate } = await c.req.json()
    const suggestions = await getSuggestionsForBlockAsync(text, currentNoteDate)
    return c.json(suggestions)
  })

  app.post('/api/retroactive-tag', async (c) => {
    const { term, tag, notes } = await c.req.json()
    let modifiedCount = 0
    for (const noteDate of notes) {
      const modified = await replaceTermWithTag(noteDate, term, tag)
      if (modified) {
        const [year, month, day] = noteDate.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        await indexNote(date)
        const content = await readNote(date)
        if (content) {
          updateFrequencyIndexForNote(noteDate, content)
        }
        modifiedCount++
      }
    }
    return c.json({ modifiedCount })
  })

  // ============================================================================
  // System Status Route
  // ============================================================================

  app.get('/api/system/status', async (c) => {
    return c.json(getSystemStatus())
  })

  // ============================================================================
  // Asset Routes
  // ============================================================================

  app.post('/api/assets', async (c) => {
    const { buffer, originalName, dateStr } = await c.req.json()
    // Buffer comes as array, convert to Uint8Array
    const uint8Buffer = new Uint8Array(buffer)
    const result = await saveAsset(uint8Buffer, originalName, dateStr)
    return c.json(result)
  })

  app.get('/api/assets/resolve', async (c) => {
    const relativePath = c.req.query('path') || ''
    const absolutePath = resolveAssetPath(relativePath)
    return c.json({ absolutePath })
  })

  app.get('/api/assets/is-image', async (c) => {
    const filename = c.req.query('filename') || ''
    return c.json({ isImage: isImageFile(filename) })
  })

  app.post('/api/assets/describe', async (c) => {
    const { imageBase64 } = await c.req.json()
    const description = await generateImageDescription(imageBase64)
    return c.json({ description })
  })

  // Serve actual asset files
  app.get('/assets/*', async (c) => {
    const assetPath = c.req.path.replace('/assets/', '')
    const fullPath = path.join(getAssetsDirectory(), assetPath)

    try {
      const file = await fs.readFile(fullPath)
      const ext = path.extname(fullPath).toLowerCase()
      const contentType = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
      }[ext] || 'application/octet-stream'

      return new Response(file, {
        headers: { 'Content-Type': contentType }
      })
    } catch {
      return c.notFound()
    }
  })

  // ============================================================================
  // Health Check
  // ============================================================================

  app.get('/api/health', async (c) => {
    return c.json({ status: 'ok', timestamp: Date.now() })
  })

  return app
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const port = parseInt(process.env.CHYNOTES_PORT || String(DEFAULT_PORT))

  console.log('🚀 Starting Chynotes server...')

  // Initialize
  const app = await createServer()

  // Initial indexing
  setIndexingStatus(true, 'Indexing notes...')
  await reindexAll()
  setIndexingStatus(false)

  setFrequencyIndexStatus(true, 'Building frequency index...')
  await buildFrequencyIndex()
  setFrequencyIndexStatus(false)

  autoCleanupSnapshots()
  processBacklogOnStartup()
  setSystemReady(true)

  // Start server
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`✅ Chynotes server running on http://localhost:${info.port}`)
    console.log(`   Access from other devices via Tailscale`)
  })
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...')
  closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', () => {
  closeDatabase()
  process.exit(0)
})

// Only run if this is the main module (executed directly, not imported)
// Check if this file is being run directly via node
const isMainModule = require.main === module

if (isMainModule) {
  main().catch((err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}
