import { useCallback, useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { tagHighlighter } from '../extensions/tag-highlighter'

interface DailyEditorProps {
  date: Date
  onTagClick?: (tag: string) => void
}

// Custom theme for Logseq/Obsidian-like appearance
const editorTheme = EditorView.theme({
  '&': {
    fontSize: '15px',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    padding: '0',
    caretColor: '#3b82f6',
  },
  '.cm-line': {
    padding: '2px 0',
  },
  '.cm-cursor': {
    borderLeftColor: '#3b82f6',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  '.cm-gutters': {
    display: 'none',
  },
  // Tag styling
  '.cm-tag': {
    color: '#3b82f6',
    fontWeight: '500',
    cursor: 'pointer',
    borderRadius: '3px',
    padding: '0 2px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  '.cm-tag:hover': {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  '.cm-wikilink': {
    color: '#8b5cf6',
    fontWeight: '500',
    cursor: 'pointer',
  },
  // Bullet point styling
  '.cm-bullet': {
    color: '#9ca3af',
  },
})

// Syntax highlighting colors
const highlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: 'bold', fontSize: '1.5em' },
  { tag: t.heading2, fontWeight: 'bold', fontSize: '1.3em' },
  { tag: t.heading3, fontWeight: 'bold', fontSize: '1.1em' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#3b82f6', textDecoration: 'underline' },
  { tag: t.url, color: '#6b7280' },
  { tag: t.monospace, fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: '3px' },
])

export function DailyEditor({ date, onTagClick }: DailyEditorProps) {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'saved' | 'saving' | 'loading'>('loading')

  const dateString = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Load note on mount or date change
  useEffect(() => {
    const loadNote = async () => {
      setStatus('loading')
      if (window.api) {
        const note = await window.api.readNote(date.toISOString())
        setContent(note || '')
      }
      setStatus('saved')
    }
    loadNote()
  }, [date])

  // Debounced save
  useEffect(() => {
    if (!window.api) return

    // Skip saving on initial load
    const timeoutId = setTimeout(async () => {
      try {
        await window.api.writeNote(date.toISOString(), content)
        setStatus('saved')
      } catch (err) {
        console.error('Failed to save note:', err)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [content, date])

  const handleChange = useCallback((value: string) => {
    setContent(value)
    setStatus('saving')
  }, [])

  // Handle click events on tags
  const handleEditorClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.classList.contains('cm-tag') || target.classList.contains('cm-wikilink')) {
      const tagText = target.textContent
      if (tagText && onTagClick) {
        // Extract tag name from #tag or [[tag]]
        let tagName = tagText
        if (tagName.startsWith('#')) {
          tagName = tagName.slice(1)
        } else if (tagName.startsWith('[[') && tagName.endsWith(']]')) {
          tagName = tagName.slice(2, -2)
        }
        onTagClick(tagName.toLowerCase())
      }
    }
  }, [onTagClick])

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {dateString}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {status === 'saved' && 'All changes saved'}
          {status === 'saving' && 'Saving...'}
          {status === 'loading' && 'Loading...'}
        </p>
      </div>

      {/* Editor */}
      <div
        className="flex-1 overflow-auto px-6 py-4"
        onClick={handleEditorClick}
      >
        <CodeMirror
          value={content}
          onChange={handleChange}
          extensions={[
            markdown(),
            editorTheme,
            syntaxHighlighting(highlightStyle),
            tagHighlighter(),
            EditorView.lineWrapping,
          ]}
          placeholder="Start writing... Use #tags or [[tags]] to organize your thoughts."
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            history: true,
            drawSelection: true,
            dropCursor: true,
            indentOnInput: true,
          }}
          className="min-h-full"
        />
      </div>
    </div>
  )
}
