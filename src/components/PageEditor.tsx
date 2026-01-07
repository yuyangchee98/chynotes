import { useCallback, useEffect, useState, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { tagHighlighter } from '../extensions/tag-highlighter'
import { formattingKeymap } from '../extensions/formatting-keymap'
import { useSnapshotViewer } from '../hooks/useSnapshotViewer'
import { SnapshotSlider } from './SnapshotSlider'
import { DiffView } from './DiffView'
import { Backlinks } from './Backlinks'

interface PageEditorProps {
  pageName: string
  onTagClick?: (tag: string) => void
  onDateSelect?: (date: Date, line?: number) => void
  onBack?: () => void
}

// Custom theme matching DailyEditor
const editorTheme = EditorView.theme({
  '&': {
    fontSize: '17px',
    backgroundColor: 'transparent',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-content': {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '0',
    caretColor: 'var(--accent)',
    lineHeight: '1.5',
    letterSpacing: '-0.015em',
  },
  '.cm-line': {
    padding: '3px 0',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--accent-subtle)',
  },
  '.cm-gutters': {
    display: 'none',
  },
  // Wiki-link styling
  '.cm-wikilink': {
    color: 'var(--accent)',
    fontWeight: '500',
    cursor: 'pointer',
    borderRadius: '3px',
    padding: '0 2px',
    backgroundColor: 'var(--accent-subtle)',
  },
  '.cm-wikilink:hover': {
    backgroundColor: 'var(--accent-subtle)',
    filter: 'brightness(0.95)',
  },
})

// Syntax highlighting colors
const highlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '600', fontSize: '1.5em', color: 'var(--text-primary)' },
  { tag: t.heading2, fontWeight: '600', fontSize: '1.3em', color: 'var(--text-primary)' },
  { tag: t.heading3, fontWeight: '600', fontSize: '1.15em', color: 'var(--text-secondary)' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: t.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--text-muted)' },
  { tag: t.monospace, fontFamily: 'ui-monospace, monospace', backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9em' },
])

export function PageEditor({ pageName, onTagClick, onDateSelect, onBack }: PageEditorProps) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const editorRef = useRef<{ view: EditorView } | null>(null)

  // Snapshot viewer state
  const {
    viewingSnapshotId,
    snapshotContent,
    isViewingHistory,
    snapshots,
    isDiffMode,
    loadSnapshots,
    viewSnapshot,
    returnToLive,
    toggleDiffMode,
  } = useSnapshotViewer()

  // Load page content on mount or when pageName changes
  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true)
      if (window.api) {
        // Create page if it doesn't exist
        await window.api.createPage(pageName)
        const pageContent = await window.api.readPage(pageName)
        setContent(pageContent || `# ${pageName}\n\n`)
      }
      setIsLoading(false)
    }
    loadPage()
  }, [pageName])

  // Load snapshots when pageName changes
  useEffect(() => {
    loadSnapshots(pageName, 'page')
  }, [pageName, loadSnapshots])

  // Return to live when pageName changes (if viewing history)
  useEffect(() => {
    if (isViewingHistory) {
      returnToLive()
    }
  }, [pageName]) // Intentionally not including isViewingHistory/returnToLive

  // Debounced save
  useEffect(() => {
    if (!window.api || content === null) return

    const timeoutId = setTimeout(async () => {
      try {
        await window.api.writePage(pageName, content)
      } catch (err) {
        console.error('Failed to save page:', err)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [content, pageName])

  // Save snapshot after inactivity
  useEffect(() => {
    if (!window.api || content === null || content === '') return

    const timeoutId = setTimeout(async () => {
      try {
        await window.api.saveSnapshot(pageName, content, 'page')
        // Reload snapshots so the timeline appears/updates
        loadSnapshots(pageName, 'page')
      } catch (err) {
        console.error('Failed to save snapshot:', err)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [content, pageName, loadSnapshots])

  const handleChange = useCallback((value: string) => {
    if (isViewingHistory) {
      returnToLive()
    }
    setContent(value)
  }, [isViewingHistory, returnToLive])

  // Determine display content
  const displayContent = isViewingHistory && snapshotContent !== null
    ? snapshotContent
    : (content || '')

  // For diff mode
  const sortedSnapshots = [...snapshots].sort((a, b) => a.created_at - b.created_at)
  const diffOldText = isViewingHistory && snapshotContent !== null
    ? snapshotContent
    : sortedSnapshots[0]?.content ?? (content || '')

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 pt-10 pb-3"
        style={{
          WebkitAppRegion: 'drag',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)'
        } as React.CSSProperties}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 rounded hover:opacity-80"
                style={{ color: 'var(--text-muted)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1
              className="text-xl font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              <span style={{ color: 'var(--accent)', opacity: 0.5 }}>[[</span>
              {pageName}
              <span style={{ color: 'var(--accent)', opacity: 0.5 }}>]]</span>
            </h1>
          </div>

          {/* Snapshot slider */}
          {snapshots.length > 0 && (
            <SnapshotSlider
              snapshots={snapshots}
              currentSnapshotId={viewingSnapshotId}
              onSnapshotSelect={viewSnapshot}
              onReturnToLive={returnToLive}
              isDiffMode={isDiffMode}
              onToggleDiffMode={toggleDiffMode}
            />
          )}
        </div>
      </div>

      {/* Editor */}
      <div
        className="flex-1 overflow-auto px-6 py-4"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-3xl mx-auto relative">
          {isDiffMode && snapshots.length > 0 ? (
            <DiffView oldText={diffOldText} newText={content || ''} />
          ) : (
            <>
              <CodeMirror
                ref={editorRef}
                value={displayContent}
                onChange={handleChange}
                extensions={[
                  markdown(),
                  editorTheme,
                  syntaxHighlighting(highlightStyle),
                  formattingKeymap,
                  tagHighlighter(onTagClick),
                  EditorView.lineWrapping,
                  ...(isViewingHistory ? [EditorView.editable.of(false)] : []),
                ]}
                basicSetup={{
                  lineNumbers: false,
                  foldGutter: false,
                  highlightActiveLine: false,
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
              {isViewingHistory && (
                <div
                  className="absolute inset-0 pointer-events-none rounded"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    opacity: 0.15,
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Backlinks section */}
        <div className="max-w-3xl mx-auto mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
          <Backlinks
            pageName={pageName}
            onBlockClick={(date, line) => {
              if (onDateSelect) {
                const [year, month, day] = date.split('-').map(Number)
                onDateSelect(new Date(year, month - 1, day), line)
              }
            }}
            onTagClick={onTagClick}
          />
        </div>
      </div>
    </div>
  )
}
