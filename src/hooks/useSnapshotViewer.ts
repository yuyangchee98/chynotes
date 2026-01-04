import { useState, useCallback } from 'react'

interface SnapshotRecord {
  id: number
  note_date: string
  content: string
  created_at: number
  content_hash: string
}

interface UseSnapshotViewerReturn {
  // Current viewing state
  viewingSnapshotId: number | null
  snapshotContent: string | null
  isViewingHistory: boolean
  snapshots: SnapshotRecord[]
  isDiffMode: boolean

  // Actions
  loadSnapshots: (noteDate: string) => Promise<void>
  viewSnapshot: (snapshotId: number) => void
  returnToLive: () => void
  toggleDiffMode: () => void
}

/**
 * Hook for managing snapshot viewing state.
 * When viewing a snapshot, the editor should display snapshotContent in read-only mode.
 */
export function useSnapshotViewer(): UseSnapshotViewerReturn {
  const [viewingSnapshotId, setViewingSnapshotId] = useState<number | null>(null)
  const [snapshotContent, setSnapshotContent] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([])
  const [isDiffMode, setIsDiffMode] = useState(false)

  const loadSnapshots = useCallback(async (noteDate: string) => {
    if (!window.api || !noteDate) {
      setSnapshots([])
      return
    }

    try {
      const data = await window.api.getSnapshots(noteDate)
      setSnapshots(data)
    } catch (err) {
      console.error('Failed to load snapshots:', err)
      setSnapshots([])
    }
  }, [])

  const viewSnapshot = useCallback((snapshotId: number) => {
    const snapshot = snapshots.find(s => s.id === snapshotId)
    if (snapshot) {
      setViewingSnapshotId(snapshotId)
      setSnapshotContent(snapshot.content)
    }
  }, [snapshots])

  const returnToLive = useCallback(() => {
    setViewingSnapshotId(null)
    setSnapshotContent(null)
  }, [])

  const toggleDiffMode = useCallback(() => {
    setIsDiffMode(prev => !prev)
  }, [])

  return {
    viewingSnapshotId,
    snapshotContent,
    isViewingHistory: viewingSnapshotId !== null,
    snapshots,
    isDiffMode,
    loadSnapshots,
    viewSnapshot,
    returnToLive,
    toggleDiffMode,
  }
}
