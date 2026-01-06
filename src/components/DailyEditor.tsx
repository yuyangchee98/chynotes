import { useCallback, useEffect, useState, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { tagHighlighter } from '../extensions/tag-highlighter'
import { outliner } from '../extensions/outliner'
import { blockIdHider } from '../extensions/block-id-hider'
import { blockReference, extractBlockRefIds, BlockRecord } from '../extensions/block-reference'
import { blockContextMenu } from '../extensions/block-context-menu'
import { toLocalDateString } from '../utils/format-date'
import { useSnapshotDebounce } from '../hooks/useSnapshotDebounce'
import { useSnapshotViewer } from '../hooks/useSnapshotViewer'
import { SnapshotSlider } from './SnapshotSlider'
import { DiffView } from './DiffView'
import { EditConfirmationDialog } from './EditConfirmationDialog'

interface DailyEditorProps {
  date: Date
  onTagClick?: (tag: string) => void
  scrollToLine?: number | null
  onScrollComplete?: () => void
  onCopyToToday?: (content: string) => void
  contentToAppend?: string | null
  onContentAppended?: () => void
  onDateSelect?: (date: Date, line?: number) => void
}

// Custom theme for Logseq/Obsidian-like appearance
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
  // Hide markdown's default bullet styling since we handle it
  '.cm-bullet': {
    display: 'none',
  },
  // Outliner bullet widget - replaces "- " with styled dot
  // Width matches approximately 2 characters ("- ") for proper cursor flow
  '.cm-bullet-widget': {
    display: 'inline-block',
    width: '1.5ch',
    textAlign: 'center',
    verticalAlign: 'baseline',
    userSelect: 'none',
    position: 'relative',
  },
  // The dot itself via ::before pseudo-element
  '.cm-bullet-widget::before': {
    content: '""',
    display: 'inline-block',
    width: '0.35em',
    height: '0.35em',
    backgroundColor: 'var(--accent)',
    borderRadius: '50%',
    verticalAlign: 'middle',
    position: 'relative',
    top: '-0.1em',
    transition: 'transform 0.15s ease, background-color 0.15s ease',
  },
  '.cm-line:hover .cm-bullet-widget::before': {
    transform: 'scale(1.15)',
    backgroundColor: 'var(--accent-hover)',
  },
  // Nested bullet styling - progressively smaller/lighter
  '.cm-bullet-widget[data-indent="1"]::before': {
    width: '0.3em',
    height: '0.3em',
    opacity: '0.8',
  },
  '.cm-bullet-widget[data-indent="2"]::before': {
    width: '0.25em',
    height: '0.25em',
    opacity: '0.65',
  },
  '.cm-bullet-widget[data-indent="3"]::before': {
    width: '0.25em',
    height: '0.25em',
    opacity: '0.5',
  },
  // Block reference styling
  '.cm-block-reference': {
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '4px',
    padding: '2px 6px',
    cursor: 'pointer',
    fontStyle: 'italic',
    borderLeft: '2px solid var(--accent)',
    display: 'inline',
    color: 'var(--text-secondary)',
  },
  '.cm-block-reference:hover': {
    backgroundColor: 'var(--accent-subtle)',
  },
  '.cm-block-reference-missing': {
    color: 'var(--text-muted)',
    cursor: 'default',
    borderLeftColor: 'var(--text-muted)',
  },
  '.cm-block-reference-circular': {
    color: 'var(--text-muted)',
    cursor: 'default',
    borderLeftColor: 'var(--text-muted)',
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

export function DailyEditor({ date, onTagClick, scrollToLine, onScrollComplete, onCopyToToday, contentToAppend, onContentAppended, onDateSelect }: DailyEditorProps) {
  const [content, setContent] = useState('')
  const editorRef = useRef<{ view: EditorView } | null>(null)
  const noteDate = toLocalDateString(date)

  // Soft-lock state for non-today notes
  const [unlocked, setUnlocked] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const todayDate = toLocalDateString(new Date())
  const isToday = noteDate === todayDate
  const isLocked = !isToday && !unlocked

  // Block reference cache for ((block-id)) embeds
  const [blockCache, setBlockCache] = useState<Map<string, BlockRecord | null>>(new Map())

  // Snapshot debouncing - saves after 5s of inactivity
  useSnapshotDebounce(noteDate, content)

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

  const dateString = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Load note on mount or date change
  useEffect(() => {
    const loadNote = async () => {
      if (window.api) {
        const note = await window.api.readNote(toLocalDateString(date))
        setContent(note || '- ')
      }
    }
    loadNote()
  }, [date])

  // Load snapshots when date changes
  useEffect(() => {
    loadSnapshots(noteDate)
  }, [noteDate, loadSnapshots])

  // Return to live when date changes (if viewing history)
  useEffect(() => {
    if (isViewingHistory) {
      returnToLive()
    }
  }, [noteDate]) // Intentionally not including isViewingHistory/returnToLive to avoid loop

  // Reset unlocked state when date changes
  useEffect(() => {
    setUnlocked(false)
    setShowConfirmDialog(false)
  }, [noteDate])

  // Handle content to append (from Copy to Today)
  useEffect(() => {
    if (contentToAppend && isToday) {
      setContent(prev => {
        const trimmed = prev.trimEnd()
        return trimmed + '\n' + contentToAppend
      })
      // Clear the appended content flag
      onContentAppended?.()
    }
  }, [contentToAppend, isToday, onContentAppended])

  // Fetch block content for ((block-id)) references
  useEffect(() => {
    const fetchBlockRefs = async () => {
      if (!window.api) return

      const refIds = extractBlockRefIds(content)
      if (refIds.length === 0) return

      // Only fetch blocks we don't have cached
      const newCache = new Map(blockCache)
      let needsUpdate = false

      for (const id of refIds) {
        if (!newCache.has(id)) {
          const block = await window.api.getBlockById(id)
          newCache.set(id, block)
          needsUpdate = true

          // If block has nested refs, fetch those too (up to 3 levels)
          if (block) {
            const nestedIds = extractBlockRefIds(block.content)
            for (const nestedId of nestedIds) {
              if (!newCache.has(nestedId)) {
                const nestedBlock = await window.api.getBlockById(nestedId)
                newCache.set(nestedId, nestedBlock)
              }
            }
          }
        }
      }

      if (needsUpdate) {
        setBlockCache(newCache)
      }
    }

    fetchBlockRefs()
  }, [content]) // Re-run when content changes

  // Debounced save
  useEffect(() => {
    if (!window.api) return

    // Skip saving on initial load
    const timeoutId = setTimeout(async () => {
      try {
        // Detect empty bullets - save empty string to trigger file deletion
        const isEmpty = /^(\s*-\s*)*$/.test(content)
        await window.api.writeNote(toLocalDateString(date), isEmpty ? '' : content)
      } catch (err) {
        console.error('Failed to save note:', err)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [content, date])

  const handleChange = useCallback((value: string) => {
    // If viewing history, return to live first
    if (isViewingHistory) {
      returnToLive()
    }
    setContent(value)
  }, [isViewingHistory, returnToLive])

  // Handle click on locked editor - show confirmation dialog
  const handleLockedEditorClick = useCallback(() => {
    if (isLocked && !showConfirmDialog) {
      setShowConfirmDialog(true)
    }
  }, [isLocked, showConfirmDialog])

  // Dialog callbacks
  const handleEditAnyway = useCallback(() => {
    setUnlocked(true)
    setShowConfirmDialog(false)
  }, [])

  const handleCopyToToday = useCallback(() => {
    setShowConfirmDialog(false)
    // Get the current line or first line of content
    const lines = content.split('\n').filter(l => l.trim())
    const firstLine = lines[0] || '- '
    onCopyToToday?.(firstLine)
  }, [content, onCopyToToday])

  const handleCancelDialog = useCallback(() => {
    setShowConfirmDialog(false)
  }, [])

  // Handle block reference click - navigate to source date
  const handleBlockRefClick = useCallback((noteDateStr: string, lineNumber: number) => {
    // Parse the date string (YYYY-MM-DD) as local date
    const [year, month, day] = noteDateStr.split('-').map(Number)
    const targetDate = new Date(year, month - 1, day)
    onDateSelect?.(targetDate, lineNumber)
  }, [onDateSelect])

  // Scroll to line when requested
  useEffect(() => {
    if (scrollToLine && editorRef.current?.view) {
      const view = editorRef.current.view
      const line = view.state.doc.line(Math.min(scrollToLine, view.state.doc.lines))
      view.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 100 })
      })
      onScrollComplete?.()
    }
  }, [scrollToLine, content, onScrollComplete])

  // Determine display content
  const displayContent = isViewingHistory && snapshotContent !== null
    ? snapshotContent
    : content

  // For diff mode: determine the "old" text to compare against live
  const sortedSnapshots = [...snapshots].sort((a, b) => a.created_at - b.created_at)
  const diffOldText = isViewingHistory && snapshotContent !== null
    ? snapshotContent  // Viewing a snapshot: compare snapshot vs live
    : sortedSnapshots[0]?.content ?? content  // At live: compare first snapshot vs live

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header - draggable region, padded for traffic lights */}
      <div
        className="px-6 pt-10 pb-3"
        style={{
          WebkitAppRegion: 'drag',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)'
        } as React.CSSProperties}
      >
        <div className="flex items-center justify-between">
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {dateString}
          </h1>

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
            // Diff view mode
            <DiffView oldText={diffOldText} newText={content} />
          ) : (
            // Normal editor mode
            <>
              <CodeMirror
                ref={editorRef}
                value={displayContent}
                onChange={handleChange}
                extensions={[
                  markdown(),
                  editorTheme,
                  syntaxHighlighting(highlightStyle),
                  tagHighlighter(onTagClick),
                  outliner(),
                  blockIdHider(),
                  blockReference({ blockCache, onClick: handleBlockRefClick }),
                  blockContextMenu(),
                  EditorView.lineWrapping,
                  ...((isViewingHistory || isLocked) ? [EditorView.editable.of(false)] : []),
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
              {/* Read-only overlay when viewing snapshot */}
              {isViewingHistory && (
                <div
                  className="absolute inset-0 pointer-events-none rounded"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    opacity: 0.15,
                  }}
                />
              )}
              {/* Locked overlay for past notes - clickable to show dialog */}
              {isLocked && !isViewingHistory && (
                <div
                  className="absolute inset-0 rounded cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    opacity: 0.1,
                  }}
                  onClick={handleLockedEditorClick}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirmation dialog for editing past notes */}
      <EditConfirmationDialog
        isOpen={showConfirmDialog}
        dateString={dateString}
        onEditAnyway={handleEditAnyway}
        onCopyToToday={handleCopyToToday}
        onCancel={handleCancelDialog}
      />
    </div>
  )
}
