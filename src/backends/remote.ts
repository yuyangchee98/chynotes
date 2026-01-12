/**
 * Remote Backend
 *
 * Connects to a Chynotes server via HTTP.
 * Used by web/mobile clients to access notes stored on another machine.
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
} from './interface'

export class RemoteBackend implements Backend {
  private baseUrl: string

  constructor(baseUrl: string) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // ============================================================================
  // Note operations
  // ============================================================================

  async readNote(dateISO: string): Promise<string | null> {
    const { content } = await this.fetch<{ content: string | null }>(`/api/notes/${dateISO}`)
    return content
  }

  async writeNote(dateISO: string, content: string): Promise<void> {
    await this.fetch(`/api/notes/${dateISO}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
  }

  async listNotes(): Promise<string[]> {
    return this.fetch<string[]>('/api/notes')
  }

  async ensureNotesDirectory(): Promise<void> {
    // No-op for remote - server handles this
  }

  async updateNoteLine(dateStr: string, lineNumber: number, newContent: string): Promise<void> {
    await this.fetch(`/api/notes/${dateStr}/line/${lineNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: newContent }),
    })
  }

  // ============================================================================
  // Page operations
  // ============================================================================

  async readPage(name: string): Promise<string | null> {
    const { content } = await this.fetch<{ content: string | null }>(`/api/pages/${encodeURIComponent(name)}`)
    return content
  }

  async writePage(name: string, content: string): Promise<void> {
    await this.fetch(`/api/pages/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
  }

  async pageExists(name: string): Promise<boolean> {
    const { exists } = await this.fetch<{ exists: boolean }>(`/api/pages/${encodeURIComponent(name)}/exists`)
    return exists
  }

  async createPage(name: string): Promise<boolean> {
    const { created } = await this.fetch<{ created: boolean }>(`/api/pages/${encodeURIComponent(name)}`, {
      method: 'POST',
    })
    return created
  }

  async listPages(): Promise<string[]> {
    return this.fetch<string[]>('/api/pages')
  }

  // ============================================================================
  // Tag operations
  // ============================================================================

  async reindexAll(): Promise<number> {
    const { count } = await this.fetch<{ count: number }>('/api/reindex', { method: 'POST' })
    return count
  }

  async getAllTags(): Promise<TagWithCount[]> {
    return this.fetch<TagWithCount[]>('/api/tags')
  }

  async getTagOccurrences(tagName: string): Promise<TagOccurrence[]> {
    return this.fetch<TagOccurrence[]>(`/api/tags/${encodeURIComponent(tagName)}/occurrences`)
  }

  async searchTags(query: string): Promise<TagWithCount[]> {
    return this.fetch<TagWithCount[]>(`/api/tags/search?q=${encodeURIComponent(query)}`)
  }

  async getTagTree(): Promise<TagTreeNode[]> {
    return this.fetch<TagTreeNode[]>('/api/tags/tree')
  }

  async getTagCooccurrences(): Promise<TagCooccurrence[]> {
    return this.fetch<TagCooccurrence[]>('/api/tags/cooccurrences')
  }

  async getSemanticTagConnections(): Promise<SemanticTagConnection[]> {
    return this.fetch<SemanticTagConnection[]>('/api/tags/semantic-connections')
  }

  // ============================================================================
  // AI/Code generation operations
  // ============================================================================

  async generateTagPage(tagName: string): Promise<string> {
    const { code } = await this.fetch<{ code: string }>(`/api/tags/${encodeURIComponent(tagName)}/generate`, {
      method: 'POST',
    })
    return code
  }

  async checkOllama(): Promise<OllamaStatus> {
    return this.fetch<OllamaStatus>('/api/ollama/status')
  }

  async listOllamaModels(): Promise<string[]> {
    return this.fetch<string[]>('/api/ollama/models')
  }

  async getTagPrompt(tagName: string): Promise<string> {
    const { prompt } = await this.fetch<{ prompt: string }>(`/api/tags/${encodeURIComponent(tagName)}/prompt`)
    return prompt
  }

  async setTagPrompt(tagName: string, prompt: string): Promise<void> {
    await this.fetch(`/api/tags/${encodeURIComponent(tagName)}/prompt`, {
      method: 'PUT',
      body: JSON.stringify({ prompt }),
    })
  }

  async getCachedCode(tagName: string): Promise<string | null> {
    const { code } = await this.fetch<{ code: string | null }>(`/api/tags/${encodeURIComponent(tagName)}/cached-code`)
    return code
  }

  // ============================================================================
  // Settings operations
  // ============================================================================

  async getSetting(key: string): Promise<string | null> {
    const { value } = await this.fetch<{ value: string | null }>(`/api/settings/${encodeURIComponent(key)}`)
    return value
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.fetch(`/api/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    })
  }

  // ============================================================================
  // Snapshot operations
  // ============================================================================

  async saveSnapshot(noteDate: string, content: string, documentType: DocumentType = 'note'): Promise<SnapshotRecord | null> {
    const { snapshot } = await this.fetch<{ snapshot: SnapshotRecord | null }>('/api/snapshots', {
      method: 'POST',
      body: JSON.stringify({ noteDate, content, documentType }),
    })
    return snapshot
  }

  async getSnapshots(noteDate: string, documentType: DocumentType = 'note'): Promise<SnapshotRecord[]> {
    return this.fetch<SnapshotRecord[]>(`/api/snapshots/${noteDate}?type=${documentType}`)
  }

  async getSnapshot(id: number): Promise<SnapshotRecord | null> {
    const { snapshot } = await this.fetch<{ snapshot: SnapshotRecord | null }>(`/api/snapshots/by-id/${id}`)
    return snapshot
  }

  async getSnapshotCount(): Promise<number> {
    const { count } = await this.fetch<{ count: number }>('/api/snapshots/count')
    return count
  }

  async pruneSnapshotsByAge(retentionDays: number): Promise<number> {
    const { deleted } = await this.fetch<{ deleted: number }>('/api/snapshots/prune', {
      method: 'DELETE',
      body: JSON.stringify({ retentionDays }),
    })
    return deleted
  }

  // ============================================================================
  // Embedding operations
  // ============================================================================

  async findSemanticSimilar(tagName: string, limit?: number): Promise<SemanticResult[]> {
    const query = limit ? `?limit=${limit}` : ''
    return this.fetch<SemanticResult[]>(`/api/embeddings/similar/${encodeURIComponent(tagName)}${query}`)
  }

  async getEmbeddingStats(): Promise<EmbeddingStats> {
    return this.fetch<EmbeddingStats>('/api/embeddings/stats')
  }

  async rebuildEmbeddings(): Promise<EmbeddingQueueStatus> {
    return this.fetch<EmbeddingQueueStatus>('/api/embeddings/rebuild', { method: 'POST' })
  }

  async setEmbeddingEnabled(enabled: boolean): Promise<boolean> {
    const result = await this.fetch<{ enabled: boolean }>('/api/embeddings/enabled', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    })
    return result.enabled
  }

  async checkEmbeddingModel(): Promise<EmbeddingModelStatus> {
    return this.fetch<EmbeddingModelStatus>('/api/embeddings/model/status')
  }

  async listEmbeddingModels(): Promise<string[]> {
    return this.fetch<string[]>('/api/embeddings/models')
  }

  // ============================================================================
  // Block operations
  // ============================================================================

  async getBlockById(id: string): Promise<BlockRecord | null> {
    const { block } = await this.fetch<{ block: BlockRecord | null }>(`/api/blocks/${encodeURIComponent(id)}`)
    return block
  }

  async getBlockWithChildren(id: string): Promise<BlockRecord[]> {
    return this.fetch<BlockRecord[]>(`/api/blocks/${encodeURIComponent(id)}/children`)
  }

  // ============================================================================
  // Tag suggestion operations
  // ============================================================================

  async getTagSuggestions(text: string, currentNoteDate?: string): Promise<TagSuggestion[]> {
    return this.fetch<TagSuggestion[]>('/api/suggestions', {
      method: 'POST',
      body: JSON.stringify({ text, currentNoteDate }),
    })
  }

  async retroactiveTag(term: string, tag: string, notes: string[]): Promise<number> {
    const { modifiedCount } = await this.fetch<{ modifiedCount: number }>('/api/retroactive-tag', {
      method: 'POST',
      body: JSON.stringify({ term, tag, notes }),
    })
    return modifiedCount
  }

  // ============================================================================
  // System status
  // ============================================================================

  async getSystemStatus(): Promise<SystemStatus> {
    return this.fetch<SystemStatus>('/api/system/status')
  }

  // ============================================================================
  // Asset operations
  // ============================================================================

  async saveAsset(buffer: Uint8Array, originalName: string, dateStr: string): Promise<SaveAssetResult> {
    return this.fetch<SaveAssetResult>('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        buffer: Array.from(buffer),
        originalName,
        dateStr,
      }),
    })
  }

  async resolveAssetPath(relativePath: string): Promise<string> {
    const { absolutePath } = await this.fetch<{ absolutePath: string }>(`/api/assets/resolve?path=${encodeURIComponent(relativePath)}`)
    return absolutePath
  }

  getAssetUrl(relativePath: string): string {
    // For remote backend, assets are served via HTTP
    return `${this.baseUrl}/${relativePath}`
  }

  async isImageFile(filename: string): Promise<boolean> {
    const { isImage } = await this.fetch<{ isImage: boolean }>(`/api/assets/is-image?filename=${encodeURIComponent(filename)}`)
    return isImage
  }

  async generateImageDescription(imageBase64: string): Promise<string> {
    const { description } = await this.fetch<{ description: string }>('/api/assets/describe', {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
    })
    return description
  }

  // ============================================================================
  // Obsidian import (not available on remote)
  // ============================================================================

  // These are intentionally not implemented for remote backend
  // The server doesn't expose folder dialogs to remote clients
}

/**
 * Create a remote backend connected to a Chynotes server
 */
export function createRemoteBackend(serverUrl: string): Backend {
  return new RemoteBackend(serverUrl)
}
