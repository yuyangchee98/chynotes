import { app, BrowserWindow, ipcMain, dialog } from 'electron'
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
  saveAsset,
  resolveAssetPath,
  isImageFile,
} from '../core/file-manager'
import { generateImageDescription } from '../core/vision'

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
import { getSuggestionsForBlockAsync, TagSuggestion } from '../core/tag-suggester'
import { buildFrequencyIndex, updateFrequencyIndexForNote } from '../core/frequency-index'
import {
  getSystemStatus,
  setIndexingStatus,
  setFrequencyIndexStatus,
  setEmbeddingsStatus,
  setSystemReady,
  setSystemStatusCallback,
} from '../core/system-status'
import {
  analyzeVault,
  importVault,
  VaultAnalysis,
  ImportOptions,
  ImportResult,
} from '../core/obsidian-importer'
import {
  startServer,
  stopServer,
  getServerStatus,
  ServerStatus,
} from '../server/controller'

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

ipcMain.handle('get-tag-cooccurrences', () => {
  return getTagCooccurrences()
})

ipcMain.handle('get-semantic-tag-connections', () => {
  // Build set of co-occurrence pairs to exclude
  const cooccurrences = getTagCooccurrences()
  const cooccurrencePairs = new Set<string>()
  for (const c of cooccurrences) {
    const [t1, t2] = c.tag1 < c.tag2 ? [c.tag1, c.tag2] : [c.tag2, c.tag1]
    cooccurrencePairs.add(`${t1}|${t2}`)
  }
  return getSemanticTagConnections(cooccurrencePairs)
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

// Tag suggestion IPC handler (async for semantic suggestions)
ipcMain.handle('get-tag-suggestions', async (_event, text: string, currentNoteDate?: string): Promise<TagSuggestion[]> => {
  return getSuggestionsForBlockAsync(text, currentNoteDate)
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

// System status IPC handler
ipcMain.handle('get-system-status', () => {
  return getSystemStatus()
})

// Asset IPC handlers
ipcMain.handle('save-asset', async (_event, buffer: number[], originalName: string, dateStr: string) => {
  // Convert number array back to Uint8Array (IPC serializes typed arrays as regular arrays)
  const uint8Buffer = new Uint8Array(buffer)
  return await saveAsset(uint8Buffer, originalName, dateStr)
})

ipcMain.handle('resolve-asset-path', (_event, relativePath: string) => {
  return resolveAssetPath(relativePath)
})

ipcMain.handle('is-image-file', (_event, filename: string) => {
  return isImageFile(filename)
})

ipcMain.handle('generate-image-description', async (_event, imageBase64: string) => {
  return await generateImageDescription(imageBase64)
})

// Obsidian import IPC handlers
ipcMain.handle('select-folder-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Obsidian Vault',
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('analyze-obsidian-vault', async (_event, vaultPath: string): Promise<VaultAnalysis> => {
  return await analyzeVault(vaultPath)
})

ipcMain.handle('import-obsidian-vault', async (_event, vaultPath: string, options: ImportOptions): Promise<ImportResult> => {
  const result = await importVault(vaultPath, options)
  // Reindex all notes after import
  setIndexingStatus(true, 'Reindexing after import...')
  await reindexAll()
  setIndexingStatus(false)
  // Rebuild frequency index
  setFrequencyIndexStatus(true, 'Rebuilding frequency index...')
  await buildFrequencyIndex()
  setFrequencyIndexStatus(false)
  return result
})

// Remote access server IPC handlers
ipcMain.handle('start-server', async (_event, port?: number): Promise<ServerStatus> => {
  return await startServer(port)
})

ipcMain.handle('stop-server', async (): Promise<void> => {
  await stopServer()
})

ipcMain.handle('get-server-status', (): ServerStatus => {
  return getServerStatus()
})

app.whenReady().then(async () => {
  // Initial index of all notes
  setIndexingStatus(true, 'Indexing notes...')
  await reindexAll()
  setIndexingStatus(false)

  // Build frequency index for Phase 2 tag suggestions
  setFrequencyIndexStatus(true, 'Building frequency index...')
  await buildFrequencyIndex()
  setFrequencyIndexStatus(false)

  // Cleanup old snapshots if auto-cleanup is enabled
  autoCleanupSnapshots()

  // Start processing any blocks that need embedding
  processBacklogOnStartup()

  // Mark system as ready
  setSystemReady(true)

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
