import { useEffect, useState } from 'react'
import * as Diff from 'diff'

interface SnapshotRecord {
  id: number
  note_date: string
  content: string
  created_at: number
  content_hash: string
}

interface SnapshotTimelineProps {
  noteDate: string
  currentContent?: string
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return formatTime(timestamp)
}

export function SnapshotTimeline({ noteDate, currentContent }: SnapshotTimelineProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Load snapshots
  useEffect(() => {
    const loadSnapshots = async () => {
      if (!window.api || !noteDate) return
      const data = await window.api.getSnapshots(noteDate)
      setSnapshots(data)
    }
    loadSnapshots()

    // Refresh periodically
    const interval = setInterval(loadSnapshots, 5000)
    return () => clearInterval(interval)
  }, [noteDate])

  if (snapshots.length === 0) {
    return null
  }

  const selectedSnapshot = snapshots.find(s => s.id === selectedId)

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
        <span>Snapshots</span>
        <span
          className="ml-auto px-1.5 py-0.5 rounded text-xs"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          {snapshots.length}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-1">
          {/* Snapshot list */}
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {snapshots.map((snapshot, index) => (
              <button
                key={snapshot.id}
                onClick={() => setSelectedId(selectedId === snapshot.id ? null : snapshot.id)}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors"
                style={{
                  backgroundColor: selectedId === snapshot.id ? 'var(--accent-subtle)' : 'transparent',
                  color: selectedId === snapshot.id ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: index === 0 ? 'var(--accent)' : 'var(--text-muted)',
                    opacity: index === 0 ? 1 : 0.5,
                  }}
                />
                <span className="flex-1 text-left truncate">
                  {formatTime(snapshot.created_at)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {formatRelativeTime(snapshot.created_at)}
                </span>
              </button>
            ))}
          </div>

          {/* Diff view */}
          {selectedSnapshot && (() => {
            // Find the previous snapshot (older than selected)
            const selectedIndex = snapshots.findIndex(s => s.id === selectedId)
            const previousSnapshot = snapshots[selectedIndex + 1] // +1 because sorted newest first

            return (
              <div
                className="mt-2 p-2 rounded text-xs overflow-auto max-h-48"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                {currentContent ? (
                  <>
                    <div className="mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                      Changes since this snapshot:
                    </div>
                    <SimpleDiff oldText={selectedSnapshot.content} newText={currentContent} />
                  </>
                ) : previousSnapshot ? (
                  <>
                    <div className="mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                      Changes in this snapshot:
                    </div>
                    <SimpleDiff oldText={previousSnapshot.content} newText={selectedSnapshot.content} />
                  </>
                ) : (
                  <>
                    <div className="mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                      First snapshot:
                    </div>
                    <pre
                      className="whitespace-pre-wrap font-mono"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {selectedSnapshot.content}
                    </pre>
                  </>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// Diff display using diff library
function SimpleDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const changes = Diff.diffLines(oldText, newText)

  // Filter to only show actual changes
  const hasChanges = changes.some(part => part.added || part.removed)

  if (!hasChanges) {
    return (
      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
        No changes
      </div>
    )
  }

  return (
    <div className="space-y-0.5 font-mono">
      {changes.map((part, i) => {
        // Skip unchanged parts
        if (!part.added && !part.removed) return null

        const lines = part.value.split('\n').filter(line => line.length > 0)

        return lines.map((line, j) => (
          <div
            key={`${i}-${j}`}
            className="px-1 rounded"
            style={{
              backgroundColor: part.added
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              color: part.added
                ? 'rgb(34, 197, 94)'
                : 'rgb(239, 68, 68)',
              textDecoration: part.removed ? 'line-through' : 'none',
            }}
          >
            <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>
              {part.added ? '+' : '-'}
            </span>
            {line}
          </div>
        ))
      })}
    </div>
  )
}
