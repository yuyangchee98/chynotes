import { useMemo } from 'react'
import { diffWords } from 'diff'

interface DiffViewProps {
  oldText: string  // The snapshot content (base)
  newText: string  // The live content (current)
}

// Styled bullet dot matching the outliner extension
function BulletDot({ indent = 0 }: { indent?: number }) {
  const sizes = ['0.35em', '0.3em', '0.25em', '0.25em']
  const opacities = [1, 0.8, 0.65, 0.5]
  const size = sizes[Math.min(indent, 3)]
  const opacity = opacities[Math.min(indent, 3)]

  return (
    <span
      style={{
        display: 'inline-block',
        width: '1.5ch',
        textAlign: 'center',
        verticalAlign: 'baseline',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          backgroundColor: 'var(--accent)',
          borderRadius: '50%',
          verticalAlign: 'middle',
          position: 'relative',
          top: '-0.1em',
          opacity,
        }}
      />
    </span>
  )
}

// Process text to replace "- " bullets with styled dots
function processLineWithBullets(text: string, className?: string, style?: React.CSSProperties) {
  // Match lines that start with optional whitespace and "- "
  const bulletRegex = /^(\s*)-\s/
  const match = text.match(bulletRegex)

  if (match) {
    const indent = Math.floor(match[1].length / 2) // 2 spaces per indent level
    const rest = text.slice(match[0].length)
    return (
      <>
        <span style={style} className={className}>{match[1]}</span>
        <BulletDot indent={indent} />
        <span style={style} className={className}>{rest}</span>
      </>
    )
  }

  return <span style={style} className={className}>{text}</span>
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

  // Process diff parts, handling bullets on line starts
  const renderPart = (part: { value: string; added?: boolean; removed?: boolean }, index: number) => {
    const lines = part.value.split('\n')

    let style: React.CSSProperties = {}
    if (part.removed) {
      style = {
        textDecoration: 'line-through',
        color: 'var(--text-muted)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
      }
    } else if (part.added) {
      style = {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderRadius: '2px',
      }
    }

    return (
      <span key={index}>
        {lines.map((line, lineIndex) => (
          <span key={lineIndex}>
            {lineIndex > 0 && '\n'}
            {line.match(/^\s*-\s/)
              ? processLineWithBullets(line, undefined, style)
              : <span style={style}>{line}</span>
            }
          </span>
        ))}
      </span>
    )
  }

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '17px',
        lineHeight: '1.5',
        letterSpacing: '-0.015em',
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
      }}
    >
      {diffResult.map((part, index) => renderPart(part, index))}
    </div>
  )
}
