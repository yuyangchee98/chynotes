import { useEffect, useState } from 'react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  theme: 'light' | 'dark' | 'system'
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void
}

export function SettingsModal({ isOpen, onClose, theme, onThemeChange }: SettingsModalProps) {
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [embeddingModel, setEmbeddingModel] = useState('nomic-embed-text')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [availableEmbeddingModels, setAvailableEmbeddingModels] = useState<string[]>([])
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null)
  const [isRebuildingEmbeddings, setIsRebuildingEmbeddings] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load settings on mount
  useEffect(() => {
    if (!isOpen) return

    const loadSettings = async () => {
      if (window.api) {
        const [endpoint, model, embedModel] = await Promise.all([
          window.api.getSetting('ollamaEndpoint'),
          window.api.getSetting('ollamaModel'),
          window.api.getSetting('embeddingModel'),
        ])
        if (endpoint) setOllamaEndpoint(endpoint)
        if (model) setOllamaModel(model)
        if (embedModel) setEmbeddingModel(embedModel)

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
      ])
    }
    setSaving(false)
    onClose()
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
                  placeholder="nomic-embed-text"
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Run <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ollama pull nomic-embed-text</code> to download
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
    </div>
  )
}
