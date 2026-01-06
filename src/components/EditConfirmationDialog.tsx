import { Tooltip } from './Tooltip'

interface EditConfirmationDialogProps {
  isOpen: boolean
  dateString: string
  blockContent?: string // The clicked block's content (may include children)
  onEditAnyway: () => void
  onReferenceToToday: () => void
  onCancel: () => void
}

export function EditConfirmationDialog({
  isOpen,
  dateString,
  blockContent,
  onEditAnyway,
  onReferenceToToday,
  onCancel,
}: EditConfirmationDialogProps) {
  if (!isOpen) return null

  // Process block content for display - strip block IDs and format nicely
  const formatBlockContent = (content: string | undefined) => {
    if (!content) return null

    const lines = content.split('\n')
    const formattedLines = lines.map(line => {
      // Strip block ID
      let formatted = line.replace(/§[a-f0-9]{8}§\s*$/, '')
      // Convert leading spaces to visual indent but keep bullet
      return formatted
    })

    return formattedLines
  }

  const displayLines = formatBlockContent(blockContent)
  const hasChildren = displayLines && displayLines.length > 1

  // Get first line content for display (stripped of bullet and ID)
  const firstLineDisplay = displayLines?.[0]
    ?.replace(/^\s*-\s*/, '')
    ?.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-lg shadow-xl p-6 max-w-lg mx-4"
        style={{ backgroundColor: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip explanationKey="softLock">
          <h2
            className="text-lg font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            Edit Past Note?
          </h2>
        </Tooltip>
        <p
          className="mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          This note is from <strong>{dateString}</strong>.
        </p>

        {/* Show clicked block preview */}
        {displayLines && displayLines.length > 0 && (
          <div
            className="mb-4 p-3 rounded-md text-sm max-h-48 overflow-auto"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderLeft: '3px solid var(--accent)',
            }}
          >
            <div
              className="text-xs mb-2 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Selected block{hasChildren ? ' (with children)' : ''}:
            </div>
            <div
              className="font-mono text-xs whitespace-pre-wrap"
              style={{ color: 'var(--text-primary)' }}
            >
              {displayLines.map((line, i) => (
                <div key={i} style={{ color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {line.replace(/§[a-f0-9]{8}§\s*$/, '')}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
          {firstLineDisplay && (
            <button
              onClick={onReferenceToToday}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              Reference to Today
            </button>
          )}
          <button
            onClick={onEditAnyway}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'white',
            }}
          >
            Edit Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
