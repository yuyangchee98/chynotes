import { useEffect, useCallback, useState } from 'react'
import { KeyBinding, loadCustomBindings, getBinding, matchesBinding } from '../core/keyboard-config'

interface KeyboardShortcutCallbacks {
  onOpenSearch: () => void
  onGoToToday: () => void
  onEscape: () => void
}

/**
 * Global keyboard shortcuts for app-wide navigation
 *
 * - Cmd/Ctrl + K → Open search (customizable)
 * - Cmd/Ctrl + G → Go to today (customizable)
 * - Escape → Close/back navigation (fixed)
 */
export function useKeyboardShortcuts(callbacks: KeyboardShortcutCallbacks) {
  const [bindings, setBindings] = useState<Record<string, KeyBinding>>({})

  // Load custom bindings from settings
  useEffect(() => {
    const loadBindings = async () => {
      if (!window.api) return
      const bindingsJson = await window.api.getSetting('keyboardBindings')
      setBindings(loadCustomBindings(bindingsJson))
    }
    loadBindings()
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Get current bindings
      const openSearchBinding = getBinding('openSearch', bindings)
      const goToTodayBinding = getBinding('goToToday', bindings)

      // Check custom shortcuts
      if (matchesBinding(e, openSearchBinding)) {
        e.preventDefault()
        callbacks.onOpenSearch()
        return
      }

      if (matchesBinding(e, goToTodayBinding)) {
        e.preventDefault()
        callbacks.onGoToToday()
        return
      }

      // Escape → Close/back (not customizable)
      if (e.key === 'Escape') {
        // Don't prevent default - let other handlers (modals, etc.) also respond
        callbacks.onEscape()
        return
      }
    },
    [callbacks, bindings]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
