interface SnapshotRecord {
  id: number
  note_date: string
  content: string
  created_at: number
  content_hash: string
}

interface SnapshotSliderProps {
  snapshots: SnapshotRecord[]
  currentSnapshotId: number | null // null = live
  onSnapshotSelect: (id: number | null) => void
  onReturnToLive: () => void
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'pm' : 'am'
  const hour12 = hours % 12 || 12

  if (minutes === 0) {
    return `${hour12}${ampm}`
  }
  return `${hour12}:${minutes.toString().padStart(2, '0')}${ampm}`
}

export function SnapshotSlider({
  snapshots,
  currentSnapshotId,
  onSnapshotSelect,
  onReturnToLive,
}: SnapshotSliderProps) {
  // Sort snapshots oldest to newest (left to right)
  const sortedSnapshots = [...snapshots].sort((a, b) => a.created_at - b.created_at)

  const isLive = currentSnapshotId === null

  // Handle clicking on a snapshot dot
  const handleDotClick = (snapshotId: number) => {
    if (currentSnapshotId === snapshotId) {
      // Clicking current snapshot returns to live
      onReturnToLive()
    } else {
      onSnapshotSelect(snapshotId)
    }
  }

  // Handle clicking on "now" dot
  const handleNowClick = () => {
    onReturnToLive()
  }

  if (sortedSnapshots.length === 0) {
    return null
  }

  return (
    <div
      className="flex items-center gap-3"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Back to Live button - only show when viewing history */}
      {!isLive && (
        <button
          onClick={onReturnToLive}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors hover:opacity-80"
          style={{
            backgroundColor: 'var(--accent-subtle)',
            color: 'var(--accent)',
          }}
        >
          <span>←</span>
          <span>Live</span>
        </button>
      )}

      {/* Timeline track */}
      <div className="flex items-center gap-1">
        {/* Snapshot dots */}
        {sortedSnapshots.map((snapshot, index) => {
          const isSelected = currentSnapshotId === snapshot.id

          return (
            <div key={snapshot.id} className="flex items-center">
              {/* Connector line (not before first dot) */}
              {index > 0 && (
                <div
                  className="w-3 h-px"
                  style={{ backgroundColor: 'var(--border)' }}
                />
              )}

              {/* Dot with tooltip */}
              <button
                onClick={() => handleDotClick(snapshot.id)}
                className="relative group"
                title={formatTime(snapshot.created_at)}
              >
                <div
                  className="w-2 h-2 rounded-full transition-transform hover:scale-125"
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--accent)'
                      : 'var(--text-muted)',
                    opacity: isSelected ? 1 : 0.5,
                  }}
                />

                {/* Time label on hover */}
                <div
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {formatTime(snapshot.created_at)}
                </div>
              </button>
            </div>
          )
        })}

        {/* Connector to "now" */}
        <div
          className="w-3 h-px"
          style={{ backgroundColor: 'var(--border)' }}
        />

        {/* "Now" dot */}
        <button
          onClick={handleNowClick}
          className="relative group"
          title="Live"
        >
          <div
            className="w-2.5 h-2.5 rounded-full transition-transform hover:scale-125"
            style={{
              backgroundColor: isLive ? 'var(--accent)' : 'var(--text-muted)',
              opacity: isLive ? 1 : 0.5,
            }}
          />

          {/* "now" label */}
          <div
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            now
          </div>
        </button>
      </div>
    </div>
  )
}
