import { useEffect, useState } from 'react'
import { formatDate } from '../utils/format-date'
import { Tooltip } from './Tooltip'

interface SystemStatus {
  indexing: { isActive: boolean; message: string | null }
  frequencyIndex: { isActive: boolean; message: string | null }
  embeddings: { isActive: boolean; queueLength: number; message: string | null }
  ready: boolean
  lastActivityAt: number | null
}

interface StatusCounts {
  notes: number
  tags: number
  embeddedBlocks: number
  totalBlocks: number
}

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return 'never'
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface SidebarProps {
  onTagSelect: (tag: string) => void
  onDailyNotesSelect: () => void
  onDateSelect: (date: Date) => void
  onSearchSelect: () => void
  selectedTag: string | null
  selectedDate: string | null  // YYYY-MM-DD format when viewing single day
  isStreamView: boolean
  isSearchView: boolean
  onSettingsClick: () => void
}

export function Sidebar({
  onTagSelect,
  onDailyNotesSelect,
  onDateSelect,
  onSearchSelect,
  selectedTag,
  selectedDate,
  isStreamView,
  isSearchView,
  onSettingsClick,
}: SidebarProps) {
  const [tags, setTags] = useState<TagTreeNode[]>([])
  const [recentDates, setRecentDates] = useState<string[]>([])
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ notes: 0, tags: 0, embeddedBlocks: 0, totalBlocks: 0 })

  // Load tags and recent notes
  useEffect(() => {
    const loadData = async () => {
      if (window.api) {
        const [tagTree, dates, embeddingStats] = await Promise.all([
          window.api.getTagTree(),
          window.api.listNotes(),
          window.api.getEmbeddingStats(),
        ])
        setTags(tagTree)
        setRecentDates(dates.slice(0, 7)) // Last 7 days

        // Count total tags from tree
        const countTags = (nodes: TagTreeNode[]): number =>
          nodes.reduce((sum, n) => sum + 1 + countTags(n.children), 0)

        setStatusCounts({
          notes: dates.length,
          tags: countTags(tagTree),
          embeddedBlocks: embeddingStats.embeddedBlocks,
          totalBlocks: embeddingStats.totalBlocks,
        })
      }
    }
    loadData()

    // Refresh every 5 seconds to pick up new tags
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  // Poll system status
  useEffect(() => {
    const pollStatus = async () => {
      if (window.api?.getSystemStatus) {
        try {
          const status = await window.api.getSystemStatus()
          setSystemStatus(status)
        } catch {
          // Handler not available yet, ignore
        }
      }
    }
    pollStatus()
    const interval = setInterval(pollStatus, 1000) // Poll every second while processing
    return () => clearInterval(interval)
  }, [])

  const toggleExpand = (tagName: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev)
      if (next.has(tagName)) {
        next.delete(tagName)
      } else {
        next.add(tagName)
      }
      return next
    })
  }


  const renderTagNode = (node: TagTreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedTags.has(node.name)
    const isSelected = selectedTag === node.name

    return (
      <div key={node.name}>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleExpand(node.name)
            }
            onTagSelect(node.name)
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors"
          style={{
            paddingLeft: `${12 + depth * 16}px`,
            backgroundColor: isSelected ? 'var(--accent-subtle)' : 'transparent',
            color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {hasChildren && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className="flex-1 text-left truncate">
            <span style={{ color: 'var(--accent)', opacity: 0.5 }}>[[</span>{node.displayName}<span style={{ color: 'var(--accent)', opacity: 0.5 }}>]]</span>
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{node.count}</span>
        </button>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderTagNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="w-64 flex flex-col h-full"
      style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {/* Header - draggable region for window, padded for traffic lights */}
      <div
        className="px-4 pt-10 pb-3"
        style={{ WebkitAppRegion: 'drag', borderBottom: '1px solid var(--border)' } as React.CSSProperties}
      >
        <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>chynotes</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Primary navigation */}
        <div className="px-3 pt-3 pb-2 space-y-1">
          {/* Daily Notes */}
          <Tooltip explanationKey="dailyNotes" onTagClick={onTagSelect}>
            <button
              onClick={onDailyNotesSelect}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-base font-medium rounded-lg transition-colors"
              style={{
                backgroundColor: isStreamView ? 'var(--accent-subtle)' : 'transparent',
                color: isStreamView ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Daily Notes</span>
            </button>
          </Tooltip>

          {/* Search */}
          <Tooltip explanationKey="search">
            <button
              onClick={onSearchSelect}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-base font-medium rounded-lg transition-colors"
              style={{
                backgroundColor: isSearchView ? 'var(--accent-subtle)' : 'transparent',
                color: isSearchView ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search</span>
            </button>
          </Tooltip>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="px-3 py-2">
            <Tooltip explanationKey="tagsSection">
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Tags
              </h3>
            </Tooltip>
            <div className="space-y-0.5">
              {tags.map(tag => renderTagNode(tag))}
            </div>
          </div>
        )}

        {/* History */}
        {recentDates.length > 0 && (
          <div className="px-3 py-2">
            <Tooltip explanationKey="history">
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                History
              </h3>
            </Tooltip>
            <div className="space-y-0.5">
              {recentDates.map(dateStr => {
                const [year, month, day] = dateStr.split('-').map(Number)
                const date = new Date(year, month - 1, day)
                const formatted = formatDate(dateStr)
                const isSelected = selectedDate === dateStr
                return (
                  <button
                    key={dateStr}
                    onClick={() => onDateSelect(date)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-subtle)' : 'transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span>{formatted.date}</span>
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
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        {/* System status indicator - always visible */}
        {(() => {
          const isProcessing = systemStatus?.indexing.isActive ||
                               systemStatus?.frequencyIndex.isActive ||
                               systemStatus?.embeddings.isActive

          if (isProcessing && systemStatus) {
            return (
              <div
                className="flex items-center gap-2 px-3 py-1.5 mb-1 text-xs rounded-md"
                style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)' }}
                title={[
                  systemStatus.indexing.message,
                  systemStatus.frequencyIndex.message,
                  systemStatus.embeddings.message,
                ].filter(Boolean).join('\n') || 'Processing...'}
              >
                <svg className="w-3 h-3 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>
                  {systemStatus.indexing.isActive && 'Indexing...'}
                  {systemStatus.frequencyIndex.isActive && 'Building index...'}
                  {systemStatus.embeddings.isActive && `Embedding (${systemStatus.embeddings.queueLength})`}
                </span>
              </div>
            )
          }

          return (
            <div
              className="px-3 py-1.5 mb-1 text-xs rounded-md"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)' }}
            >
              <div>{statusCounts.notes} notes · {statusCounts.tags} tags</div>
              <div>{statusCounts.embeddedBlocks} embedded · {formatTimeAgo(systemStatus?.lastActivityAt ?? null)}</div>
            </div>
          )
        })()}
        <button
          onClick={onSettingsClick}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
