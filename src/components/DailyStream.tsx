import { useCallback, useEffect, useState, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { tagHighlighter } from '../extensions/tag-highlighter'
import { outliner } from '../extensions/outliner'
import { formatDateFromDate, toLocalDateString } from '../utils/format-date'

interface DailyStreamProps {
  onTagClick?: (tag: string) => void
}

interface DayBlock {
  date: Date
  dateString: string
  content: string
  status: 'saved' | 'saving' | 'loading'
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
  '.cm-placeholder': {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  '.cm-tag': {
    color: 'var(--accent)',
    fontWeight: '500',
    cursor: 'pointer',
    borderRadius: '3px',
    padding: '0 2px',
    backgroundColor: 'var(--accent-subtle)',
  },
  '.cm-tag:hover': {
    backgroundColor: 'var(--accent-subtle)',
    filter: 'brightness(0.95)',
  },
  '.cm-wikilink': {
    color: '#8b7ec8',
    fontWeight: '500',
    cursor: 'pointer',
  },
  '.cm-bullet': {
    display: 'none',
  },
  '.cm-bullet-widget': {
    display: 'inline-block',
    width: '1.5ch',
    textAlign: 'center',
    verticalAlign: 'baseline',
    userSelect: 'none',
    position: 'relative',
  },
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
})

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

const INITIAL_DAYS = 7
const LOAD_MORE_COUNT = 5

// Generate array of dates starting from today going backwards
function generateDates(count: number, startOffset = 0): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = startOffset; i < startOffset + count; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    dates.push(date)
  }
  return dates
}


export function DailyStream({ onTagClick }: DailyStreamProps) {
  const [days, setDays] = useState<DayBlock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const isLoadingRef = useRef(false)
  const [hasMore, setHasMore] = useState(true)
  const [todayLabelOpacity, setTodayLabelOpacity] = useState(1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const todayEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const saveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Load initial days
  useEffect(() => {
    const loadInitialDays = async () => {
      if (!window.api) return

      const dates = generateDates(INITIAL_DAYS)
      const loadedDays: DayBlock[] = []

      for (const date of dates) {
        const dateString = toLocalDateString(date)
        const content = await window.api.readNote(dateString) || '- '
        loadedDays.push({
          date,
          dateString,
          content,
          status: 'saved'
        })
      }

      setDays(loadedDays)
    }

    loadInitialDays()
  }, [])

  // Infinite scroll observer - only after initial load
  useEffect(() => {
    if (!bottomRef.current || !hasMore || days.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          loadMoreDays()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(bottomRef.current)
    return () => observer.disconnect()
  }, [days.length, isLoading, hasMore])

  // Track scroll position for fading Today label and chevron
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      // Fade out over the first 150px of scrolling
      const opacity = Math.max(0, 1 - scrollTop / 150)
      setTodayLabelOpacity(opacity)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const loadMoreDays = async () => {
    if (!window.api || isLoadingRef.current) return
    isLoadingRef.current = true
    setIsLoading(true)

    const startOffset = days.length
    const newDates = generateDates(LOAD_MORE_COUNT, startOffset)
    const newDays: DayBlock[] = []

    for (const date of newDates) {
      const dateString = toLocalDateString(date)
      const content = await window.api.readNote(dateString) || '- '
      newDays.push({
        date,
        dateString,
        content,
        status: 'saved'
      })
    }

    // Check if we have more by seeing if all new days are empty
    // For now, just keep loading (could check against listNotes)
    if (newDays.length < LOAD_MORE_COUNT) {
      setHasMore(false)
    }

    setDays(prev => [...prev, ...newDays])
    isLoadingRef.current = false
    setIsLoading(false)
  }

  const handleContentChange = useCallback((index: number, value: string) => {
    setDays(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], content: value, status: 'saving' }
      return updated
    })

    // Debounced save
    const day = days[index]
    if (!day) return

    const existingTimeout = saveTimeouts.current.get(day.dateString)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const timeout = setTimeout(async () => {
      if (!window.api) return
      try {
        // Detect empty bullets - save empty string to trigger file deletion
        const isEmpty = /^(\s*-\s*)*$/.test(value)
        await window.api.writeNote(day.dateString, isEmpty ? '' : value)
        setDays(prev => {
          const updated = [...prev]
          if (updated[index]) {
            updated[index] = { ...updated[index], status: 'saved' }
          }
          return updated
        })
      } catch (err) {
        console.error('Failed to save note:', err)
      }
      saveTimeouts.current.delete(day.dateString)
    }, 500)

    saveTimeouts.current.set(day.dateString, timeout)
  }, [days])

  const handleEditorClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.classList.contains('cm-tag') || target.classList.contains('cm-wikilink')) {
      const tagText = target.textContent
      if (tagText && onTagClick) {
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


  const isToday = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header - draggable region */}
      <div
        className="px-6 pt-10 pb-4"
        style={{
          WebkitAppRegion: 'drag',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)'
        } as React.CSSProperties}
      >
        <h1
          className="text-xl font-semibold flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Daily Notes
          <span
            style={{
              opacity: todayLabelOpacity,
              color: 'var(--text-muted)',
              fontWeight: 400
            }}
          >
            Today
          </span>
          {/* Saving indicator - subtle dot */}
          {days.some(d => d.status === 'saving') && (
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--accent)' }}
            />
          )}
        </h1>
      </div>

      {/* Scrollable stream */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto px-6 py-4 relative"
        style={{ backgroundColor: 'var(--bg-primary)' }}
        onClick={handleEditorClick}
      >
          <div className="max-w-3xl mx-auto">
          {days.map((day, index) => {
            const isTodayEntry = isToday(day.date)
            // Check for real content (not just empty bullets)
            const hasContent = !/^(\s*-\s*)*$/.test(day.content)

            // Today: always show full editor, fills the entire viewport
            if (isTodayEntry) {
              return (
                <div key={day.dateString} className="flex flex-col relative" style={{ minHeight: 'calc(100vh - 100px)' }}>
                  {/* Today's editor - prominent, fills space */}
                  <div className="flex-1">
                    <CodeMirror
                      value={day.content}
                      onChange={(value) => handleContentChange(index, value)}
                      extensions={[
                        markdown(),
                        editorTheme,
                        syntaxHighlighting(highlightStyle),
                        tagHighlighter(),
                        outliner(),
                        EditorView.lineWrapping,
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
                  </div>

                  {/* Scroll indicator - fades as you scroll */}
                  <div
                    ref={todayEndRef}
                    className="flex flex-col items-center py-6 mt-auto"
                    style={{ opacity: todayLabelOpacity * 0.4 }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              )
            }

            // Past day with no content: collapsed row
            if (!hasContent) {
              const formatted = formatDateFromDate(day.date)
              return (
                <div
                  key={day.dateString}
                  className="flex items-center gap-3 py-3 mb-2"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatted.date}
                  </span>
                  {formatted.label && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {formatted.label}
                    </span>
                  )}
                  <span
                    className="text-sm italic"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    no notes
                  </span>
                </div>
              )
            }

            // Past day with content: show editor
            const formatted = formatDateFromDate(day.date)
            return (
              <div key={day.dateString} className="mt-6 mb-6">
                {/* Day header */}
                <div
                  className="flex items-center gap-3 mb-3 pb-2"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatted.date}
                  </h2>
                  {formatted.label && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {formatted.label}
                    </span>
                  )}
                </div>

                {/* Day editor */}
                <CodeMirror
                  value={day.content}
                  onChange={(value) => handleContentChange(index, value)}
                  extensions={[
                    markdown(),
                    editorTheme,
                    syntaxHighlighting(highlightStyle),
                    tagHighlighter(),
                    outliner(),
                    EditorView.lineWrapping,
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
                />
              </div>
            )
          })}

          {/* Loading indicator / sentinel */}
          <div ref={bottomRef} className="py-4 text-center">
            {isLoading && (
              <span style={{ color: 'var(--text-muted)' }}>Loading more...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
