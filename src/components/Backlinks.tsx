import { useEffect, useState, useCallback } from 'react'
import { formatDate } from '../utils/format-date'

interface BacklinksProps {
  pageName: string
  onBlockClick: (date: string, line: number) => void
  onTagClick?: (tag: string) => void
}

// Block display component with styled bullets
function BlockItem({
  block,
  depth = 0,
  onBlockClick,
  onTagClick,
}: {
  block: TagOccurrence
  depth?: number
  onBlockClick: (date: string, line: number) => void
  onTagClick?: (tag: string) => void
}) {
  // Remove block ID pattern from display
  const displayContent = block.content.replace(/\s*§[a-z0-9]+§\s*$/, '')

  // Handle clicks on wiki-links within the content
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement

    // Check if clicked on a tag link
    if (target.classList.contains('backlink-tag') && onTagClick) {
      e.stopPropagation()
      const tagName = target.getAttribute('data-tag')
      if (tagName) {
        onTagClick(tagName)
      }
      return
    }

    // Otherwise navigate to the block
    onBlockClick(block.date, block.line)
  }, [block.date, block.line, onBlockClick, onTagClick])

  // Render content with clickable wiki-links
  const renderContent = () => {
    // Replace wiki-links with clickable spans
    const parts: (string | JSX.Element)[] = []
    const regex = /\[\[([\w\-]+(?:\/[\w\-]+)*)\]\]/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(displayContent)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(displayContent.slice(lastIndex, match.index))
      }

      // Add the wiki-link as a clickable element
      const tagName = match[1].toLowerCase()
      parts.push(
        <span
          key={match.index}
          className="backlink-tag cursor-pointer"
          data-tag={tagName}
          style={{
            color: 'var(--accent)',
            fontWeight: '500',
            backgroundColor: 'var(--accent-subtle)',
            borderRadius: '3px',
            padding: '0 2px',
          }}
        >
          [[{match[1]}]]
        </span>
      )

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < displayContent.length) {
      parts.push(displayContent.slice(lastIndex))
    }

    return parts.length > 0 ? parts : displayContent
  }

  return (
    <div>
      <div
        className="flex items-start gap-2 py-1 px-2 -mx-2 rounded cursor-pointer transition-colors"
        style={{
          paddingLeft: `${depth * 20 + 8}px`,
        }}
        onClick={handleClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        {/* Styled bullet */}
        <span
          className="flex-shrink-0 mt-[0.6em]"
          style={{
            width: '0.35em',
            height: '0.35em',
            backgroundColor: 'var(--accent)',
            borderRadius: '50%',
            opacity: Math.max(0.4, 1 - depth * 0.2),
          }}
        />
        <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
          {renderContent()}
        </span>
      </div>
      {/* Render children */}
      {block.children?.map((child, idx) => (
        <BlockItem
          key={`${child.block_id}-${idx}`}
          block={child}
          depth={depth + 1}
          onBlockClick={onBlockClick}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  )
}

export function Backlinks({ pageName, onBlockClick, onTagClick }: BacklinksProps) {
  const [occurrences, setOccurrences] = useState<TagOccurrence[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load occurrences when pageName changes
  useEffect(() => {
    const loadOccurrences = async () => {
      setIsLoading(true)
      if (window.api) {
        try {
          const results = await window.api.getTagOccurrences(pageName)
          setOccurrences(results)
        } catch (err) {
          console.error('Failed to load backlinks:', err)
          setOccurrences([])
        }
      }
      setIsLoading(false)
    }
    loadOccurrences()
  }, [pageName])

  // Group occurrences by date
  const groupedByDate = occurrences.reduce((acc, occ) => {
    if (!acc[occ.date]) {
      acc[occ.date] = []
    }
    acc[occ.date].push(occ)
    return acc
  }, {} as Record<string, TagOccurrence[]>)

  if (isLoading) {
    return (
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading backlinks...
      </div>
    )
  }

  if (occurrences.length === 0) {
    return (
      <div>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Linked References
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No references to this page yet.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2
        className="text-sm font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Linked References ({occurrences.length})
      </h2>

      <div className="space-y-4">
        {Object.entries(groupedByDate).map(([date, items]) => {
          const formatted = formatDate(date)
          return (
            <div key={date}>
              <h3
                className="text-sm font-medium mb-2 flex items-center gap-2"
                style={{ color: 'var(--text-secondary)' }}
              >
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
              </h3>
              <div>
                {items.map((item, idx) => (
                  <BlockItem
                    key={`${item.block_id}-${idx}`}
                    block={item}
                    onBlockClick={onBlockClick}
                    onTagClick={onTagClick}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
