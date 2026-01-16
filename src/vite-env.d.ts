/// <reference types="vite/client" />

import type {
  TagWithCount,
  TagOccurrence,
  TagTreeNode,
  TagCooccurrence,
  SemanticTagConnection,
  DocumentType,
  SnapshotRecord,
  SemanticResult,
  EmbeddingQueueStatus,
  EmbeddingStats,
  EmbeddingModelStatus,
  BlockRecord,
  TagSuggestion,
  SystemStatus,
  SaveAssetResult,
  VaultAnalysis,
  ImportOptions,
  ImportResult,
  ServerStatus,
  TagPrompt,
} from './core/types'

declare global {
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

      // Snapshot operations (additional)
      getSnapshotCount: () => Promise<number>
      pruneSnapshotsByAge: (retentionDays: number) => Promise<number>

      // Block operations
      getBlockById: (id: string) => Promise<BlockRecord | null>
      getBlockWithChildren: (id: string) => Promise<BlockRecord[]>

      // Tag suggestion operations
      getTagSuggestions: (text: string, currentNoteDate?: string) => Promise<TagSuggestion[]>

      // Retroactive tagging
      retroactiveTag: (term: string, tag: string, notes: string[]) => Promise<number>

      // System status
      getSystemStatus: () => Promise<SystemStatus>

      // Asset operations
      saveAsset: (buffer: Uint8Array, originalName: string, dateStr: string) => Promise<SaveAssetResult>
      resolveAssetPath: (relativePath: string) => Promise<string>
      isImageFile: (filename: string) => Promise<boolean>
      generateImageDescription: (imageBase64: string) => Promise<string>

      // Obsidian import operations
      selectFolderDialog: () => Promise<string | null>
      analyzeObsidianVault: (vaultPath: string) => Promise<VaultAnalysis>
      importObsidianVault: (vaultPath: string, options: ImportOptions) => Promise<ImportResult>

      // Remote access server operations
      startServer: (port?: number) => Promise<ServerStatus>
      stopServer: () => Promise<void>
      getServerStatus: () => Promise<ServerStatus>

      // Tag prompt operations (custom AI prompts per tag)
      getTagPrompts: (tagName: string) => Promise<TagPrompt[]>
      createTagPrompt: (tagName: string, name: string, prompt: string) => Promise<TagPrompt>
      updateTagPrompt: (id: number, name: string, prompt: string) => Promise<TagPrompt | null>
      deleteTagPrompt: (id: number) => Promise<void>
      runTagPromptStreaming: (
        tagName: string,
        promptId: number,
        promptText: string,
        onToken: (token: string) => void,
        onComplete: (fullResponse: string) => void,
        onError: (error: string) => void
      ) => () => void
    }
  }
}

export {}
