import { useEffect, useState } from 'react'
import { formatDate } from '../utils/format-date'

interface SidebarProps {
  onTagSelect: (tag: string) => void
  onDailyNotesSelect: () => void
  onDateSelect: (date: Date) => void
  onSearchSelect: () => void
  selectedTag: string | null
  isSearchView: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSettingsClick: () => void
}

export function Sidebar({
  onTagSelect,
  onDailyNotesSelect,
  onDateSelect,
  onSearchSelect,
  selectedTag,
  isSearchView,
  isCollapsed,
  onToggleCollapse,
  onSettingsClick,
}: SidebarProps) {
  const [tags, setTags] = useState<TagTreeNode[]>([])
  const [recentDates, setRecentDates] = useState<string[]>([])
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())

  // Load tags and recent notes
  useEffect(() => {
    const loadData = async () => {
      if (window.api) {
        const [tagTree, dates] = await Promise.all([
          window.api.getTagTree(),
          window.api.listNotes(),
        ])
        setTags(tagTree)
        setRecentDates(dates.slice(0, 7)) // Last 7 days
      }
    }
    loadData()

    // Refresh every 5 seconds to pick up new tags
    const interval = setInterval(loadData, 5000)
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
          <span style={{ color: 'var(--accent)' }}>#</span>
          <span className="flex-1 text-left truncate">{node.displayName}</span>
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

  if (isCollapsed) {
    return (
      <div
        className="w-12 flex flex-col items-center pt-10 pb-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        <button
          onClick={onToggleCollapse}
          className="p-2 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
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
        className="px-4 pt-10 pb-3 flex items-center justify-between"
        style={{ WebkitAppRegion: 'drag', borderBottom: '1px solid var(--border)' } as React.CSSProperties}
      >
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>chynotes</span>
        <button
          onClick={onToggleCollapse}
          className="p-1 transition-colors"
          style={{ WebkitAppRegion: 'no-drag', color: 'var(--text-muted)' } as React.CSSProperties}
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Primary navigation */}
        <div className="px-3 pt-3 pb-2 space-y-1">
          {/* Daily Notes */}
          <button
            onClick={onDailyNotesSelect}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-base font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: selectedTag === null && !isSearchView ? 'var(--accent-subtle)' : 'transparent',
              color: selectedTag === null && !isSearchView ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Daily Notes</span>
          </button>

          {/* Search */}
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
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="px-3 py-2">
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Tags
            </h3>
            <div className="space-y-0.5">
              {tags.map(tag => renderTagNode(tag))}
            </div>
          </div>
        )}

        {/* History */}
        {recentDates.length > 0 && (
          <div className="px-3 py-2">
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              History
            </h3>
            <div className="space-y-0.5">
              {recentDates.map(dateStr => {
                const [year, month, day] = dateStr.split('-').map(Number)
                const date = new Date(year, month - 1, day)
                const formatted = formatDate(dateStr)
                return (
                  <button
                    key={dateStr}
                    onClick={() => onDateSelect(date)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
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
