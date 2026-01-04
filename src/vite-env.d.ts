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
}

interface TagTreeNode {
  name: string
  displayName: string
  count: number
  prompt: string | null
  children: TagTreeNode[]
}

interface SnapshotRecord {
  id: number
  note_date: string
  content: string
  created_at: number
  content_hash: string
}

interface Window {
  api: {
    // Note operations
    readNote: (dateISO: string) => Promise<string | null>
    writeNote: (dateISO: string, content: string) => Promise<void>
    listNotes: () => Promise<string[]>
    ensureNotesDirectory: () => Promise<void>

    // Tag operations
    reindexAll: () => Promise<number>
    getAllTags: () => Promise<TagWithCount[]>
    getTagOccurrences: (tagName: string) => Promise<TagOccurrence[]>
    searchTags: (query: string) => Promise<TagWithCount[]>
    getTagTree: () => Promise<TagTreeNode[]>

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
    saveSnapshot: (noteDate: string, content: string) => Promise<SnapshotRecord | null>
    getSnapshots: (noteDate: string) => Promise<SnapshotRecord[]>
    getSnapshot: (id: number) => Promise<SnapshotRecord | null>
  }
}
