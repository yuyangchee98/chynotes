import { useEffect, useCallback } from 'react'

interface KeyboardShortcutCallbacks {
  onOpenSearch: () => void
  onGoToToday: () => void
  onEscape: () => void
}

/**
 * Global keyboard shortcuts for app-wide navigation
 *
 * - Cmd/Ctrl + K → Open search
 * - Cmd/Ctrl + G → Go to today
 * - Escape → Close/back navigation
 */
export function useKeyboardShortcuts(callbacks: KeyboardShortcutCallbacks) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl + K → Open search
      if (mod && e.key === 'k') {
        e.preventDefault()
        callbacks.onOpenSearch()
        return
      }

      // Cmd/Ctrl + G → Go to today
      if (mod && e.key === 'g') {
        e.preventDefault()
        callbacks.onGoToToday()
        return
      }

      // Escape → Close/back
      if (e.key === 'Escape') {
        // Don't prevent default - let other handlers (modals, etc.) also respond
        callbacks.onEscape()
        return
      }
    },
    [callbacks]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
