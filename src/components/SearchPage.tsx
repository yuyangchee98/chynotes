import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Fuse, { FuseResult, FuseResultMatch } from 'fuse.js'
import { formatDate } from '../utils/format-date'

interface NoteEntry {
  date: string
  line: number
  content: string
}

interface GroupedResult {
  date: string
  matches: Array<{
    line: number
    content: string
    fuseMatches: readonly FuseResultMatch[] | undefined
  }>
}

interface SearchPageProps {
  onDateSelect: (date: Date) => void
  onTagClick: (tag: string) => void
}


export function SearchPage({ onDateSelect }: SearchPageProps) {
  const [query, setQuery] = useState('')
  const [allEntries, setAllEntries] = useState<NoteEntry[]>([])
  const [rawResults, setRawResults] = useState<FuseResult<NoteEntry>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const fuseRef = useRef<Fuse<NoteEntry> | null>(null)

  // Group results by date
  const groupedResults = useMemo((): GroupedResult[] => {
    const groups = new Map<string, GroupedResult>()

    for (const result of rawResults) {
      const { date, line, content } = result.item

      if (!groups.has(date)) {
        groups.set(date, { date, matches: [] })
      }

      groups.get(date)!.matches.push({
        line,
        content,
        fuseMatches: result.matches
      })
    }

    // Convert to array and sort by date (newest first)
    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date))
  }, [rawResults])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load all notes into memory for fuzzy search
  useEffect(() => {
    const loadAllNotes = async () => {
      if (!window.api) return

      setIsLoading(true)
      const entries: NoteEntry[] = []
      const dates = await window.api.listNotes()

      for (const dateStr of dates) {
        const content = await window.api.readNote(dateStr)
        if (!content) continue

        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line) {
            entries.push({
              date: dateStr,
              line: i + 1,
              content: lines[i]
            })
          }
        }
      }

      setAllEntries(entries)

      // Initialize Fuse.js
      fuseRef.current = new Fuse(entries, {
        keys: ['content'],
        threshold: 0.4, // 0 = exact, 1 = match anything
        distance: 100,
        includeMatches: true,
        minMatchCharLength: 2,
        ignoreLocation: true, // Search entire string, not just beginning
      })

      setIsLoading(false)
    }

    loadAllNotes()
  }, [])

  // Search when query changes
  useEffect(() => {
    if (!query.trim() || !fuseRef.current) {
      setRawResults([])
      return
    }

    const searchResults = fuseRef.current.search(query, { limit: 100 })
    setRawResults(searchResults)
  }, [query, allEntries])

  const handleResultClick = useCallback((dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    onDateSelect(date)
  }, [onDateSelect])

  // Highlight matched text using Fuse.js match indices
  const highlightMatch = (text: string, matches: readonly FuseResultMatch[] | undefined) => {
    if (!matches || matches.length === 0) return text

    const contentMatch = matches.find(m => m.key === 'content')
    if (!contentMatch || !contentMatch.indices) return text

    const parts: React.ReactNode[] = []
    let lastIdx = 0

    // Sort indices by start position
    const sortedIndices = [...contentMatch.indices].sort((a, b) => a[0] - b[0])

    for (const [start, end] of sortedIndices) {
      if (start > lastIdx) {
        parts.push(text.slice(lastIdx, start))
      }
      parts.push(
        <span
          key={start}
          style={{
            backgroundColor: 'var(--accent-subtle)',
            color: 'var(--accent)',
            fontWeight: 500,
            borderRadius: '2px',
            padding: '0 2px'
          }}
        >
          {text.slice(start, end + 1)}
        </span>
      )
      lastIdx = end + 1
    }

    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx))
    }

    return parts
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div
        className="pl-14 md:pl-6 pr-4 md:pr-6 pt-6 md:pt-10 pb-4"
        style={{
          WebkitAppRegion: 'drag',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)'
        } as React.CSSProperties}
      >
        <h1
          className="text-xl font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          Search
        </h1>
      </div>

      {/* Search input */}
      <div className="px-4 md:px-6 py-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--text-muted)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your notes..."
            className="w-full pl-12 pr-4 py-3 text-lg rounded-lg outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '2px solid var(--border)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div
        className="flex-1 overflow-auto px-4 md:px-6 pb-6"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-3xl mx-auto">
          {isLoading && (
            <div className="text-center py-12">
              <p style={{ color: 'var(--text-muted)' }}>Loading notes...</p>
            </div>
          )}

          {!isLoading && !query && (
            <div className="text-center py-16">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--border)', opacity: 0.5 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}

          {!isLoading && query && groupedResults.length === 0 && (
            <div className="text-center py-12">
              <p style={{ color: 'var(--text-muted)' }}>
                No results found for "{query}"
              </p>
            </div>
          )}

          {!isLoading && query && groupedResults.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {rawResults.length} result{rawResults.length !== 1 ? 's' : ''} in {groupedResults.length} day{groupedResults.length !== 1 ? 's' : ''}
              </p>

              {groupedResults.map((group) => (
                <div
                  key={group.date}
                  className="rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {/* Date header */}
                  <button
                    onClick={() => handleResultClick(group.date)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:opacity-80 transition-opacity"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <span
                      className="font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {formatDate(group.date).date}
                    </span>
                    {formatDate(group.date).label && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {formatDate(group.date).label}
                      </span>
                    )}
                    <span
                      className="text-sm ml-auto"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {group.matches.length} match{group.matches.length !== 1 ? 'es' : ''}
                    </span>
                  </button>

                  {/* Matching lines */}
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {group.matches.map((match, idx) => (
                      <button
                        key={`${group.date}-${match.line}-${idx}`}
                        onClick={() => handleResultClick(group.date)}
                        className="w-full text-left px-4 py-2.5 hover:opacity-70 transition-opacity"
                        style={{ backgroundColor: 'var(--bg-primary)' }}
                      >
                        <div
                          className="text-sm leading-relaxed"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {highlightMatch(match.content, match.fuseMatches)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
