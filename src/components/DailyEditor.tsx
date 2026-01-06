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
  // Block reference styling - wrapper
  '.cm-block-reference': {
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '6px',
    padding: '4px 8px',
    cursor: 'pointer',
    borderLeft: '2px solid var(--accent)',
    display: 'inline-block',
    verticalAlign: 'top',
    maxWidth: '100%',
    margin: '2px 0',
  },
  '.cm-block-reference:hover': {
    backgroundColor: 'var(--accent-subtle)',
  },
  '.cm-block-reference-missing': {
    color: 'var(--text-muted)',
    cursor: 'default',
    borderLeftColor: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  // Block reference container
  '.cm-block-ref-container': {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  '.cm-block-ref-parent': {
    color: 'var(--text-secondary)',
    fontSize: '0.95em',
    lineHeight: '1.4',
  },
  '.cm-block-ref-children': {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    marginTop: '2px',
    paddingTop: '2px',
    borderTop: '1px solid var(--border)',
  },
  '.cm-block-ref-child': {
    color: 'var(--text-muted)',
    fontSize: '0.9em',
    lineHeight: '1.35',
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

export function DailyEditor({ date, onTagClick, scrollToLine, onScrollComplete, onCopyToToday, onDateSelect }: DailyEditorProps) {
  const [content, setContent] = useState('')
  const editorRef = useRef<{ view: EditorView } | null>(null)
  const noteDate = toLocalDateString(date)

  // Soft-lock state for non-today notes
  const [unlocked, setUnlocked] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [clickedBlockContent, setClickedBlockContent] = useState<string | null>(null)
  const todayDate = toLocalDateString(new Date())
  const isToday = noteDate === todayDate
  const isLocked = !isToday && !unlocked

  // Block reference cache for ((block-id)) embeds - stores parent + children
  const [blockCache, setBlockCache] = useState<Map<string, BlockRecord[]>>(new Map())

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
          // Fetch parent block with all its children
          const blocks = await window.api.getBlockWithChildren(id)
          newCache.set(id, blocks)
          needsUpdate = true

          // If any block has nested refs, fetch those too (up to 3 levels)
          for (const block of blocks) {
            const nestedIds = extractBlockRefIds(block.content)
            for (const nestedId of nestedIds) {
              if (!newCache.has(nestedId)) {
                const nestedBlocks = await window.api.getBlockWithChildren(nestedId)
                newCache.set(nestedId, nestedBlocks)
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

  // Hover state for highlighting blocks with children
  const [hoveredLineRange, setHoveredLineRange] = useState<{ start: number; end: number } | null>(null)

  // Get indent level of a line (count leading spaces/tabs before "- ")
  const getIndentLevel = useCallback((line: string) => {
    const match = line.match(/^(\s*)- /)
    if (!match) return -1
    return match[1].length
  }, [])

  // Get line range (start, end) for a block with its children
  const getBlockLineRange = useCallback((allLines: string[], lineIndex: number): { start: number; end: number } => {
    const clickedLine = allLines[lineIndex]
    const clickedIndent = getIndentLevel(clickedLine)
    if (clickedIndent === -1) return { start: lineIndex, end: lineIndex }

    let endIndex = lineIndex

    // Find the last child line
    for (let i = lineIndex + 1; i < allLines.length; i++) {
      const lineIndent = getIndentLevel(allLines[i])
      if (lineIndent === -1) continue // Skip non-bullet lines
      if (lineIndent <= clickedIndent) break // Same or less indent = sibling/parent
      endIndex = i
    }

    return { start: lineIndex, end: endIndex }
  }, [getIndentLevel])

  // Extract a block with all its children based on indentation
  const getBlockWithChildren = useCallback((allLines: string[], clickedLineIndex: number) => {
    const { start, end } = getBlockLineRange(allLines, clickedLineIndex)
    return allLines.slice(start, end + 1).join('\n')
  }, [getBlockLineRange])

  // Handle hover on locked editor - highlight block with children
  const handleLockedEditorHover = useCallback((event: React.MouseEvent) => {
    if (isLocked && editorRef.current?.view) {
      const view = editorRef.current.view
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos)
        const allLines = content.split('\n')
        const lineIndex = line.number - 1
        const range = getBlockLineRange(allLines, lineIndex)
        setHoveredLineRange(range)
      }
    }
  }, [isLocked, content, getBlockLineRange])

  const handleLockedEditorLeave = useCallback(() => {
    setHoveredLineRange(null)
  }, [])

  // Handle click on locked editor - show confirmation dialog with clicked block
  const handleLockedEditorClick = useCallback((event: React.MouseEvent) => {
    if (isLocked && !showConfirmDialog && editorRef.current?.view) {
      const view = editorRef.current.view
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos)
        const allLines = content.split('\n')
        const lineIndex = line.number - 1 // Convert to 0-based index
        const blockWithChildren = getBlockWithChildren(allLines, lineIndex)
        setClickedBlockContent(blockWithChildren)
      } else {
        // Fallback to first line if click position can't be determined
        const allLines = content.split('\n')
        const blockWithChildren = getBlockWithChildren(allLines, 0)
        setClickedBlockContent(blockWithChildren)
      }
      setShowConfirmDialog(true)
    }
  }, [isLocked, showConfirmDialog, content, getBlockWithChildren])

  // Dialog callbacks
  const handleEditAnyway = useCallback(() => {
    setUnlocked(true)
    setShowConfirmDialog(false)
    setClickedBlockContent(null)
  }, [])

  const handleReferenceToTodayClick = useCallback(() => {
    setShowConfirmDialog(false)
    // Extract block ID from clicked block and create a reference
    if (clickedBlockContent) {
      const blockIdMatch = clickedBlockContent.match(/§([a-f0-9]{8})§/)
      if (blockIdMatch) {
        onCopyToToday?.(`- ((${blockIdMatch[1]}))`)
      }
    }
    setClickedBlockContent(null)
  }, [clickedBlockContent, onCopyToToday])

  const handleCancelDialog = useCallback(() => {
    setShowConfirmDialog(false)
    setClickedBlockContent(null)
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
            className="text-xl font-semibold flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {dateString}
            {isLocked && (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--text-muted)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            )}
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
        <div
          className={`max-w-3xl mx-auto relative ${isLocked ? 'editor-locked' : ''}`}
          onClick={isLocked && !isViewingHistory ? handleLockedEditorClick : undefined}
          onMouseMove={isLocked && !isViewingHistory ? handleLockedEditorHover : undefined}
          onMouseLeave={isLocked && !isViewingHistory ? handleLockedEditorLeave : undefined}
          style={isLocked && !isViewingHistory ? { cursor: 'pointer' } : undefined}
        >
          {/* Dynamic highlighting for block with children */}
          {hoveredLineRange && (
            <style>{`
              .editor-locked .cm-line:nth-child(n+${hoveredLineRange.start + 1}):nth-child(-n+${hoveredLineRange.end + 1}) {
                background-color: var(--accent-subtle) !important;
              }
              .editor-locked .cm-line:nth-child(${hoveredLineRange.start + 1}) {
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
              }
              .editor-locked .cm-line:nth-child(${hoveredLineRange.end + 1}) {
                border-bottom-left-radius: 4px;
                border-bottom-right-radius: 4px;
              }
            `}</style>
          )}
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
            </>
          )}
        </div>
      </div>

      {/* Confirmation dialog for editing past notes */}
      <EditConfirmationDialog
        isOpen={showConfirmDialog}
        dateString={dateString}
        blockContent={clickedBlockContent ?? undefined}
        onEditAnyway={handleEditAnyway}
        onReferenceToToday={handleReferenceToTodayClick}
        onCancel={handleCancelDialog}
      />
    </div>
  )
}
