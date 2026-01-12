/**
 * Backend interface - abstracts data layer for different platforms
 *
 * Implementations:
 * - ElectronBackend: Uses IPC (window.api) for desktop app
 * - RemoteBackend: Uses fetch() to talk to HTTP server
 */

// ============================================================================
// Types
// ============================================================================

export interface TagWithCount {
  id: number
  name: string
  prompt: string | null
  count: number
}

export interface TagOccurrence {
  block_id: string
  date: string
  line: number
  content: string
  indent_level: number
  children: TagOccurrence[]
}

export interface TagTreeNode {
  name: string
  displayName: string
  count: number
  prompt: string | null
  children: TagTreeNode[]
}

export interface TagCooccurrence {
  tag1: string
  tag2: string
  weight: number
}

export interface SemanticTagConnection {
  tag1: string
  tag2: string
  similarity: number
}

export type DocumentType = 'note' | 'page'

export interface SnapshotRecord {
  id: number
  note_date: string
  content: string
  created_at: number
  content_hash: string
  document_type: DocumentType
}

export interface SemanticResult {
  block_id: string
  note_date: string
  content: string
  distance: number
  similarity: number
}

export interface EmbeddingQueueStatus {
  queueLength: number
  isProcessing: boolean
  lastError: string | null
  processedCount: number
}

export interface EmbeddingStats {
  embeddedBlocks: number
  totalBlocks: number
  queueStatus: EmbeddingQueueStatus
  enabled: boolean
}

export interface EmbeddingModelStatus {
  available: boolean
  model: string
  error?: string
}

export interface BlockRecord {
  id: string
  note_date: string
  content: string
  parent_id: string | null
  indent_level: number
  line_number: number
  updated_at: number
  embedded_at: number | null
}

export interface TagSuggestion {
  term: string
  tag: string
  startIndex: number
  endIndex: number
  confidence: number
  reason: 'exact' | 'fuzzy' | 'frequency' | 'semantic'
}

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
  ready: boolean
  lastActivityAt: number | null
}

export interface SaveAssetResult {
  relativePath: string
  absolutePath: string
  hash: string
  isNew: boolean
}

export interface OllamaStatus {
  ok: boolean
  error?: string
  models?: string[]
}

export interface VaultAnalysis {
  vaultPath: string
  dailyNotes: Array<{
    relativePath: string
    absolutePath: string
    name: string
    size: number
    modifiedAt: Date
    isDailyNote: boolean
    date: string | null
    hasContent: boolean
  }>
  pagesWithContent: Array<{
    relativePath: string
    absolutePath: string
    name: string
    size: number
    modifiedAt: Date
    isDailyNote: boolean
    date: string | null
    hasContent: boolean
  }>
  emptyPages: Array<{
    relativePath: string
    absolutePath: string
    name: string
    size: number
    modifiedAt: Date
    isDailyNote: boolean
    date: string | null
    hasContent: boolean
  }>
  dailyNoteFormat: string
  totalFiles: number
  warnings: string[]
}

export interface ImportOptions {
  overwriteExisting: boolean
  normalizeTags: boolean
}

export interface ImportResult {
  dailyNotesImported: number
  dailyNotesSkipped: number
  pagesImported: number
  pagesSkipped: number
  errors: Array<{ file: string; error: string }>
  summary: string
}

// ============================================================================
// Backend Interface
// ============================================================================

export interface Backend {
  // Note operations
  readNote(dateISO: string): Promise<string | null>
  writeNote(dateISO: string, content: string): Promise<void>
  listNotes(): Promise<string[]>
  ensureNotesDirectory(): Promise<void>
  updateNoteLine(dateStr: string, lineNumber: number, newContent: string): Promise<void>

  // Page operations
  readPage(name: string): Promise<string | null>
  writePage(name: string, content: string): Promise<void>
  pageExists(name: string): Promise<boolean>
  createPage(name: string): Promise<boolean>
  listPages(): Promise<string[]>

  // Tag operations
  reindexAll(): Promise<number>
  getAllTags(): Promise<TagWithCount[]>
  getTagOccurrences(tagName: string): Promise<TagOccurrence[]>
  searchTags(query: string): Promise<TagWithCount[]>
  getTagTree(): Promise<TagTreeNode[]>
  getTagCooccurrences(): Promise<TagCooccurrence[]>
  getSemanticTagConnections(): Promise<SemanticTagConnection[]>

  // AI/Code generation operations
  generateTagPage(tagName: string): Promise<string>
  checkOllama(): Promise<OllamaStatus>
  listOllamaModels(): Promise<string[]>
  getTagPrompt(tagName: string): Promise<string>
  setTagPrompt(tagName: string, prompt: string): Promise<void>
  getCachedCode(tagName: string): Promise<string | null>

  // Settings operations
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>

  // Snapshot operations
  saveSnapshot(noteDate: string, content: string, documentType?: DocumentType): Promise<SnapshotRecord | null>
  getSnapshots(noteDate: string, documentType?: DocumentType): Promise<SnapshotRecord[]>
  getSnapshot(id: number): Promise<SnapshotRecord | null>
  getSnapshotCount(): Promise<number>
  pruneSnapshotsByAge(retentionDays: number): Promise<number>

  // Embedding operations
  findSemanticSimilar(tagName: string, limit?: number): Promise<SemanticResult[]>
  getEmbeddingStats(): Promise<EmbeddingStats>
  rebuildEmbeddings(): Promise<EmbeddingQueueStatus>
  setEmbeddingEnabled(enabled: boolean): Promise<boolean>
  checkEmbeddingModel(): Promise<EmbeddingModelStatus>
  listEmbeddingModels(): Promise<string[]>

  // Block operations
  getBlockById(id: string): Promise<BlockRecord | null>
  getBlockWithChildren(id: string): Promise<BlockRecord[]>

  // Tag suggestion operations
  getTagSuggestions(text: string, currentNoteDate?: string): Promise<TagSuggestion[]>
  retroactiveTag(term: string, tag: string, notes: string[]): Promise<number>

  // System status
  getSystemStatus(): Promise<SystemStatus>

  // Asset operations
  saveAsset(buffer: Uint8Array, originalName: string, dateStr: string): Promise<SaveAssetResult>
  resolveAssetPath(relativePath: string): Promise<string>
  getAssetUrl(relativePath: string): string
  isImageFile(filename: string): Promise<boolean>
  generateImageDescription(imageBase64: string): Promise<string>

  // Obsidian import operations (desktop only - may not be available)
  selectFolderDialog?(): Promise<string | null>
  analyzeObsidianVault?(vaultPath: string): Promise<VaultAnalysis>
  importObsidianVault?(vaultPath: string, options: ImportOptions): Promise<ImportResult>
}
