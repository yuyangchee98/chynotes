/**
 * API Shim for Web
 *
 * Creates a window.api compatible interface using RemoteBackend.
 * This allows all existing components to work without modification.
 */

import { createRemoteBackend } from '../backends/remote'
import type { Backend } from '../backends/interface'

let backend: Backend | null = null

/**
 * Initialize the API shim with a server URL
 */
export function initializeApi(serverUrl: string): void {
  backend = createRemoteBackend(serverUrl)

  // Create window.api shim
  ;(window as any).api = {
    // Note operations
    readNote: (dateISO: string) => backend!.readNote(dateISO),
    writeNote: (dateISO: string, content: string) => backend!.writeNote(dateISO, content),
    listNotes: () => backend!.listNotes(),
    ensureNotesDirectory: () => backend!.ensureNotesDirectory(),
    updateNoteLine: (dateStr: string, lineNumber: number, newContent: string) =>
      backend!.updateNoteLine(dateStr, lineNumber, newContent),

    // Page operations
    readPage: (name: string) => backend!.readPage(name),
    writePage: (name: string, content: string) => backend!.writePage(name, content),
    pageExists: (name: string) => backend!.pageExists(name),
    createPage: (name: string) => backend!.createPage(name),
    listPages: () => backend!.listPages(),

    // Tag operations
    reindexAll: () => backend!.reindexAll(),
    getAllTags: () => backend!.getAllTags(),
    getTagOccurrences: (tagName: string) => backend!.getTagOccurrences(tagName),
    searchTags: (query: string) => backend!.searchTags(query),
    getTagTree: () => backend!.getTagTree(),
    getTagCooccurrences: () => backend!.getTagCooccurrences(),
    getSemanticTagConnections: () => backend!.getSemanticTagConnections(),

    // AI/Code generation
    generateTagPage: (tagName: string) => backend!.generateTagPage(tagName),
    checkOllama: () => backend!.checkOllama(),
    listOllamaModels: () => backend!.listOllamaModels(),
    getTagPrompt: (tagName: string) => backend!.getTagPrompt(tagName),
    setTagPrompt: (tagName: string, prompt: string) => backend!.setTagPrompt(tagName, prompt),
    getCachedCode: (tagName: string) => backend!.getCachedCode(tagName),

    // Settings
    getSetting: (key: string) => backend!.getSetting(key),
    setSetting: (key: string, value: string) => backend!.setSetting(key, value),

    // Snapshots
    saveSnapshot: (noteDate: string, content: string, documentType?: 'note' | 'page') =>
      backend!.saveSnapshot(noteDate, content, documentType),
    getSnapshots: (noteDate: string, documentType?: 'note' | 'page') =>
      backend!.getSnapshots(noteDate, documentType),
    getSnapshot: (id: number) => backend!.getSnapshot(id),
    getSnapshotCount: () => backend!.getSnapshotCount(),
    pruneSnapshotsByAge: (retentionDays: number) => backend!.pruneSnapshotsByAge(retentionDays),

    // Embeddings
    findSemanticSimilar: (tagName: string, limit?: number) =>
      backend!.findSemanticSimilar(tagName, limit),
    getEmbeddingStats: () => backend!.getEmbeddingStats(),
    rebuildEmbeddings: () => backend!.rebuildEmbeddings(),
    setEmbeddingEnabled: (enabled: boolean) => backend!.setEmbeddingEnabled(enabled),
    checkEmbeddingModel: () => backend!.checkEmbeddingModel(),
    listEmbeddingModels: () => backend!.listEmbeddingModels(),

    // Blocks
    getBlockById: (id: string) => backend!.getBlockById(id),
    getBlockWithChildren: (id: string) => backend!.getBlockWithChildren(id),

    // Tag suggestions
    getTagSuggestions: (text: string, currentNoteDate?: string) =>
      backend!.getTagSuggestions(text, currentNoteDate),
    retroactiveTag: (term: string, tag: string, notes: string[]) =>
      backend!.retroactiveTag(term, tag, notes),

    // System status
    getSystemStatus: () => backend!.getSystemStatus(),

    // Assets - special handling for web
    saveAsset: (buffer: Uint8Array, originalName: string, dateStr: string) =>
      backend!.saveAsset(buffer, originalName, dateStr),
    resolveAssetPath: (relativePath: string) => {
      // For web, return the server URL for assets
      const serverUrl = localStorage.getItem('chynotes_server_url') || ''
      return Promise.resolve(`${serverUrl}/${relativePath}`)
    },
    isImageFile: (filename: string) => backend!.isImageFile(filename),
    generateImageDescription: (imageBase64: string) => backend!.generateImageDescription(imageBase64),

    // Server controls - not available on web (we're the client, not the server)
    startServer: () => Promise.reject(new Error('Not available on web')),
    stopServer: () => Promise.reject(new Error('Not available on web')),
    getServerStatus: () => Promise.resolve({ running: false, port: 0, localUrl: null, tailscaleUrl: null, lanAddresses: [] }),

    // Obsidian import - not available on web
    selectFolderDialog: () => Promise.resolve(null),
    analyzeObsidianVault: () => Promise.reject(new Error('Not available on web')),
    importObsidianVault: () => Promise.reject(new Error('Not available on web')),
  }
}

/**
 * Check if API is initialized
 */
export function isApiInitialized(): boolean {
  return backend !== null && (window as any).api !== undefined
}

/**
 * Get the current server URL
 */
export function getServerUrl(): string | null {
  return localStorage.getItem('chynotes_server_url')
}

/**
 * Save server URL to localStorage
 */
export function saveServerUrl(url: string): void {
  localStorage.setItem('chynotes_server_url', url)
}

/**
 * Clear saved server URL
 */
export function clearServerUrl(): void {
  localStorage.removeItem('chynotes_server_url')
}

/**
 * Test connection to a server
 */
export async function testConnection(serverUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return { ok: false, error: `Server returned ${response.status}` }
    }

    const data = await response.json()
    if (data.status === 'ok') {
      return { ok: true }
    }

    return { ok: false, error: 'Invalid server response' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}
