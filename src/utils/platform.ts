/**
 * Platform detection utilities for keyboard shortcuts
 */

// Detect if user is on Mac for displaying correct modifier key
export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

export const modKey = isMac ? '⌘' : 'Ctrl'

/**
 * Format a shortcut for display
 * "mod+k" → "⌘K" (Mac) or "Ctrl+K" (Windows/Linux)
 * "mod+shift+s" → "⌘⇧S" (Mac) or "Ctrl+Shift+S" (Windows/Linux)
 */
export function formatShortcut(shortcut: string): string {
  const parts = shortcut.toLowerCase().split('+')

  return parts
    .map((part) => {
      switch (part) {
        case 'mod':
          return modKey
        case 'shift':
          return isMac ? '⇧' : 'Shift+'
        case 'alt':
          return isMac ? '⌥' : 'Alt+'
        default:
          return part.toUpperCase()
      }
    })
    .join('')
}
