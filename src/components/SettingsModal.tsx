import { useEffect, useState } from 'react'
import { KeyCapture } from './KeyCapture'
import {
  ShortcutAction,
  KeyBinding,
  DEFAULT_SHORTCUTS,
  loadCustomBindings,
  saveCustomBindings,
  formatKeyBinding,
  getBinding,
} from '../core/keyboard-config'
import type { EmbeddingStats, ServerStatus } from '../core/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  theme: 'light' | 'dark' | 'system'
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void
}

export function SettingsModal({ isOpen, onClose, theme, onThemeChange }: SettingsModalProps) {
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [embeddingModel, setEmbeddingModel] = useState('mxbai-embed-large')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [availableEmbeddingModels, setAvailableEmbeddingModels] = useState<string[]>([])
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null)
  const [isRebuildingEmbeddings, setIsRebuildingEmbeddings] = useState(false)
  const [saving, setSaving] = useState(false)

  // Snapshot settings
  const [snapshotInterval, setSnapshotInterval] = useState('1000')
  const [snapshotRetentionDays, setSnapshotRetentionDays] = useState('0')
  const [snapshotAutoCleanup, setSnapshotAutoCleanup] = useState(false)
  const [snapshotCount, setSnapshotCount] = useState(0)
  const [isCleaningSnapshots, setIsCleaningSnapshots] = useState(false)

  // Keyboard shortcuts
  const [customBindings, setCustomBindings] = useState<Record<string, KeyBinding>>({})
  const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null)

  // Remote access server state
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)
  const [isTogglingServer, setIsTogglingServer] = useState(false)

  // Import state
  const [importVaultPath, setImportVaultPath] = useState<string | null>(null)
  const [importAnalysis, setImportAnalysis] = useState<{
    dailyNotes: number
    pagesWithContent: number
    emptyPages: number
    warnings: string[]
  } | null>(null)
  const [importOptions, setImportOptions] = useState({
    overwriteExisting: false,
    normalizeTags: true,
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    if (!isOpen) return

    const loadSettings = async () => {
      if (window.api) {
        const [endpoint, model, embedModel, snapInterval, snapRetention, snapCleanup, snapCount, keyBindings] = await Promise.all([
          window.api.getSetting('ollamaEndpoint'),
          window.api.getSetting('ollamaModel'),
          window.api.getSetting('embeddingModel'),
          window.api.getSetting('snapshotInterval'),
          window.api.getSetting('snapshotRetentionDays'),
          window.api.getSetting('snapshotAutoCleanup'),
          window.api.getSnapshotCount(),
          window.api.getSetting('keyboardBindings'),
        ])
        if (endpoint) setOllamaEndpoint(endpoint)
        if (model) setOllamaModel(model)
        if (embedModel) setEmbeddingModel(embedModel)
        setSnapshotInterval(snapInterval || '1000')
        setSnapshotRetentionDays(snapRetention || '0')
        setSnapshotAutoCleanup(snapCleanup === 'true')
        setSnapshotCount(snapCount)
        setCustomBindings(loadCustomBindings(keyBindings))

        // Check Ollama connection
        checkOllama()

        // Load embedding stats
        loadEmbeddingStats()
      }
    }
    loadSettings()
  }, [isOpen])

  const loadEmbeddingStats = async () => {
    if (window.api?.getEmbeddingStats) {
      const stats = await window.api.getEmbeddingStats()
      setEmbeddingStats(stats)
    }
  }

  const loadServerStatus = async () => {
    if (window.api?.getServerStatus) {
      const status = await window.api.getServerStatus()
      setServerStatus(status)
    }
  }

  // Load server status on mount
  useEffect(() => {
    if (isOpen) {
      loadServerStatus()
    }
  }, [isOpen])

  const handleToggleServer = async () => {
    if (!window.api) return
    setIsTogglingServer(true)
    try {
      if (serverStatus?.running) {
        await window.api.stopServer()
      } else {
        await window.api.startServer(60008)
      }
      await loadServerStatus()
    } catch (err) {
      console.error('Failed to toggle server:', err)
    } finally {
      setIsTogglingServer(false)
    }
  }

  const loadEmbeddingModels = async () => {
    if (window.api?.listEmbeddingModels) {
      const models = await window.api.listEmbeddingModels()
      setAvailableEmbeddingModels(models)
    }
  }

  const checkOllama = async () => {
    setOllamaStatus('checking')
    try {
      const result = await window.api.checkOllama()
      if (result.ok) {
        setOllamaStatus('connected')
        setAvailableModels(result.models || [])
        // Also load embedding models
        loadEmbeddingModels()
      } else {
        setOllamaStatus('error')
      }
    } catch {
      setOllamaStatus('error')
    }
  }

  const handleRebuildEmbeddings = async () => {
    setIsRebuildingEmbeddings(true)
    try {
      if (window.api?.rebuildEmbeddings) {
        await window.api.rebuildEmbeddings()
        // Refresh stats
        loadEmbeddingStats()
      }
    } finally {
      setIsRebuildingEmbeddings(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    if (window.api) {
      await Promise.all([
        window.api.setSetting('ollamaEndpoint', ollamaEndpoint),
        window.api.setSetting('ollamaModel', ollamaModel),
        window.api.setSetting('embeddingModel', embeddingModel),
        window.api.setSetting('snapshotInterval', snapshotInterval),
        window.api.setSetting('snapshotRetentionDays', snapshotRetentionDays),
        window.api.setSetting('snapshotAutoCleanup', snapshotAutoCleanup ? 'true' : 'false'),
        window.api.setSetting('keyboardBindings', saveCustomBindings(customBindings)),
      ])
    }
    setSaving(false)
    onClose()
  }

  const handleEditShortcut = (action: ShortcutAction) => {
    setEditingAction(action)
  }

  const handleSaveShortcut = (binding: KeyBinding) => {
    if (editingAction) {
      setCustomBindings({
        ...customBindings,
        [editingAction]: binding,
      })
    }
    setEditingAction(null)
  }

  const handleResetShortcuts = () => {
    if (confirm('Reset all keyboard shortcuts to defaults?')) {
      setCustomBindings({})
    }
  }

  const handleCleanupSnapshots = async () => {
    setIsCleaningSnapshots(true)
    try {
      if (window.api?.pruneSnapshotsByAge) {
        const days = parseInt(snapshotRetentionDays)
        if (days > 0) {
          const deletedCount = await window.api.pruneSnapshotsByAge(days)
          const newCount = await window.api.getSnapshotCount()
          setSnapshotCount(newCount)
          alert(`Deleted ${deletedCount} old snapshots`)
        }
      }
    } finally {
      setIsCleaningSnapshots(false)
    }
  }

  const handleSelectVault = async () => {
    if (!window.api?.selectFolderDialog) return
    const path = await window.api.selectFolderDialog()
    if (path) {
      setImportVaultPath(path)
      setImportAnalysis(null)
      setImportResult(null)
      // Auto-analyze
      handleAnalyzeVault(path)
    }
  }

  const handleAnalyzeVault = async (path: string) => {
    if (!window.api?.analyzeObsidianVault) return
    setIsAnalyzing(true)
    try {
      const analysis = await window.api.analyzeObsidianVault(path)
      setImportAnalysis({
        dailyNotes: analysis.dailyNotes.length,
        pagesWithContent: analysis.pagesWithContent.length,
        emptyPages: analysis.emptyPages.length,
        warnings: analysis.warnings,
      })
    } catch (err) {
      alert(`Failed to analyze vault: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleImportVault = async () => {
    if (!window.api?.importObsidianVault || !importVaultPath) return
    setIsImporting(true)
    setImportResult(null)
    try {
      const result = await window.api.importObsidianVault(importVaultPath, importOptions)
      setImportResult(result.summary)
      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors)
      }
    } catch (err) {
      setImportResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsImporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Appearance */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Appearance</h3>
            <div className="space-y-2">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Theme</label>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onThemeChange(t)}
                    className={`px-4 py-2 text-sm rounded-md border ${
                      theme === t
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* AI / Ollama */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">AI (Ollama)</h3>

            {/* Connection status */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${
                ollamaStatus === 'connected' ? 'bg-green-500' :
                ollamaStatus === 'error' ? 'bg-red-500' :
                'bg-yellow-500 animate-pulse'
              }`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {ollamaStatus === 'connected' && 'Connected to Ollama'}
                {ollamaStatus === 'error' && 'Ollama not available'}
                {ollamaStatus === 'checking' && 'Checking connection...'}
              </span>
              <button
                onClick={checkOllama}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                Refresh
              </button>
            </div>

            {/* Endpoint */}
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Endpoint</label>
              <input
                type="text"
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="http://localhost:11434"
              />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Model</label>
              {availableModels.length > 0 ? (
                <select
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="llama3.2"
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Run <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ollama pull llama3.2</code> to download a model
              </p>
            </div>
          </section>

          {/* Semantic Search / Embeddings */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Semantic Search</h3>

            {/* Embedding Model */}
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Embedding Model</label>
              {availableEmbeddingModels.length > 0 ? (
                <select
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableEmbeddingModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="mxbai-embed-large"
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Run <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ollama pull mxbai-embed-large</code> to download
              </p>
            </div>

            {/* Embedding Stats */}
            {embeddingStats && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Embedded blocks</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {embeddingStats.embeddedBlocks} / {embeddingStats.totalBlocks}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{
                      width: `${embeddingStats.totalBlocks > 0
                        ? (embeddingStats.embeddedBlocks / embeddingStats.totalBlocks) * 100
                        : 0}%`
                    }}
                  />
                </div>

                {/* Queue status */}
                {embeddingStats.queueStatus.isProcessing && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Processing... {embeddingStats.queueStatus.queueLength} remaining
                    </span>
                  </div>
                )}

                {embeddingStats.queueStatus.lastError && (
                  <p className="text-xs text-red-500">
                    Error: {embeddingStats.queueStatus.lastError}
                  </p>
                )}

                {/* Rebuild button */}
                <button
                  onClick={handleRebuildEmbeddings}
                  disabled={isRebuildingEmbeddings}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  {isRebuildingEmbeddings ? 'Rebuilding...' : 'Rebuild All Embeddings'}
                </button>
              </div>
            )}
          </section>

          {/* Snapshots */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Snapshots</h3>

            {/* Auto-save interval */}
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Auto-save delay</label>
              <select
                value={snapshotInterval}
                onChange={(e) => setSnapshotInterval(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="500">0.5 seconds</option>
                <option value="1000">1 second (default)</option>
                <option value="2000">2 seconds</option>
                <option value="3000">3 seconds</option>
                <option value="5000">5 seconds</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Time to wait after typing stops before creating snapshot
              </p>
            </div>

            {/* Retention period */}
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Keep snapshots for</label>
              <select
                value={snapshotRetentionDays}
                onChange={(e) => setSnapshotRetentionDays(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">All time (default)</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Older snapshots will be automatically deleted if auto-cleanup is enabled
              </p>
            </div>

            {/* Auto-cleanup toggle */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="auto-cleanup"
                checked={snapshotAutoCleanup}
                onChange={(e) => setSnapshotAutoCleanup(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="auto-cleanup" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                Enable automatic cleanup on app startup
              </label>
            </div>

            {/* Snapshot statistics */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Total snapshots: <span className="font-semibold">{snapshotCount.toLocaleString()}</span>
              </p>
              <button
                onClick={handleCleanupSnapshots}
                disabled={isCleaningSnapshots || parseInt(snapshotRetentionDays) === 0}
                className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCleaningSnapshots ? 'Cleaning up...' : 'Clean up old snapshots now'}
              </button>
              {parseInt(snapshotRetentionDays) === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Set a retention period to enable manual cleanup
                </p>
              )}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h3>
              <button
                onClick={handleResetShortcuts}
                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
              >
                Reset to Defaults
              </button>
            </div>

            {/* Editable shortcuts */}
            {DEFAULT_SHORTCUTS.filter(s => s.category === 'navigation').length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Navigation</h4>
                <div className="space-y-2">
                  {DEFAULT_SHORTCUTS.filter(s => s.category === 'navigation').map((shortcut) => {
                    const binding = getBinding(shortcut.action, customBindings)
                    return (
                      <div key={shortcut.action} className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{shortcut.label}</span>
                        <div className="flex items-center gap-2">
                          <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
                            {formatKeyBinding(binding)}
                          </kbd>
                          <button
                            onClick={() => handleEditShortcut(shortcut.action)}
                            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Formatting shortcuts */}
            {DEFAULT_SHORTCUTS.filter(s => s.category === 'formatting').length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Text Formatting</h4>
                <div className="space-y-2">
                  {DEFAULT_SHORTCUTS.filter(s => s.category === 'formatting').map((shortcut) => {
                    const binding = getBinding(shortcut.action, customBindings)
                    return (
                      <div key={shortcut.action} className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{shortcut.label}</span>
                        <div className="flex items-center gap-2">
                          <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
                            {formatKeyBinding(binding)}
                          </kbd>
                          <button
                            onClick={() => handleEditShortcut(shortcut.action)}
                            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Non-customizable shortcuts */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Bullet Editing (Fixed)</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded opacity-75">
                  <span className="text-sm text-gray-700 dark:text-gray-300">New Bullet</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Enter</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded opacity-75">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Line Break (within bullet)</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Shift+Enter</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded opacity-75">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Indent</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Tab</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded opacity-75">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Outdent</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Shift+Tab</kbd>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">These shortcuts cannot be customized</p>
            </div>

            {/* Tag suggestions */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Tag Suggestions (Fixed)</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded opacity-75">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Accept Suggestion</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Tab</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded opacity-75">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Navigate Suggestions</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">↑ / ↓</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 px-3 bg-gray-50 dark:bg-gray-800 rounded opacity-75">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Dismiss</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">Esc</kbd>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">These shortcuts cannot be customized</p>
            </div>
          </section>

          {/* Storage */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Storage</h3>
            <div className="space-y-2">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Notes directory</label>
              <div className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md font-mono">
                ~/.chynotes/notes/
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your notes are stored as plain markdown files
              </p>
            </div>
          </section>

          {/* Remote Access */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Remote Access</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Enable remote access to view and edit your notes from your phone or other devices.
            </p>

            {/* Server toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  serverStatus?.running ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {serverStatus?.running ? 'Server running' : 'Server stopped'}
                </span>
              </div>
              <button
                onClick={handleToggleServer}
                disabled={isTogglingServer}
                className={`px-4 py-2 text-sm rounded-md ${
                  serverStatus?.running
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                } disabled:opacity-50`}
              >
                {isTogglingServer ? 'Please wait...' : serverStatus?.running ? 'Stop Server' : 'Start Server'}
              </button>
            </div>

            {/* Connection URLs */}
            {serverStatus?.running && (
              <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                {serverStatus.tailscaleUrl && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Tailscale URL (use this on your phone)
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded font-mono text-green-600 dark:text-green-400 truncate">
                        {serverStatus.tailscaleUrl}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(serverStatus.tailscaleUrl!)}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {!serverStatus.tailscaleUrl && serverStatus.lanAddresses.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Local Network URL
                    </label>
                    <code className="block px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded font-mono truncate">
                      {serverStatus.lanAddresses[0]}
                    </code>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Local URL
                  </label>
                  <code className="block px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded font-mono truncate">
                    {serverStatus.localUrl}
                  </code>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Port: {serverStatus.port}
                </p>
              </div>
            )}

            {!serverStatus?.running && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Start the server to access your notes from other devices via Tailscale or your local network.
              </p>
            )}
          </section>

          {/* Import from Obsidian */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Import from Obsidian</h3>

            {/* Vault selector */}
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Vault folder</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md font-mono truncate">
                  {importVaultPath || 'No vault selected'}
                </div>
                <button
                  onClick={handleSelectVault}
                  disabled={isAnalyzing || isImporting}
                  className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Browse...
                </button>
              </div>
            </div>

            {/* Analysis results */}
            {isAnalyzing && (
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Analyzing vault...
              </div>
            )}

            {importAnalysis && !isAnalyzing && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md space-y-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{importAnalysis.dailyNotes}</span> daily notes
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{importAnalysis.pagesWithContent}</span> pages with content
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {importAnalysis.emptyPages} empty pages (will skip)
                </p>
                {importAnalysis.warnings.map((warning, i) => (
                  <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">
                    {warning}
                  </p>
                ))}
              </div>
            )}

            {/* Import options */}
            {importAnalysis && !isAnalyzing && (
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="normalize-tags"
                    checked={importOptions.normalizeTags}
                    onChange={(e) => setImportOptions({ ...importOptions, normalizeTags: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="normalize-tags" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    Normalize tags (<code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">Page Name</code> → <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">page-name</code>)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="overwrite-existing"
                    checked={importOptions.overwriteExisting}
                    onChange={(e) => setImportOptions({ ...importOptions, overwriteExisting: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="overwrite-existing" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    Overwrite existing notes
                  </label>
                </div>
              </div>
            )}

            {/* Import button */}
            {importAnalysis && !isAnalyzing && (
              <button
                onClick={handleImportVault}
                disabled={isImporting || (importAnalysis.dailyNotes === 0 && importAnalysis.pagesWithContent === 0)}
                className="w-full px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            )}

            {/* Import result */}
            {importResult && (
              <div className={`mt-3 p-3 rounded-md text-sm ${
                importResult.startsWith('Error')
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              }`}>
                {importResult}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Key capture modal */}
      {editingAction && (
        <KeyCapture
          currentBinding={getBinding(editingAction, customBindings)}
          onSave={handleSaveShortcut}
          onCancel={() => setEditingAction(null)}
        />
      )}
    </div>
  )
}
