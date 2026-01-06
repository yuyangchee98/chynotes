interface EditConfirmationDialogProps {
  isOpen: boolean
  dateString: string
  blockContent?: string // The clicked block's content to show
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

  // Strip block ID and bullet from display
  const displayContent = blockContent
    ?.replace(/§[a-f0-9]{8}§\s*$/, '')
    ?.replace(/^\s*-\s*/, '')
    ?.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-lg shadow-xl p-6 max-w-md mx-4"
        style={{ backgroundColor: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          Edit Past Note?
        </h2>
        <p
          className="mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          This note is from <strong>{dateString}</strong>.
        </p>

        {/* Show clicked block preview */}
        {displayContent && (
          <div
            className="mb-4 p-3 rounded-md text-sm"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderLeft: '3px solid var(--accent)',
              color: 'var(--text-secondary)',
            }}
          >
            <div
              className="text-xs mb-1 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Selected block:
            </div>
            <div style={{ color: 'var(--text-primary)' }}>
              {displayContent.length > 100
                ? displayContent.slice(0, 100) + '...'
                : displayContent}
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
          {displayContent && (
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
