interface EditConfirmationDialogProps {
  isOpen: boolean
  dateString: string
  onEditAnyway: () => void
  onCopyToToday: () => void
  onCancel: () => void
}

export function EditConfirmationDialog({
  isOpen,
  dateString,
  onEditAnyway,
  onCopyToToday,
  onCancel,
}: EditConfirmationDialogProps) {
  if (!isOpen) return null

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
          className="mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          This note is from <strong>{dateString}</strong>. Would you like to edit it anyway, or copy your thoughts to today's note?
        </p>
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
          <button
            onClick={onCopyToToday}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          >
            Copy to Today
          </button>
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
