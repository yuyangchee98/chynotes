import { useEffect, useRef, useState, useCallback } from 'react'

const SNAPSHOT_DELAY = 5000 // 5 seconds of inactivity

interface UseSnapshotDebounceReturn {
  // Progress from 0 to 1 for visual indicator
  snapshotProgress: number
  // Whether a snapshot is currently being saved
  isSaving: boolean
  // Manually trigger a snapshot (e.g., on blur/close)
  triggerSnapshot: () => Promise<void>
}

/**
 * Hook that automatically saves snapshots after a period of inactivity.
 *
 * @param noteDate - The date string (YYYY-MM-DD) for the note
 * @param content - Current content of the note
 * @param enabled - Whether snapshot saving is enabled
 */
export function useSnapshotDebounce(
  noteDate: string,
  content: string,
  enabled: boolean = true
): UseSnapshotDebounceReturn {
  const [snapshotProgress, setSnapshotProgress] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef<string>(content)
  const startTimeRef = useRef<number>(0)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setSnapshotProgress(0)
  }, [])

  const saveSnapshot = useCallback(async () => {
    if (!window.api || !noteDate || !content) return

    setIsSaving(true)
    try {
      await window.api.saveSnapshot(noteDate, content)
      lastContentRef.current = content
    } catch (err) {
      console.error('Failed to save snapshot:', err)
    } finally {
      setIsSaving(false)
      setSnapshotProgress(0)
    }
  }, [noteDate, content])

  const triggerSnapshot = useCallback(async () => {
    clearTimers()
    await saveSnapshot()
  }, [clearTimers, saveSnapshot])

  useEffect(() => {
    if (!enabled || !noteDate) {
      clearTimers()
      return
    }

    // Content changed - reset timer
    clearTimers()

    // Don't snapshot empty or default content
    const isEmpty = /^(\s*-\s*)*$/.test(content)
    if (isEmpty) return

    // Start the countdown
    startTimeRef.current = Date.now()

    // Update progress every 100ms
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(elapsed / SNAPSHOT_DELAY, 1)
      setSnapshotProgress(progress)
    }, 100)

    // Set timer to save snapshot
    timerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      saveSnapshot()
    }, SNAPSHOT_DELAY)

    return () => {
      clearTimers()
    }
  }, [content, noteDate, enabled, clearTimers, saveSnapshot])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  return {
    snapshotProgress,
    isSaving,
    triggerSnapshot,
  }
}
