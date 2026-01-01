import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import {
  readNote,
  writeNote,
  listAllNotes,
  ensureNotesDirectorySync,
  formatDateForFileName,
  updateNoteLine
} from '../core/file-manager'
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
import { setSetting, getSetting, getCachedCodeByTagName } from '../core/database'

// Ensure notes directory exists on startup
ensureNotesDirectorySync()

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
ipcMain.handle('read-note', async (_event, dateISO: string) => {
  const date = new Date(dateISO)
  return await readNote(date)
})

ipcMain.handle('write-note', async (_event, dateISO: string, content: string) => {
  const date = new Date(dateISO)
  await writeNote(date, content)
  // Re-index this note after writing
  await indexNote(date)
})

ipcMain.handle('list-notes', async () => {
  const dates = await listAllNotes()
  return dates.map(d => formatDateForFileName(d))
})

ipcMain.handle('ensure-notes-directory', async () => {
  ensureNotesDirectorySync()
})

// Tag-related IPC handlers
ipcMain.handle('reindex-all', async () => {
  return await reindexAll()
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
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
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

app.whenReady().then(async () => {
  // Initial index of all notes
  await reindexAll()
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
