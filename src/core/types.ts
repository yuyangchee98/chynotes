/**
 * Shared types used across frontend and electron backends
 * This file is the single source of truth for all data types
 */

// ============================================================================
// Tag Types
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

export interface TagSuggestion {
  term: string
  tag: string
  startIndex: number
  endIndex: number
  confidence: number
  reason: 'exact' | 'fuzzy' | 'frequency' | 'semantic'
}

// ============================================================================
// Document Types
// ============================================================================

export type DocumentType = 'note' | 'page'

export interface SnapshotRecord {
  id: number
  note_date: string
  content: string
  created_at: number
  content_hash: string
  document_type: DocumentType
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

// ============================================================================
// Embedding Types
// ============================================================================

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

// ============================================================================
// System Types
// ============================================================================

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

// ============================================================================
// Import Types
// ============================================================================

export interface ObsidianFile {
  relativePath: string
  absolutePath: string
  name: string
  size: number
  modifiedAt: Date
  isDailyNote: boolean
  date: string | null
  hasContent: boolean
}

export interface VaultAnalysis {
  vaultPath: string
  dailyNotes: ObsidianFile[]
  pagesWithContent: ObsidianFile[]
  emptyPages: ObsidianFile[]
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
// Server Types
// ============================================================================

export interface ServerStatus {
  running: boolean
  port: number
  localUrl: string | null
  tailscaleUrl: string | null
  lanAddresses: string[]
}

// ============================================================================
// Tag Prompt Types
// ============================================================================

export interface TagPrompt {
  id: number
  tag_id: number
  name: string
  prompt: string
  response: string | null
  updated_at: number | null
}
