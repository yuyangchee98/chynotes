import { useEffect, useState } from 'react'

interface SidebarProps {
  onTagSelect: (tag: string) => void
  onDailyNotesSelect: () => void
  selectedTag: string | null
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSettingsClick: () => void
}

export function Sidebar({
  onTagSelect,
  onDailyNotesSelect,
  selectedTag,
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

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
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
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
            isSelected
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {hasChildren && (
            <span className="text-gray-400 text-xs">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className="text-blue-500 dark:text-blue-400">#</span>
          <span className="flex-1 text-left truncate">{node.displayName}</span>
          <span className="text-gray-400 text-xs">{node.count}</span>
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
      <div className="w-12 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center pt-10 pb-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header - extra top padding for macOS traffic lights */}
      <div className="px-4 pt-10 pb-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="font-semibold text-gray-800 dark:text-gray-200">chynotes</span>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Favorites */}
        <div className="px-3 py-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Favorites
          </h3>
          <button
            onClick={onDailyNotesSelect}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
              selectedTag === null
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Daily Notes</span>
          </button>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Tags
            </h3>
            <div className="space-y-0.5">
              {tags.map(tag => renderTagNode(tag))}
            </div>
          </div>
        )}

        {/* Recent */}
        {recentDates.length > 0 && (
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Recent
            </h3>
            <div className="space-y-0.5">
              {recentDates.map(date => (
                <button
                  key={date}
                  onClick={() => {
                    // TODO: Navigate to this date
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-md transition-colors"
                >
                  <span className="text-gray-400">•</span>
                  <span>{formatDate(date)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onSettingsClick}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-md transition-colors"
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
