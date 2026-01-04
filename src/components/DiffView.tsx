import { useMemo } from 'react'
import { diffWords } from 'diff'

interface DiffViewProps {
  oldText: string  // The snapshot content (base)
  newText: string  // The live content (current)
}

/**
 * Renders a diff view showing:
 * - Strikethrough for text that was removed (in old but not new)
 * - Highlighted for text that was added (in new but not old)
 */
export function DiffView({ oldText, newText }: DiffViewProps) {
  const diffResult = useMemo(() => {
    return diffWords(oldText, newText)
  }, [oldText, newText])

  return (
    <div
      className="whitespace-pre-wrap font-sans text-base leading-relaxed"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '17px',
        lineHeight: '1.5',
        letterSpacing: '-0.015em',
        color: 'var(--text-primary)',
      }}
    >
      {diffResult.map((part, index) => {
        if (part.removed) {
          // Text that was deleted - show with strikethrough
          return (
            <span
              key={index}
              style={{
                textDecoration: 'line-through',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
            >
              {part.value}
            </span>
          )
        }

        if (part.added) {
          // Text that was added - show with highlight
          return (
            <span
              key={index}
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                borderRadius: '2px',
              }}
            >
              {part.value}
            </span>
          )
        }

        // Unchanged text
        return <span key={index}>{part.value}</span>
      })}
    </div>
  )
}
