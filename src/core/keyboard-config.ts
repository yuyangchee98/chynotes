/**
 * Keyboard shortcuts configuration and management
 */

export type ShortcutAction =
  // Navigation
  | 'openSearch'
  | 'goToToday'
  // Formatting
  | 'bold'
  | 'italic'
  | 'strikethrough'

export interface KeyBinding {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
}

export interface ShortcutConfig {
  action: ShortcutAction
  label: string
  category: 'navigation' | 'formatting'
  defaultBinding: KeyBinding
}

// Default keyboard shortcuts
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  // Navigation
  {
    action: 'openSearch',
    label: 'Open Search',
    category: 'navigation',
    defaultBinding: { key: 'k', ctrl: true, meta: true },
  },
  {
    action: 'goToToday',
    label: 'Go to Today',
    category: 'navigation',
    defaultBinding: { key: 'g', ctrl: true, meta: true },
  },
  // Formatting
  {
    action: 'bold',
    label: 'Bold',
    category: 'formatting',
    defaultBinding: { key: 'b', ctrl: true, meta: true },
  },
  {
    action: 'italic',
    label: 'Italic',
    category: 'formatting',
    defaultBinding: { key: 'i', ctrl: true, meta: true },
  },
  {
    action: 'strikethrough',
    label: 'Strikethrough',
    category: 'formatting',
    defaultBinding: { key: 's', ctrl: true, meta: true, shift: true },
  },
]

/**
 * Format a key binding for display
 */
export function formatKeyBinding(binding: KeyBinding): string {
  const parts: string[] = []

  if (binding.ctrl && binding.meta) {
    parts.push('⌘/Ctrl')
  } else if (binding.meta) {
    parts.push('⌘')
  } else if (binding.ctrl) {
    parts.push('Ctrl')
  }

  if (binding.shift) parts.push('Shift')
  if (binding.alt) parts.push('Alt')

  parts.push(binding.key.toUpperCase())

  return parts.join('+')
}

/**
 * Check if a keyboard event matches a binding
 */
export function matchesBinding(event: { key: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean }, binding: KeyBinding): boolean {
  // Check modifiers
  const ctrlMatch = binding.ctrl ? (!!event.ctrlKey || !!event.metaKey) : !event.ctrlKey
  const metaMatch = binding.meta ? (!!event.metaKey || !!event.ctrlKey) : !event.metaKey
  const shiftMatch = binding.shift ? !!event.shiftKey : !event.shiftKey
  const altMatch = binding.alt ? !!event.altKey : !event.altKey

  // Check key
  const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase()

  return !!(keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch)
}

/**
 * Get a keyboard binding from settings, falling back to default
 */
export function getBinding(action: ShortcutAction, customBindings: Record<string, KeyBinding>): KeyBinding {
  if (customBindings[action]) {
    return customBindings[action]
  }

  const defaultConfig = DEFAULT_SHORTCUTS.find(s => s.action === action)
  return defaultConfig?.defaultBinding || { key: '' }
}

/**
 * Load custom keyboard bindings from settings string
 */
export function loadCustomBindings(settingsJson: string | null): Record<string, KeyBinding> {
  if (!settingsJson) return {}

  try {
    return JSON.parse(settingsJson)
  } catch {
    return {}
  }
}

/**
 * Save custom keyboard bindings to settings string
 */
export function saveCustomBindings(bindings: Record<string, KeyBinding>): string {
  return JSON.stringify(bindings)
}
