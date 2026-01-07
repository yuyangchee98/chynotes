import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
  keymap,
} from '@codemirror/view'
import { RangeSetBuilder, Prec, StateField, StateEffect, EditorSelection } from '@codemirror/state'

/**
 * Tag suggestion from the backend
 */
interface TagSuggestion {
  term: string
  tag: string
  startIndex: number
  endIndex: number
  confidence: number
  reason: 'exact' | 'fuzzy' | 'frequency' | 'semantic'
}

/**
 * Internal suggestion with absolute document positions
 */
interface ResolvedSuggestion extends TagSuggestion {
  docStart: number
  docEnd: number
  lineNumber: number
}

// State effect to update suggestions
const setSuggestions = StateEffect.define<ResolvedSuggestion[]>()
const clearSuggestions = StateEffect.define<void>()

// State field to track current suggestions
const suggestionState = StateField.define<ResolvedSuggestion[]>({
  create: () => [],
  update(suggestions, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSuggestions)) {
        return effect.value
      }
      if (effect.is(clearSuggestions)) {
        return []
      }
    }
    // Clear suggestions if document changed (user is typing)
    if (tr.docChanged) {
      return []
    }
    return suggestions
  }
})

/**
 * Widget for ghost opening bracket [[
 */
class GhostOpenBracketWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-ghost-bracket cm-ghost-open'
    span.textContent = '[['
    return span
  }

  eq() {
    return true
  }

  ignoreEvent() {
    return true
  }
}

/**
 * Widget for ghost closing bracket ]]
 */
class GhostCloseBracketWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-ghost-bracket cm-ghost-close'
    span.textContent = ']]'
    return span
  }

  eq() {
    return true
  }

  ignoreEvent() {
    return true
  }
}

/**
 * Widget for the "Tab to link" hint at end of line
 */
class TabHintWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-tag-hint'
    span.textContent = 'Tab to link'
    span.title = 'Press Tab to accept suggestion, Esc to dismiss'
    return span
  }

  eq() {
    return true
  }

  ignoreEvent() {
    return true
  }
}

/**
 * Build decorations from suggestions
 */
function buildGhostDecorations(suggestions: ResolvedSuggestion[], doc: { line: (n: number) => { to: number } }): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  if (suggestions.length === 0) {
    return builder.finish()
  }

  // Sort by position
  const sorted = [...suggestions].sort((a, b) => a.docStart - b.docStart)

  for (const suggestion of sorted) {
    // Add opening [[ widget before the term
    builder.add(
      suggestion.docStart,
      suggestion.docStart,
      Decoration.widget({
        widget: new GhostOpenBracketWidget(),
        side: -1, // Before the position
      })
    )

    // Add closing ]] widget after the term
    builder.add(
      suggestion.docEnd,
      suggestion.docEnd,
      Decoration.widget({
        widget: new GhostCloseBracketWidget(),
        side: 1, // After the position
      })
    )
  }

  // Add hint at end of line (use the line of the first suggestion)
  const firstSuggestion = sorted[0]
  const line = doc.line(firstSuggestion.lineNumber)
  builder.add(
    line.to,
    line.to,
    Decoration.widget({
      widget: new TabHintWidget(),
      side: 1,
    })
  )

  return builder.finish()
}

/**
 * ViewPlugin to render ghost decorations
 */
const ghostDecorator = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      const suggestions = view.state.field(suggestionState)
      this.decorations = buildGhostDecorations(suggestions, view.state.doc)
    }

    update(update: ViewUpdate) {
      // Rebuild decorations when suggestions change
      const suggestions = update.state.field(suggestionState)
      this.decorations = buildGhostDecorations(suggestions, update.state.doc)
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

/**
 * Accept the first (leftmost) suggestion
 */
function acceptFirstSuggestion(view: EditorView): boolean {
  const suggestions = view.state.field(suggestionState)

  if (suggestions.length === 0) {
    return false // Let Tab do default behavior
  }

  const first = suggestions[0]

  // Insert [[ before and ]] after the term
  const changes = [
    { from: first.docStart, insert: '[[' },
    { from: first.docEnd, insert: ']]' },
  ]

  // Calculate new cursor position (after the closing brackets)
  const newCursorPos = first.docEnd + 4 // +2 for [[ and +2 for ]]

  // Remove this suggestion from state
  const remaining = suggestions.slice(1).map(s => ({
    ...s,
    // Adjust positions for suggestions after this one
    docStart: s.docStart + 4,
    docEnd: s.docEnd + 4,
  }))

  view.dispatch({
    changes,
    selection: EditorSelection.cursor(newCursorPos),
    effects: setSuggestions.of(remaining),
  })

  return true
}

/**
 * Dismiss all suggestions
 */
function dismissSuggestions(view: EditorView): boolean {
  const suggestions = view.state.field(suggestionState)

  if (suggestions.length === 0) {
    return false
  }

  view.dispatch({
    effects: clearSuggestions.of(undefined),
  })

  return true
}

/**
 * Keymap for accepting/dismissing suggestions
 * Uses highest precedence to override outliner's Tab handler when suggestions exist
 */
const suggestionKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Tab',
      run: acceptFirstSuggestion,
    },
    {
      key: 'Escape',
      run: dismissSuggestions,
    },
  ])
)

/**
 * Debounce helper
 */
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Plugin that fetches suggestions after typing stops
 */
function createSuggestionFetcher() {
  let lastCursorLine = -1

  const fetchSuggestions = debounce(async (view: EditorView) => {
    // Don't fetch if view is no longer valid
    if (!view.dom.isConnected) return

    // Get CURRENT cursor position (not stale)
    const { state } = view
    const { main } = state.selection
    const line = state.doc.lineAt(main.from)
    const lineNumber = line.number
    const lineText = line.text

    // Skip empty lines or very short lines
    if (lineText.trim().length < 3) {
      view.dispatch({ effects: clearSuggestions.of(undefined) })
      return
    }

    try {
      // Get suggestions from backend
      const suggestions: TagSuggestion[] = await (window as unknown as { api: { getTagSuggestions: (text: string) => Promise<TagSuggestion[]> } }).api.getTagSuggestions(lineText)

      if (suggestions.length === 0) {
        view.dispatch({ effects: clearSuggestions.of(undefined) })
        return
      }

      // Convert to resolved suggestions with document positions
      const resolved: ResolvedSuggestion[] = suggestions.map(s => ({
        ...s,
        docStart: line.from + s.startIndex,
        docEnd: line.from + s.endIndex,
        lineNumber,
      }))

      view.dispatch({ effects: setSuggestions.of(resolved) })
    } catch (error) {
      console.error('Failed to fetch tag suggestions:', error)
    }
  }, 500) // 500ms debounce

  return EditorView.updateListener.of((update) => {
    // Only fetch when document changes or selection changes
    if (!update.docChanged && !update.selectionSet) return

    const { state } = update
    const { main } = state.selection

    // Get current line
    const line = state.doc.lineAt(main.from)
    const lineNumber = line.number

    // If cursor moved to a different line, clear suggestions
    if (lineNumber !== lastCursorLine) {
      lastCursorLine = lineNumber
      update.view.dispatch({ effects: clearSuggestions.of(undefined) })
    }

    // Fetch suggestions (debounced) - will read current position when it fires
    fetchSuggestions(update.view)
  })
}

/**
 * CSS theme for ghost brackets and hint
 */
const ghostTheme = EditorView.theme({
  '.cm-ghost-bracket': {
    color: 'var(--text-muted, #888)',
    opacity: '0.5',
    fontWeight: 'normal',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  '.cm-tag-hint': {
    marginLeft: '1em',
    padding: '2px 6px',
    fontSize: '0.75em',
    color: 'var(--text-muted, #888)',
    backgroundColor: 'var(--bg-tertiary, #f0f0f0)',
    borderRadius: '4px',
    opacity: '0.7',
    pointerEvents: 'none',
    userSelect: 'none',
    float: 'right',
  },
})

/**
 * Main extension export
 */
export function tagSuggestions() {
  return [
    suggestionState,
    ghostDecorator,
    suggestionKeymap,
    createSuggestionFetcher(),
    ghostTheme,
  ]
}
