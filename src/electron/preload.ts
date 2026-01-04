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

interface SnapshotRecord {
  id: number
  note_date: string
  content: string
  created_at: number
  content_hash: string
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
  saveSnapshot: (noteDate: string, content: string): Promise<SnapshotRecord | null> => {
    return ipcRenderer.invoke('save-snapshot', noteDate, content)
  },

  getSnapshots: (noteDate: string): Promise<SnapshotRecord[]> => {
    return ipcRenderer.invoke('get-snapshots', noteDate)
  },

  getSnapshot: (id: number): Promise<SnapshotRecord | null> => {
    return ipcRenderer.invoke('get-snapshot', id)
  },
})
