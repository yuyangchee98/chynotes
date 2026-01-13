/**
 * Backend interface - abstracts data layer for different platforms
 *
 * Implementations:
 * - ElectronBackend: Uses IPC (window.api) for desktop app
 * - RemoteBackend: Uses fetch() to talk to HTTP server
 */

// Re-export all shared types for consumers
export * from '../core/types'

// Import types for use in Backend interface below
import type {
  TagWithCount,
  TagOccurrence,
  TagTreeNode,
  TagCooccurrence,
  SemanticTagConnection,
  TagSuggestion,
  DocumentType,
  SnapshotRecord,
  BlockRecord,
  SemanticResult,
  EmbeddingQueueStatus,
  EmbeddingStats,
  EmbeddingModelStatus,
  SystemStatus,
  SaveAssetResult,
  OllamaStatus,
  VaultAnalysis,
  ImportOptions,
  ImportResult,
} from '../core/types'

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
