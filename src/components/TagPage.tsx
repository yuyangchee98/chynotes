import { useEffect, useState, useMemo, useCallback } from 'react'
import React from 'react'
import { getHardcodedView, hasHardcodedView } from './tag-views'
import { formatDate } from '../utils/format-date'

interface TagPageProps {
  tagName: string
  onTagClick: (tag: string) => void
  onBack: () => void
}

type GenerationStatus = 'idle' | 'loading' | 'generating' | 'success' | 'error'

export function TagPage({ tagName, onTagClick, onBack }: TagPageProps) {
  const [occurrences, setOccurrences] = useState<TagOccurrence[]>([])
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<string>('')
  const [editingPrompt, setEditingPrompt] = useState<string>('')
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [codeExpanded, setCodeExpanded] = useState(false)

  // Check if this tag has a hardcoded view
  const isHardcoded = hasHardcodedView(tagName)
  const HardcodedView = isHardcoded ? getHardcodedView(tagName) : null

  // Load occurrences, prompt, and cached code
  const loadData = useCallback(async () => {
    setStatus('loading')
    if (window.api) {
      const [results, tagPrompt, cachedCode] = await Promise.all([
        window.api.getTagOccurrences(tagName),
        window.api.getTagPrompt(tagName),
        window.api.getCachedCode(tagName),
      ])
      setOccurrences(results)
      setPrompt(tagPrompt)
      setEditingPrompt(tagPrompt)
      if (cachedCode && !isHardcoded) {
        setGeneratedCode(cachedCode)
        setStatus('success')
      } else {
        setStatus('idle')
      }
    }
  }, [tagName, isHardcoded])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Callback for views to update a line
  const handleUpdateLine = useCallback(async (date: string, line: number, newContent: string) => {
    if (window.api) {
      await window.api.updateNoteLine(date, line, newContent)
      // Reload occurrences to reflect the change
      const results = await window.api.getTagOccurrences(tagName)
      setOccurrences(results)
    }
  }, [tagName])

  // Generate the tag page (only for non-hardcoded tags)
  const handleGenerate = async () => {
    setStatus('generating')
    setError(null)

    try {
      // Check Ollama connection first
      const ollamaStatus = await window.api.checkOllama()
      if (!ollamaStatus.ok) {
        throw new Error(`Ollama not available: ${ollamaStatus.error}. Make sure Ollama is running.`)
      }

      const code = await window.api.generateTagPage(tagName)
      setGeneratedCode(code)
      setStatus('success')
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  // Save updated prompt
  const handleSavePrompt = async () => {
    if (window.api) {
      await window.api.setTagPrompt(tagName, editingPrompt)
      setPrompt(editingPrompt)
      setIsEditingPrompt(false)
      // Clear generated code so it regenerates with new prompt
      setGeneratedCode(null)
      setStatus('idle')
    }
  }

  // Dynamic component from generated code
  const DynamicComponent = useMemo(() => {
    if (!generatedCode || isHardcoded) return null

    try {
      // Transform the code to work in browser
      // We need to provide React and useState/useMemo in scope
      const wrappedCode = `
        const { useState, useMemo, useEffect, useCallback } = React;
        ${generatedCode}
      `

      // Create function from code
      const func = new Function('React', 'notes', 'onUpdateLine', wrappedCode + '\nreturn TagView;')
      const Component = func(React, occurrences.map(o => ({
        date: o.date,
        line: o.line,
        content: o.content,
      })), handleUpdateLine)

      return Component
    } catch (err) {
      console.error('Failed to compile generated code:', err)
      return null
    }
  }, [generatedCode, occurrences, isHardcoded, handleUpdateLine])


  // Group occurrences by date for fallback view
  const groupedByDate = occurrences.reduce((acc, occ) => {
    if (!acc[occ.date]) {
      acc[occ.date] = []
    }
    acc[occ.date].push(occ)
    return acc
  }, {} as Record<string, TagOccurrence[]>)

  // Prepare notes for views
  const notes = occurrences.map(o => ({
    date: o.date,
    line: o.line,
    content: o.content,
  }))

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header - draggable region, padded for traffic lights */}
      <div
        className="px-6 pt-10 pb-4 border-b border-gray-200 dark:border-gray-700"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              <span className="text-blue-500">#</span>{tagName}
            </h1>
          </div>

          {/* Only show Generate button for non-hardcoded tags */}
          {!isHardcoded && (
            <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button
                onClick={handleGenerate}
                disabled={status === 'generating'}
                className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md flex items-center gap-2"
              >
                {status === 'generating' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : generatedCode ? (
                  <>Regenerate</>
                ) : (
                  <>Generate View</>
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          {occurrences.length} occurrence{occurrences.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {status === 'loading' ? (
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        ) : status === 'generating' ? (
          <div className="flex flex-col items-center justify-center py-12">
            <svg className="w-8 h-8 animate-spin text-blue-500 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">Generating view with AI...</p>
          </div>
        ) : HardcodedView ? (
          /* Render hardcoded component */
          <HardcodedView notes={notes} onUpdateLine={handleUpdateLine} />
        ) : DynamicComponent ? (
          /* Render AI-generated component */
          <div className="generated-view">
            <DynamicComponent notes={notes} onUpdateLine={handleUpdateLine} />
          </div>
        ) : occurrences.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">
            No notes found with this tag.
          </div>
        ) : (
          /* Fallback: simple list view */
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Click "Generate View" to create an AI-powered interactive view for this tag.
              </p>
            </div>

            {Object.entries(groupedByDate).map(([date, items]) => (
              <div key={date}>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {formatDate(date)}
                </h2>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={`${date}-${item.line}-${idx}`}
                      className="px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-800 dark:text-gray-200"
                    >
                      {item.content}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom sections - Prompt and Generated Code (only for non-hardcoded) */}
        {!isHardcoded && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Prompt Section */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Prompt</span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${promptExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {promptExpanded && (
                <div className="px-4 py-3 bg-white dark:bg-gray-950">
                  {isEditingPrompt ? (
                    <div>
                      <textarea
                        value={editingPrompt}
                        onChange={(e) => setEditingPrompt(e.target.value)}
                        className="w-full h-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe how this tag page should look and behave..."
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setEditingPrompt(prompt)
                            setIsEditingPrompt(false)
                          }}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSavePrompt}
                          className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{prompt}</p>
                      <button
                        onClick={() => setIsEditingPrompt(true)}
                        className="mt-2 text-sm text-blue-500 hover:text-blue-600"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Generated Code Section */}
            {generatedCode && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setCodeExpanded(!codeExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated Code</span>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${codeExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {codeExpanded && (
                  <div className="px-4 py-3 bg-white dark:bg-gray-950">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded">
                      {generatedCode}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
