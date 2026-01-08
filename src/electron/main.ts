import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
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
} from '../core/file-manager'

/**
 * Parse YYYY-MM-DD string as local date
 */
function parseLocalDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, year, month, day] = match
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  // Fallback for ISO strings (though we shouldn't receive these anymore)
  return new Date(dateStr)
}
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
  getPageByName,
  DocumentType,
  getEmbeddedBlockCount,
  getTotalBlockCount,
  getBlockById,
  getBlockWithChildren,
} from '../core/database'
import {
  findSemanticallySimilar,
  checkEmbeddingModelAvailable,
  listEmbeddingModels,
} from '../core/embeddings'
import {
  getQueueStatus,
  rebuildAllEmbeddings,
  processBacklogOnStartup,
  setEmbeddingEnabled,
  isEmbeddingEnabled,
} from '../core/embedding-queue'
import { getSuggestionsForBlock, TagSuggestion } from '../core/tag-suggester'
import { buildFrequencyIndex, updateFrequencyIndexForNote } from '../core/frequency-index'

// Ensure notes and pages directories exist on startup
ensureNotesDirectorySync()
ensurePagesDirectorySync()

// Initialize database
initDatabase()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
  })

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5188')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC handlers for file operations
ipcMain.handle('read-note', async (_event, dateStr: string) => {
  const date = parseLocalDate(dateStr)
  return await readNote(date)
})

ipcMain.handle('write-note', async (_event, dateStr: string, content: string) => {
  const date = parseLocalDate(dateStr)
  await writeNote(date, content)
  // Re-index this note after writing
  await indexNote(date)
  // Update frequency index (Phase 2 tag suggestions)
  updateFrequencyIndexForNote(formatDateForFileName(date), content)
})

ipcMain.handle('list-notes', async () => {
  const dates = await listAllNotes()
  return dates.map(d => formatDateForFileName(d))
})

ipcMain.handle('ensure-notes-directory', async () => {
  ensureNotesDirectorySync()
})

// Page-related IPC handlers
ipcMain.handle('read-page', async (_event, name: string) => {
  return await readPage(name)
})

ipcMain.handle('write-page', async (_event, name: string, content: string) => {
  await writePage(name, content)
  // Update page record in database
  upsertPage(name)
})

ipcMain.handle('page-exists', async (_event, name: string) => {
  return await pageFileExists(name)
})

ipcMain.handle('create-page', async (_event, name: string) => {
  const created = await createPageIfNotExists(name)
  if (created) {
    upsertPage(name)
  }
  return created
})

ipcMain.handle('list-pages', async () => {
  return await listAllPages()
})

// Tag-related IPC handlers
ipcMain.handle('reindex-all', async () => {
  const result = await reindexAll()
  // Rebuild frequency index after reindexing
  await buildFrequencyIndex()
  return result
})

ipcMain.handle('get-all-tags', () => {
  return getAllTagsWithCounts()
})

ipcMain.handle('get-tag-occurrences', (_event, tagName: string) => {
  return getTagOccurrences(tagName)
})

ipcMain.handle('search-tags', (_event, query: string) => {
  return searchTags(query)
})

ipcMain.handle('get-tag-tree', () => {
  return buildTagTree()
})

// AI/Code generation IPC handlers
ipcMain.handle('generate-tag-page', async (_event, tagName: string) => {
  return await generateTagPageCode(tagName)
})

ipcMain.handle('check-ollama', async () => {
  return await checkOllamaConnection()
})

ipcMain.handle('list-ollama-models', async () => {
  return await listOllamaModels()
})

ipcMain.handle('get-tag-prompt', (_event, tagName: string) => {
  return getPromptForTag(tagName)
})

ipcMain.handle('set-tag-prompt', (_event, tagName: string, prompt: string) => {
  setPromptForTag(tagName, prompt)
})

ipcMain.handle('get-cached-code', (_event, tagName: string) => {
  return getCachedCodeByTagName(tagName.toLowerCase())
})

ipcMain.handle('update-note-line', async (_event, dateStr: string, lineNumber: number, newContent: string) => {
  const date = parseLocalDate(dateStr)
  await updateNoteLine(date, lineNumber, newContent)
  // Re-index the note after updating
  await indexNote(date)
})

// Settings IPC handlers
ipcMain.handle('get-setting', (_event, key: string) => {
  return getSetting(key)
})

ipcMain.handle('set-setting', (_event, key: string, value: string) => {
  setSetting(key, value)
})

// Snapshot IPC handlers
ipcMain.handle('save-snapshot', (_event, noteDate: string, content: string, documentType: DocumentType = 'note') => {
  return saveSnapshot(noteDate, content, documentType)
})

ipcMain.handle('get-snapshots', (_event, noteDate: string, documentType: DocumentType = 'note') => {
  return getSnapshotsForNote(noteDate, documentType)
})

ipcMain.handle('get-snapshot', (_event, id: number) => {
  return getSnapshot(id)
})

ipcMain.handle('get-snapshot-count', () => {
  return getSnapshotCount()
})

ipcMain.handle('prune-snapshots-by-age', (_event, retentionDays: number) => {
  return pruneSnapshotsByAge(retentionDays)
})

// Embedding IPC handlers
ipcMain.handle('find-semantic-similar', async (_event, tagName: string, limit?: number) => {
  return await findSemanticallySimilar(tagName, limit)
})

ipcMain.handle('get-embedding-stats', () => {
  return {
    embeddedBlocks: getEmbeddedBlockCount(),
    totalBlocks: getTotalBlockCount(),
    queueStatus: getQueueStatus(),
    enabled: isEmbeddingEnabled(),
  }
})

ipcMain.handle('rebuild-embeddings', async () => {
  await rebuildAllEmbeddings()
  return getQueueStatus()
})

ipcMain.handle('set-embedding-enabled', (_event, enabled: boolean) => {
  setEmbeddingEnabled(enabled)
  return isEmbeddingEnabled()
})

ipcMain.handle('check-embedding-model', async () => {
  return await checkEmbeddingModelAvailable()
})

ipcMain.handle('list-embedding-models', async () => {
  return await listEmbeddingModels()
})

// Block operations
ipcMain.handle('get-block-by-id', (_event, id: string) => {
  return getBlockById(id)
})

ipcMain.handle('get-block-with-children', (_event, id: string) => {
  return getBlockWithChildren(id)
})

// Tag suggestion IPC handler
ipcMain.handle('get-tag-suggestions', (_event, text: string, currentNoteDate?: string): TagSuggestion[] => {
  return getSuggestionsForBlock(text, currentNoteDate)
})

// Retroactive tagging IPC handler
ipcMain.handle('retroactive-tag', async (_event, term: string, tag: string, notes: string[]): Promise<number> => {
  let modifiedCount = 0
  for (const noteDate of notes) {
    const modified = await replaceTermWithTag(noteDate, term, tag)
    if (modified) {
      // Re-index the note after modification
      const [year, month, day] = noteDate.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      await indexNote(date)
      // Update frequency index
      const content = await readNote(date)
      if (content) {
        updateFrequencyIndexForNote(noteDate, content)
      }
      modifiedCount++
    }
  }
  return modifiedCount
})

app.whenReady().then(async () => {
  // Initial index of all notes
  await reindexAll()

  // Build frequency index for Phase 2 tag suggestions
  await buildFrequencyIndex()

  // Cleanup old snapshots if auto-cleanup is enabled
  const deletedCount = autoCleanupSnapshots()
  if (deletedCount > 0) {
    console.log(`Auto-cleanup: Deleted ${deletedCount} old snapshots`)
  }

  // Start processing any blocks that need embedding
  processBacklogOnStartup()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})
