import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for tag data
interface TagWithCount {
  id: number
  name: string
  prompt: string | null
  count: number
}

interface TagOccurrence {
  block_id: string
  date: string
  line: number
  content: string
  indent_level: number
  children: TagOccurrence[]
}

interface TagTreeNode {
  name: string
  displayName: string
  count: number
  prompt: string | null
  children: TagTreeNode[]
}

type DocumentType = 'note' | 'page'

interface SnapshotRecord {
  id: number
  note_date: string
  content: string
  created_at: number
  content_hash: string
  document_type: DocumentType
}

interface SemanticResult {
  block_id: string
  note_date: string
  content: string
  distance: number
  similarity: number
}

interface EmbeddingQueueStatus {
  queueLength: number
  isProcessing: boolean
  lastError: string | null
  processedCount: number
}

interface EmbeddingStats {
  embeddedBlocks: number
  totalBlocks: number
  queueStatus: EmbeddingQueueStatus
  enabled: boolean
}

interface EmbeddingModelStatus {
  available: boolean
  model: string
  error?: string
}

interface BlockRecord {
  id: string
  note_date: string
  content: string
  parent_id: string | null
  indent_level: number
  line_number: number
  updated_at: number
  embedded_at: number | null
}

interface TagSuggestion {
  term: string
  tag: string
  startIndex: number
  endIndex: number
  confidence: number
  reason: 'exact' | 'fuzzy' | 'frequency' | 'semantic'
}

contextBridge.exposeInMainWorld('api', {
  // Note operations
  readNote: (dateISO: string): Promise<string | null> => {
    return ipcRenderer.invoke('read-note', dateISO)
  },

  writeNote: (dateISO: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('write-note', dateISO, content)
  },

  listNotes: (): Promise<string[]> => {
    return ipcRenderer.invoke('list-notes')
  },

  ensureNotesDirectory: (): Promise<void> => {
    return ipcRenderer.invoke('ensure-notes-directory')
  },

  // Page operations
  readPage: (name: string): Promise<string | null> => {
    return ipcRenderer.invoke('read-page', name)
  },

  writePage: (name: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('write-page', name, content)
  },

  pageExists: (name: string): Promise<boolean> => {
    return ipcRenderer.invoke('page-exists', name)
  },

  createPage: (name: string): Promise<boolean> => {
    return ipcRenderer.invoke('create-page', name)
  },

  listPages: (): Promise<string[]> => {
    return ipcRenderer.invoke('list-pages')
  },

  // Tag operations
  reindexAll: (): Promise<number> => {
    return ipcRenderer.invoke('reindex-all')
  },

  getAllTags: (): Promise<TagWithCount[]> => {
    return ipcRenderer.invoke('get-all-tags')
  },

  getTagOccurrences: (tagName: string): Promise<TagOccurrence[]> => {
    return ipcRenderer.invoke('get-tag-occurrences', tagName)
  },

  searchTags: (query: string): Promise<TagWithCount[]> => {
    return ipcRenderer.invoke('search-tags', query)
  },

  getTagTree: (): Promise<TagTreeNode[]> => {
    return ipcRenderer.invoke('get-tag-tree')
  },

  // AI/Code generation operations
  generateTagPage: (tagName: string): Promise<string> => {
    return ipcRenderer.invoke('generate-tag-page', tagName)
  },

  checkOllama: (): Promise<{ ok: boolean; error?: string; models?: string[] }> => {
    return ipcRenderer.invoke('check-ollama')
  },

  listOllamaModels: (): Promise<string[]> => {
    return ipcRenderer.invoke('list-ollama-models')
  },

  getTagPrompt: (tagName: string): Promise<string> => {
    return ipcRenderer.invoke('get-tag-prompt', tagName)
  },

  setTagPrompt: (tagName: string, prompt: string): Promise<void> => {
    return ipcRenderer.invoke('set-tag-prompt', tagName, prompt)
  },

  getCachedCode: (tagName: string): Promise<string | null> => {
    return ipcRenderer.invoke('get-cached-code', tagName)
  },

  updateNoteLine: (dateStr: string, lineNumber: number, newContent: string): Promise<void> => {
    return ipcRenderer.invoke('update-note-line', dateStr, lineNumber, newContent)
  },

  // Settings operations
  getSetting: (key: string): Promise<string | null> => {
    return ipcRenderer.invoke('get-setting', key)
  },

  setSetting: (key: string, value: string): Promise<void> => {
    return ipcRenderer.invoke('set-setting', key, value)
  },

  // Snapshot operations
  saveSnapshot: (noteDate: string, content: string, documentType: DocumentType = 'note'): Promise<SnapshotRecord | null> => {
    return ipcRenderer.invoke('save-snapshot', noteDate, content, documentType)
  },

  getSnapshots: (noteDate: string, documentType: DocumentType = 'note'): Promise<SnapshotRecord[]> => {
    return ipcRenderer.invoke('get-snapshots', noteDate, documentType)
  },

  getSnapshot: (id: number): Promise<SnapshotRecord | null> => {
    return ipcRenderer.invoke('get-snapshot', id)
  },

  getSnapshotCount: (): Promise<number> => {
    return ipcRenderer.invoke('get-snapshot-count')
  },

  pruneSnapshotsByAge: (retentionDays: number): Promise<number> => {
    return ipcRenderer.invoke('prune-snapshots-by-age', retentionDays)
  },

  // Embedding operations
  findSemanticSimilar: (tagName: string, limit?: number): Promise<SemanticResult[]> => {
    return ipcRenderer.invoke('find-semantic-similar', tagName, limit)
  },

  getEmbeddingStats: (): Promise<EmbeddingStats> => {
    return ipcRenderer.invoke('get-embedding-stats')
  },

  rebuildEmbeddings: (): Promise<EmbeddingQueueStatus> => {
    return ipcRenderer.invoke('rebuild-embeddings')
  },

  setEmbeddingEnabled: (enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('set-embedding-enabled', enabled)
  },

  checkEmbeddingModel: (): Promise<EmbeddingModelStatus> => {
    return ipcRenderer.invoke('check-embedding-model')
  },

  listEmbeddingModels: (): Promise<string[]> => {
    return ipcRenderer.invoke('list-embedding-models')
  },

  // Block operations
  getBlockById: (id: string): Promise<BlockRecord | null> => {
    return ipcRenderer.invoke('get-block-by-id', id)
  },

  getBlockWithChildren: (id: string): Promise<BlockRecord[]> => {
    return ipcRenderer.invoke('get-block-with-children', id)
  },

  // Tag suggestion operations
  getTagSuggestions: (text: string, currentNoteDate?: string): Promise<TagSuggestion[]> => {
    return ipcRenderer.invoke('get-tag-suggestions', text, currentNoteDate)
  },

  // Retroactive tagging
  retroactiveTag: (term: string, tag: string, notes: string[]): Promise<number> => {
    return ipcRenderer.invoke('retroactive-tag', term, tag, notes)
  },
})
