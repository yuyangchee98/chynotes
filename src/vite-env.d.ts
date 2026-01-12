/// <reference types="vite/client" />

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

interface TagCooccurrence {
  tag1: string
  tag2: string
  weight: number
}

interface SemanticTagConnection {
  tag1: string
  tag2: string
  similarity: number
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

interface Window {
  api: {
    // Note operations
    readNote: (dateISO: string) => Promise<string | null>
    writeNote: (dateISO: string, content: string) => Promise<void>
    listNotes: () => Promise<string[]>
    ensureNotesDirectory: () => Promise<void>

    // Page operations
    readPage: (name: string) => Promise<string | null>
    writePage: (name: string, content: string) => Promise<void>
    pageExists: (name: string) => Promise<boolean>
    createPage: (name: string) => Promise<boolean>
    listPages: () => Promise<string[]>

    // Tag operations
    reindexAll: () => Promise<number>
    getAllTags: () => Promise<TagWithCount[]>
    getTagOccurrences: (tagName: string) => Promise<TagOccurrence[]>
    searchTags: (query: string) => Promise<TagWithCount[]>
    getTagTree: () => Promise<TagTreeNode[]>
    getTagCooccurrences: () => Promise<TagCooccurrence[]>
    getSemanticTagConnections: () => Promise<SemanticTagConnection[]>

    // AI/Code generation operations
    generateTagPage: (tagName: string) => Promise<string>
    checkOllama: () => Promise<{ ok: boolean; error?: string; models?: string[] }>
    listOllamaModels: () => Promise<string[]>
    getTagPrompt: (tagName: string) => Promise<string>
    setTagPrompt: (tagName: string, prompt: string) => Promise<void>
    getCachedCode: (tagName: string) => Promise<string | null>
    updateNoteLine: (dateStr: string, lineNumber: number, newContent: string) => Promise<void>

    // Settings operations
    getSetting: (key: string) => Promise<string | null>
    setSetting: (key: string, value: string) => Promise<void>

    // Snapshot operations
    saveSnapshot: (noteDate: string, content: string, documentType?: DocumentType) => Promise<SnapshotRecord | null>
    getSnapshots: (noteDate: string, documentType?: DocumentType) => Promise<SnapshotRecord[]>
    getSnapshot: (id: number) => Promise<SnapshotRecord | null>

    // Embedding operations
    findSemanticSimilar: (tagName: string, limit?: number) => Promise<SemanticResult[]>
    getEmbeddingStats: () => Promise<EmbeddingStats>
    rebuildEmbeddings: () => Promise<EmbeddingQueueStatus>
    setEmbeddingEnabled: (enabled: boolean) => Promise<boolean>
    checkEmbeddingModel: () => Promise<EmbeddingModelStatus>
    listEmbeddingModels: () => Promise<string[]>
  }
}
