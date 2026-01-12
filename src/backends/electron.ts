/**
 * Electron Backend
 *
 * Wraps window.api (Electron IPC) to implement the Backend interface.
 * Used by the desktop Electron app.
 */

import type {
  Backend,
  TagWithCount,
  TagOccurrence,
  TagTreeNode,
  TagCooccurrence,
  SemanticTagConnection,
  DocumentType,
  SnapshotRecord,
  SemanticResult,
  EmbeddingStats,
  EmbeddingQueueStatus,
  EmbeddingModelStatus,
  BlockRecord,
  TagSuggestion,
  SystemStatus,
  SaveAssetResult,
  OllamaStatus,
  VaultAnalysis,
  ImportOptions,
  ImportResult,
} from './interface'

// Type for window.api (from preload)
declare global {
  interface Window {
    api: {
      readNote: (dateISO: string) => Promise<string | null>
      writeNote: (dateISO: string, content: string) => Promise<void>
      listNotes: () => Promise<string[]>
      ensureNotesDirectory: () => Promise<void>
      readPage: (name: string) => Promise<string | null>
      writePage: (name: string, content: string) => Promise<void>
      pageExists: (name: string) => Promise<boolean>
      createPage: (name: string) => Promise<boolean>
      listPages: () => Promise<string[]>
      reindexAll: () => Promise<number>
      getAllTags: () => Promise<TagWithCount[]>
      getTagOccurrences: (tagName: string) => Promise<TagOccurrence[]>
      searchTags: (query: string) => Promise<TagWithCount[]>
      getTagTree: () => Promise<TagTreeNode[]>
      getTagCooccurrences: () => Promise<TagCooccurrence[]>
      getSemanticTagConnections: () => Promise<SemanticTagConnection[]>
      generateTagPage: (tagName: string) => Promise<string>
      checkOllama: () => Promise<OllamaStatus>
      listOllamaModels: () => Promise<string[]>
      getTagPrompt: (tagName: string) => Promise<string>
      setTagPrompt: (tagName: string, prompt: string) => Promise<void>
      getCachedCode: (tagName: string) => Promise<string | null>
      updateNoteLine: (dateStr: string, lineNumber: number, newContent: string) => Promise<void>
      getSetting: (key: string) => Promise<string | null>
      setSetting: (key: string, value: string) => Promise<void>
      saveSnapshot: (noteDate: string, content: string, documentType?: DocumentType) => Promise<SnapshotRecord | null>
      getSnapshots: (noteDate: string, documentType?: DocumentType) => Promise<SnapshotRecord[]>
      getSnapshot: (id: number) => Promise<SnapshotRecord | null>
      getSnapshotCount: () => Promise<number>
      pruneSnapshotsByAge: (retentionDays: number) => Promise<number>
      findSemanticSimilar: (tagName: string, limit?: number) => Promise<SemanticResult[]>
      getEmbeddingStats: () => Promise<EmbeddingStats>
      rebuildEmbeddings: () => Promise<EmbeddingQueueStatus>
      setEmbeddingEnabled: (enabled: boolean) => Promise<boolean>
      checkEmbeddingModel: () => Promise<EmbeddingModelStatus>
      listEmbeddingModels: () => Promise<string[]>
      getBlockById: (id: string) => Promise<BlockRecord | null>
      getBlockWithChildren: (id: string) => Promise<BlockRecord[]>
      getTagSuggestions: (text: string, currentNoteDate?: string) => Promise<TagSuggestion[]>
      retroactiveTag: (term: string, tag: string, notes: string[]) => Promise<number>
      getSystemStatus: () => Promise<SystemStatus>
      saveAsset: (buffer: Uint8Array, originalName: string, dateStr: string) => Promise<SaveAssetResult>
      resolveAssetPath: (relativePath: string) => Promise<string>
      isImageFile: (filename: string) => Promise<boolean>
      generateImageDescription: (imageBase64: string) => Promise<string>
      selectFolderDialog: () => Promise<string | null>
      analyzeObsidianVault: (vaultPath: string) => Promise<VaultAnalysis>
      importObsidianVault: (vaultPath: string, options: ImportOptions) => Promise<ImportResult>
    }
  }
}

export class ElectronBackend implements Backend {
  private get api() {
    if (typeof window === 'undefined' || !window.api) {
      throw new Error('ElectronBackend requires window.api (Electron preload)')
    }
    return window.api
  }

  // ============================================================================
  // Note operations
  // ============================================================================

  async readNote(dateISO: string): Promise<string | null> {
    return this.api.readNote(dateISO)
  }

  async writeNote(dateISO: string, content: string): Promise<void> {
    return this.api.writeNote(dateISO, content)
  }

  async listNotes(): Promise<string[]> {
    return this.api.listNotes()
  }

  async ensureNotesDirectory(): Promise<void> {
    return this.api.ensureNotesDirectory()
  }

  async updateNoteLine(dateStr: string, lineNumber: number, newContent: string): Promise<void> {
    return this.api.updateNoteLine(dateStr, lineNumber, newContent)
  }

  // ============================================================================
  // Page operations
  // ============================================================================

  async readPage(name: string): Promise<string | null> {
    return this.api.readPage(name)
  }

  async writePage(name: string, content: string): Promise<void> {
    return this.api.writePage(name, content)
  }

  async pageExists(name: string): Promise<boolean> {
    return this.api.pageExists(name)
  }

  async createPage(name: string): Promise<boolean> {
    return this.api.createPage(name)
  }

  async listPages(): Promise<string[]> {
    return this.api.listPages()
  }

  // ============================================================================
  // Tag operations
  // ============================================================================

  async reindexAll(): Promise<number> {
    return this.api.reindexAll()
  }

  async getAllTags(): Promise<TagWithCount[]> {
    return this.api.getAllTags()
  }

  async getTagOccurrences(tagName: string): Promise<TagOccurrence[]> {
    return this.api.getTagOccurrences(tagName)
  }

  async searchTags(query: string): Promise<TagWithCount[]> {
    return this.api.searchTags(query)
  }

  async getTagTree(): Promise<TagTreeNode[]> {
    return this.api.getTagTree()
  }

  async getTagCooccurrences(): Promise<TagCooccurrence[]> {
    return this.api.getTagCooccurrences()
  }

  async getSemanticTagConnections(): Promise<SemanticTagConnection[]> {
    return this.api.getSemanticTagConnections()
  }

  // ============================================================================
  // AI/Code generation operations
  // ============================================================================

  async generateTagPage(tagName: string): Promise<string> {
    return this.api.generateTagPage(tagName)
  }

  async checkOllama(): Promise<OllamaStatus> {
    return this.api.checkOllama()
  }

  async listOllamaModels(): Promise<string[]> {
    return this.api.listOllamaModels()
  }

  async getTagPrompt(tagName: string): Promise<string> {
    return this.api.getTagPrompt(tagName)
  }

  async setTagPrompt(tagName: string, prompt: string): Promise<void> {
    return this.api.setTagPrompt(tagName, prompt)
  }

  async getCachedCode(tagName: string): Promise<string | null> {
    return this.api.getCachedCode(tagName)
  }

  // ============================================================================
  // Settings operations
  // ============================================================================

  async getSetting(key: string): Promise<string | null> {
    return this.api.getSetting(key)
  }

  async setSetting(key: string, value: string): Promise<void> {
    return this.api.setSetting(key, value)
  }

  // ============================================================================
  // Snapshot operations
  // ============================================================================

  async saveSnapshot(noteDate: string, content: string, documentType: DocumentType = 'note'): Promise<SnapshotRecord | null> {
    return this.api.saveSnapshot(noteDate, content, documentType)
  }

  async getSnapshots(noteDate: string, documentType: DocumentType = 'note'): Promise<SnapshotRecord[]> {
    return this.api.getSnapshots(noteDate, documentType)
  }

  async getSnapshot(id: number): Promise<SnapshotRecord | null> {
    return this.api.getSnapshot(id)
  }

  async getSnapshotCount(): Promise<number> {
    return this.api.getSnapshotCount()
  }

  async pruneSnapshotsByAge(retentionDays: number): Promise<number> {
    return this.api.pruneSnapshotsByAge(retentionDays)
  }

  // ============================================================================
  // Embedding operations
  // ============================================================================

  async findSemanticSimilar(tagName: string, limit?: number): Promise<SemanticResult[]> {
    return this.api.findSemanticSimilar(tagName, limit)
  }

  async getEmbeddingStats(): Promise<EmbeddingStats> {
    return this.api.getEmbeddingStats()
  }

  async rebuildEmbeddings(): Promise<EmbeddingQueueStatus> {
    return this.api.rebuildEmbeddings()
  }

  async setEmbeddingEnabled(enabled: boolean): Promise<boolean> {
    return this.api.setEmbeddingEnabled(enabled)
  }

  async checkEmbeddingModel(): Promise<EmbeddingModelStatus> {
    return this.api.checkEmbeddingModel()
  }

  async listEmbeddingModels(): Promise<string[]> {
    return this.api.listEmbeddingModels()
  }

  // ============================================================================
  // Block operations
  // ============================================================================

  async getBlockById(id: string): Promise<BlockRecord | null> {
    return this.api.getBlockById(id)
  }

  async getBlockWithChildren(id: string): Promise<BlockRecord[]> {
    return this.api.getBlockWithChildren(id)
  }

  // ============================================================================
  // Tag suggestion operations
  // ============================================================================

  async getTagSuggestions(text: string, currentNoteDate?: string): Promise<TagSuggestion[]> {
    return this.api.getTagSuggestions(text, currentNoteDate)
  }

  async retroactiveTag(term: string, tag: string, notes: string[]): Promise<number> {
    return this.api.retroactiveTag(term, tag, notes)
  }

  // ============================================================================
  // System status
  // ============================================================================

  async getSystemStatus(): Promise<SystemStatus> {
    return this.api.getSystemStatus()
  }

  // ============================================================================
  // Asset operations
  // ============================================================================

  async saveAsset(buffer: Uint8Array, originalName: string, dateStr: string): Promise<SaveAssetResult> {
    return this.api.saveAsset(buffer, originalName, dateStr)
  }

  async resolveAssetPath(relativePath: string): Promise<string> {
    return this.api.resolveAssetPath(relativePath)
  }

  getAssetUrl(relativePath: string): string {
    // In Electron, assets are loaded from the local filesystem
    // We need to resolve to absolute path and use file:// protocol
    // For now, return the relative path - the component should call resolveAssetPath
    return relativePath
  }

  async isImageFile(filename: string): Promise<boolean> {
    return this.api.isImageFile(filename)
  }

  async generateImageDescription(imageBase64: string): Promise<string> {
    return this.api.generateImageDescription(imageBase64)
  }

  // ============================================================================
  // Obsidian import (desktop only)
  // ============================================================================

  async selectFolderDialog(): Promise<string | null> {
    return this.api.selectFolderDialog()
  }

  async analyzeObsidianVault(vaultPath: string): Promise<VaultAnalysis> {
    return this.api.analyzeObsidianVault(vaultPath)
  }

  async importObsidianVault(vaultPath: string, options: ImportOptions): Promise<ImportResult> {
    return this.api.importObsidianVault(vaultPath, options)
  }
}

/**
 * Create an Electron backend using window.api
 */
export function createElectronBackend(): Backend {
  return new ElectronBackend()
}
