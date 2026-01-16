import { useEffect, useState, useCallback, useRef } from 'react'
import { Sparkles, Plus, Play, Trash2, ChevronDown, ChevronRight, Pencil, X, Check, Loader2 } from 'lucide-react'
import type { TagPrompt } from '../core/types'

interface TagPromptsProps {
  pageName: string
}

const DEFAULT_PROMPT = `Summarize the key themes and insights from these notes.
Highlight any action items, decisions, or important patterns.`

interface PromptItemProps {
  prompt: TagPrompt
  pageName: string
  onUpdate: (id: number, name: string, promptText: string) => void
  onDelete: (id: number) => void
  onResponseUpdate: (id: number, response: string) => void
}

function PromptItem({ prompt, pageName, onUpdate, onDelete, onResponseUpdate }: PromptItemProps) {
  const [isExpanded, setIsExpanded] = useState(!!prompt.response)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(prompt.name)
  const [editPrompt, setEditPrompt] = useState(prompt.prompt)
  const [isRunning, setIsRunning] = useState(false)
  const [streamedResponse, setStreamedResponse] = useState(prompt.response || '')
  const cleanupRef = useRef<(() => void) | null>(null)

  const handleRun = useCallback(() => {
    if (!window.api?.runTagPromptStreaming) return

    setIsRunning(true)
    setIsExpanded(true)
    setStreamedResponse('')

    cleanupRef.current = window.api.runTagPromptStreaming(
      pageName,
      prompt.id,
      prompt.prompt,
      (token) => {
        setStreamedResponse(prev => prev + token)
      },
      (fullResponse) => {
        setIsRunning(false)
        setStreamedResponse(fullResponse)
        onResponseUpdate(prompt.id, fullResponse)
      },
      (error) => {
        setIsRunning(false)
        setStreamedResponse(`Error: ${error}`)
      }
    )
  }, [pageName, prompt.id, prompt.prompt, onResponseUpdate])

  const handleSaveEdit = () => {
    onUpdate(prompt.id, editName, editPrompt)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditName(prompt.name)
    setEditPrompt(prompt.prompt)
    setIsEditing(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  const displayResponse = isRunning ? streamedResponse : (prompt.response || streamedResponse)

  return (
    <div
      className="rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
          style={{ color: 'var(--text-muted)' }}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-2 py-1 rounded text-sm"
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
            autoFocus
          />
        ) : (
          <span
            className="flex-1 font-medium text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            {prompt.name}
          </span>
        )}

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveEdit}
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--accent)' }}
                title="Save"
              >
                <Check size={14} />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                style={{ color: 'var(--accent)' }}
                title="Run prompt"
              >
                {isRunning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(prompt.id)}
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Prompt text */}
          {isEditing ? (
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded text-sm resize-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              placeholder="Enter your prompt..."
            />
          ) : (
            <div
              className="text-xs px-3 py-2 rounded"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-muted)',
              }}
            >
              {prompt.prompt}
            </div>
          )}

          {/* Response */}
          {displayResponse && (
            <div
              className="text-sm px-3 py-2 rounded prose prose-sm max-w-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                whiteSpace: 'pre-wrap',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              {displayResponse}
              {isRunning && <span className="animate-pulse">▊</span>}
            </div>
          )}

          {/* Empty state */}
          {!displayResponse && !isEditing && (
            <div
              className="text-sm text-center py-4"
              style={{ color: 'var(--text-muted)' }}
            >
              Click <Play size={12} className="inline" /> to run this prompt
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TagPrompts({ pageName }: TagPromptsProps) {
  const [prompts, setPrompts] = useState<TagPrompt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrompt, setNewPrompt] = useState(DEFAULT_PROMPT)

  // Load prompts
  useEffect(() => {
    const loadPrompts = async () => {
      setIsLoading(true)
      if (window.api?.getTagPrompts) {
        try {
          const result = await window.api.getTagPrompts(pageName)
          setPrompts(result)
        } catch (err) {
          console.error('Failed to load tag prompts:', err)
        }
      }
      setIsLoading(false)
    }
    loadPrompts()
  }, [pageName])

  const handleAddPrompt = async () => {
    if (!window.api?.createTagPrompt || !newName.trim()) return

    try {
      const created = await window.api.createTagPrompt(pageName, newName.trim(), newPrompt.trim())
      setPrompts(prev => [...prev, created])
      setNewName('')
      setNewPrompt(DEFAULT_PROMPT)
      setIsAdding(false)
    } catch (err) {
      console.error('Failed to create prompt:', err)
    }
  }

  const handleUpdatePrompt = async (id: number, name: string, promptText: string) => {
    if (!window.api?.updateTagPrompt) return

    try {
      const updated = await window.api.updateTagPrompt(id, name, promptText)
      if (updated) {
        setPrompts(prev => prev.map(p => p.id === id ? updated : p))
      }
    } catch (err) {
      console.error('Failed to update prompt:', err)
    }
  }

  const handleDeletePrompt = async (id: number) => {
    if (!window.api?.deleteTagPrompt) return

    try {
      await window.api.deleteTagPrompt(id)
      setPrompts(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Failed to delete prompt:', err)
    }
  }

  const handleResponseUpdate = (id: number, response: string) => {
    setPrompts(prev => prev.map(p =>
      p.id === id ? { ...p, response } : p
    ))
  }

  if (isLoading) {
    return (
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading prompts...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2"
          style={{ color: 'var(--text-muted)' }}
        >
          <Sparkles size={14} />
          AI Prompts
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
          style={{ color: 'var(--text-muted)' }}
          title="Add prompt"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {/* Add new prompt form */}
        {isAdding && (
          <div
            className="rounded-lg border p-3 space-y-3"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--accent)',
            }}
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Prompt name (e.g., Summarize, Action Items)"
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              autoFocus
            />
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={3}
              placeholder="Enter your prompt..."
              className="w-full px-3 py-2 rounded text-sm resize-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAdding(false)
                  setNewName('')
                  setNewPrompt(DEFAULT_PROMPT)
                }}
                className="px-3 py-1.5 rounded text-sm"
                style={{
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-tertiary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPrompt}
                disabled={!newName.trim()}
                className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
                style={{
                  color: 'white',
                  backgroundColor: 'var(--accent)',
                }}
              >
                Add Prompt
              </button>
            </div>
          </div>
        )}

        {/* Existing prompts */}
        {prompts.map(prompt => (
          <PromptItem
            key={prompt.id}
            prompt={prompt}
            pageName={pageName}
            onUpdate={handleUpdatePrompt}
            onDelete={handleDeletePrompt}
            onResponseUpdate={handleResponseUpdate}
          />
        ))}

        {/* Empty state */}
        {prompts.length === 0 && !isAdding && (
          <div
            className="text-sm text-center py-6 rounded-lg border border-dashed"
            style={{
              color: 'var(--text-muted)',
              borderColor: 'var(--border)',
            }}
          >
            <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
            <p>No AI prompts yet</p>
            <p className="text-xs mt-1">
              Add a prompt to analyze notes with this tag
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
