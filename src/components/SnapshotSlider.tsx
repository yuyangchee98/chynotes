import { useRef, useState, useCallback } from 'react'
import { Tooltip } from './Tooltip'
import type { SnapshotRecord } from '../core/types'

interface SnapshotSliderProps {
  snapshots: SnapshotRecord[]
  currentSnapshotId: number | null // null = live
  onSnapshotSelect: (id: number) => void
  onReturnToLive: () => void
  isDiffMode: boolean
  onToggleDiffMode: () => void
  hasUnsavedChanges?: boolean
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
  isDiffMode,
  onToggleDiffMode,
  hasUnsavedChanges = false,
}: SnapshotSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Sort snapshots oldest to newest (left to right)
  const sortedSnapshots = [...snapshots].sort((a, b) => a.created_at - b.created_at)

  const isLive = currentSnapshotId === null

  // Total positions = snapshots + 1 (for live)
  const totalPositions = sortedSnapshots.length + 1

  // Current position: 0 to sortedSnapshots.length (last = live)
  const currentPosition = isLive
    ? sortedSnapshots.length
    : sortedSnapshots.findIndex(s => s.id === currentSnapshotId)

  // Convert position to percentage
  const thumbPercent = totalPositions > 1
    ? (currentPosition / (totalPositions - 1)) * 100
    : 100

  // Get time label for current position
  const currentTimeLabel = isLive
    ? 'now'
    : formatTime(sortedSnapshots[currentPosition]?.created_at ?? Date.now())

  // Handle position from mouse/touch event
  const getPositionFromEvent = useCallback((clientX: number): number => {
    if (!trackRef.current) return sortedSnapshots.length
    const rect = trackRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    // Map to nearest position
    const position = Math.round(percent * (totalPositions - 1))
    return position
  }, [totalPositions, sortedSnapshots.length])

  // Select snapshot at position
  const selectPosition = useCallback((position: number) => {
    if (position >= sortedSnapshots.length) {
      onReturnToLive()
    } else if (position >= 0 && position < sortedSnapshots.length) {
      onSnapshotSelect(sortedSnapshots[position].id)
    }
  }, [sortedSnapshots, onSnapshotSelect, onReturnToLive])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const position = getPositionFromEvent(e.clientX)
    selectPosition(position)

    const handleMouseMove = (e: MouseEvent) => {
      const position = getPositionFromEvent(e.clientX)
      selectPosition(position)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [getPositionFromEvent, selectPosition])

  if (sortedSnapshots.length === 0) {
    return null
  }

  return (
    <div
      className="flex items-center gap-3"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Timeline scrubber - pulses when unsaved changes */}
      <Tooltip explanationKey="timeline">
        <div className={`flex items-center gap-2 ${hasUnsavedChanges ? 'animate-pulse' : ''}`}>
          {/* Time label - only show when not at live */}
          {!isLive && (
            <span
              className="text-xs min-w-[50px] text-right"
              style={{ color: 'var(--text-muted)' }}
            >
              {currentTimeLabel}
            </span>
          )}

          {/* Scrubber track */}
          <div
            ref={trackRef}
            className="relative w-24 h-6 flex items-center cursor-pointer"
            onMouseDown={handleMouseDown}
          >
            {/* Track background */}
            <div
              className="absolute inset-x-0 h-1 rounded-full"
              style={{ backgroundColor: 'var(--border)' }}
            />

            {/* Filled portion */}
            <div
              className="absolute left-0 h-1 rounded-full transition-all"
              style={{
                width: `${thumbPercent}%`,
                backgroundColor: 'var(--accent)',
                opacity: 0.5,
                transitionDuration: isDragging ? '0ms' : '150ms',
              }}
            />

            {/* Thumb */}
            <div
              className="absolute w-3 h-3 rounded-full transition-all"
              style={{
                left: `${thumbPercent}%`,
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--accent)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transitionDuration: isDragging ? '0ms' : '150ms',
              }}
            />
          </div>

          {/* Right endpoint label */}
          <span
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Live
          </span>
        </div>
      </Tooltip>

      {/* Changes toggle button */}
      <Tooltip explanationKey="diffToggle">
        <button
          onClick={onToggleDiffMode}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-all hover:opacity-80"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            opacity: isDiffMode ? 1 : 0.6,
          }}
        >
          <span>{isDiffMode ? '●' : '○'}</span>
          <span>Changes</span>
        </button>
      </Tooltip>
    </div>
  )
}
