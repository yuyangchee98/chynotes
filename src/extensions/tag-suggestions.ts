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
  otherNotes?: string[]  // For frequency suggestions: other notes containing this term
}

/**
 * Internal suggestion with absolute document positions
 */
interface ResolvedSuggestion extends TagSuggestion {
  docStart: number
  docEnd: number
  lineNumber: number
  isCorrection: boolean  // true if term !== tag (needs replacement)
  correctionLabel?: string  // e.g., "(typo)", "(plural)", "(repeated)"
}

/**
 * State for the correction menu
 */
interface CorrectionMenuState {
  isOpen: boolean
  corrections: ResolvedSuggestion[]
  selectedIndex: number
}

// State effects
const setSuggestions = StateEffect.define<ResolvedSuggestion[]>()
const clearSuggestions = StateEffect.define<void>()
const setCorrectionMenuState = StateEffect.define<Partial<CorrectionMenuState>>()

// Module-level state for current note date (set by editor component)
let currentNoteDate: string | null = null

/**
 * Set the current note date for tag suggestions
 * Call this from the editor component when the note changes
 */
export function setCurrentNoteDate(date: string | null): void {
  currentNoteDate = date
}

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

// State field for correction menu
const correctionMenuState = StateField.define<CorrectionMenuState>({
  create: () => ({ isOpen: false, corrections: [], selectedIndex: 0 }),
  update(state, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCorrectionMenuState)) {
        return { ...state, ...effect.value }
      }
      if (effect.is(clearSuggestions)) {
        return { isOpen: false, corrections: [], selectedIndex: 0 }
      }
    }
    // Close menu if document changed
    if (tr.docChanged) {
      return { isOpen: false, corrections: [], selectedIndex: 0 }
    }
    return state
  }
})

/**
 * Determine the correction label based on suggestion properties
 */
function getCorrectionLabel(suggestion: ResolvedSuggestion): string {
  const termLower = suggestion.term.toLowerCase()
  const tag = suggestion.tag

  if (suggestion.reason === 'frequency') {
    return '(repeated)'
  }

  if (suggestion.reason === 'semantic') {
    return '(related)'
  }

  // For fuzzy matches, try to determine if it's plural or typo
  if (suggestion.reason === 'fuzzy' || suggestion.reason === 'exact') {
    // Check for plural/singular: simple heuristic
    // If one ends with 's' and the other doesn't (and they're otherwise similar)
    const termEndsWithS = termLower.endsWith('s')
    const tagEndsWithS = tag.endsWith('s')

    if (termEndsWithS !== tagEndsWithS) {
      // Check if removing/adding 's' makes them equal or very similar
      const termWithoutS = termLower.endsWith('s') ? termLower.slice(0, -1) : termLower
      const tagWithoutS = tag.endsWith('s') ? tag.slice(0, -1) : tag
      const termWithS = termLower.endsWith('s') ? termLower : termLower + 's'
      const tagWithS = tag.endsWith('s') ? tag : tag + 's'

      if (termWithoutS === tagWithoutS || termWithS === tagWithS ||
          termWithoutS === tag || termLower === tagWithoutS) {
        return '(plural)'
      }
    }

    // Otherwise it's likely a typo
    return '(typo)'
  }

  return ''
}

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
 * Widget for the hint at end of line
 */
class HintWidget extends WidgetType {
  constructor(private hasCorrections: boolean) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-tag-hint'
    if (this.hasCorrections) {
      span.textContent = '↑↓ to select, Tab to accept'
      span.title = 'Use arrow keys to navigate corrections, Tab to accept, Esc to dismiss'
    } else {
      span.textContent = 'Tab to link'
      span.title = 'Press Tab to accept suggestion, Esc to dismiss'
    }
    return span
  }

  eq(other: HintWidget) {
    return other.hasCorrections === this.hasCorrections
  }

  ignoreEvent() {
    return true
  }
}

/**
 * Build decorations from suggestions
 */
function buildGhostDecorations(
  suggestions: ResolvedSuggestion[],
  doc: { line: (n: number) => { to: number } }
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  if (suggestions.length === 0) {
    return builder.finish()
  }

  // Sort by position
  const sorted = [...suggestions].sort((a, b) => a.docStart - b.docStart)
  const hasCorrections = sorted.some(s => s.isCorrection)

  for (const suggestion of sorted) {
    // Skip semantic suggestions (they don't have text to wrap)
    // Semantic suggestions have docStart === docEnd (end of line insertion)
    if (suggestion.docStart === suggestion.docEnd) {
      continue
    }

    // Add opening [[ widget before the term
    builder.add(
      suggestion.docStart,
      suggestion.docStart,
      Decoration.widget({
        widget: new GhostOpenBracketWidget(),
        side: -1,
      })
    )

    // Add closing ]] widget after the term
    builder.add(
      suggestion.docEnd,
      suggestion.docEnd,
      Decoration.widget({
        widget: new GhostCloseBracketWidget(),
        side: 1,
      })
    )
  }

  // Add hint at end of line
  const firstSuggestion = sorted[0]
  const line = doc.line(firstSuggestion.lineNumber)
  builder.add(
    line.to,
    line.to,
    Decoration.widget({
      widget: new HintWidget(hasCorrections),
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
      const suggestions = update.state.field(suggestionState)
      this.decorations = buildGhostDecorations(suggestions, update.state.doc)
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

// ============================================================================
// Correction Menu (DOM-based)
// ============================================================================

let correctionMenuElement: HTMLDivElement | null = null

/**
 * Menu option type - correction, retroactive (frequency), or "keep as-is"
 */
interface MenuOption {
  type: 'correction' | 'retroactive' | 'keep-original'
  suggestion: ResolvedSuggestion
  displayText: string
  label: string
  notes?: string[]  // For retroactive: list of other notes to tag
}

/**
 * Build menu options from corrections
 * For frequency suggestions with otherNotes: tag here, + N notes, keep
 * For semantic suggestions: just the tag (no keep-original option)
 * For other corrections: correction, keep
 */
function buildMenuOptions(corrections: ResolvedSuggestion[]): MenuOption[] {
  const options: MenuOption[] = []

  for (const correction of corrections) {
    // Check if this is a frequency suggestion with other notes
    const hasOtherNotes = correction.reason === 'frequency' && correction.otherNotes && correction.otherNotes.length > 0
    // Check if this is a semantic suggestion (end-of-line, no term)
    const isSemantic = correction.reason === 'semantic'

    // Add "tag here" option (correction)
    options.push({
      type: 'correction',
      suggestion: correction,
      displayText: correction.tag,
      label: correction.correctionLabel || '',
    })

    // For frequency suggestions with other notes, add retroactive option
    if (hasOtherNotes) {
      options.push({
        type: 'retroactive',
        suggestion: correction,
        displayText: correction.tag,
        label: `+ ${correction.otherNotes!.length} notes`,
        notes: correction.otherNotes,
      })
    }

    // Add "keep original" option (skip for semantic - there's no original term)
    if (!isSemantic) {
      options.push({
        type: 'keep-original',
        suggestion: correction,
        displayText: correction.term.toLowerCase(),
        label: '(as typed)',
      })
    }
  }

  return options
}

// Store current menu options for keyboard navigation
let currentMenuOptions: MenuOption[] = []

/**
 * Create or update the correction menu DOM element
 */
function showCorrectionMenu(
  view: EditorView,
  corrections: ResolvedSuggestion[],
  selectedIndex: number
) {
  // Remove existing menu
  hideCorrectionMenu()

  if (corrections.length === 0) return

  // Build menu options (correction + keep-original for each)
  currentMenuOptions = buildMenuOptions(corrections)

  // Create menu element
  const menu = document.createElement('div')
  menu.className = 'cm-correction-menu'

  // Get position of the first correction in the editor
  const firstCorrection = corrections[0]
  const coords = view.coordsAtPos(firstCorrection.docStart)

  if (!coords) return

  // Position menu below the word
  menu.style.cssText = `
    position: fixed;
    left: ${coords.left}px;
    top: ${coords.bottom + 4}px;
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border, #e5e3df);
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 180px;
    max-width: 300px;
    font-size: 13px;
  `

  // Add menu items - single line format
  currentMenuOptions.forEach((option, index) => {
    const item = document.createElement('div')
    item.className = 'cm-correction-item'

    // Determine label text based on option type
    let labelText = ''
    if (option.type === 'correction') {
      if (option.label === '(typo)') labelText = 'Fix typo'
      else if (option.label === '(plural)') labelText = 'Singular'
      else if (option.label === '(repeated)') labelText = 'Tag here'
      else if (option.label === '(related)') labelText = 'Related'
      else labelText = 'Suggested'
    } else if (option.type === 'retroactive') {
      labelText = option.label  // e.g., "+ 3 notes"
    } else {
      labelText = 'Keep'
    }

    item.innerHTML = `
      <span style="color: var(--text-primary, #37352f);">[[${escapeHtml(option.displayText)}]]</span>
      <span style="color: var(--text-muted, #888); margin-left: 8px; font-size: 12px;">${labelText}</span>
    `

    item.style.cssText = `
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      ${index === selectedIndex ? 'background: var(--bg-tertiary, #eeedea);' : ''}
    `

    // Add tooltip for retroactive option showing note dates
    if (option.type === 'retroactive' && option.notes && option.notes.length > 0) {
      item.title = option.notes.join(', ')
    }

    // Click to accept this option
    item.addEventListener('click', () => {
      acceptMenuOption(view, option)
    })

    // Hover effect
    item.addEventListener('mouseenter', () => {
      if (index !== selectedIndex) {
        item.style.background = 'var(--bg-secondary, #f5f4f1)'
      }
    })
    item.addEventListener('mouseleave', () => {
      if (index !== selectedIndex) {
        item.style.background = ''
      }
    })

    menu.appendChild(item)
  })

  // Add to document
  document.body.appendChild(menu)
  correctionMenuElement = menu

  // Check if menu goes off-screen and adjust
  const rect = menu.getBoundingClientRect()
  const viewportHeight = window.innerHeight

  if (rect.bottom > viewportHeight) {
    // Position above the word instead
    menu.style.top = `${coords.top - rect.height - 4}px`
  }

  // Close on click outside
  const closeOnClickOutside = (e: MouseEvent) => {
    if (correctionMenuElement && !correctionMenuElement.contains(e.target as Node)) {
      hideCorrectionMenu()
      view.dispatch({
        effects: setCorrectionMenuState.of({ isOpen: false })
      })
      document.removeEventListener('click', closeOnClickOutside)
    }
  }
  setTimeout(() => {
    document.addEventListener('click', closeOnClickOutside)
  }, 0)
}

/**
 * Hide the correction menu
 */
function hideCorrectionMenu() {
  if (correctionMenuElement) {
    correctionMenuElement.remove()
    correctionMenuElement = null
  }
  currentMenuOptions = []
}

/**
 * Escape HTML for safe insertion
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Accept a menu option (correction, retroactive, or keep-original)
 */
function acceptMenuOption(view: EditorView, option: MenuOption) {
  const suggestions = view.state.field(suggestionState)
  const suggestion = option.suggestion

  // Check if this is a semantic suggestion (end-of-line insertion)
  const isSemantic = suggestion.docStart === suggestion.docEnd

  let replacement: string
  if (isSemantic) {
    // Semantic: insert with space prefix at end of line
    replacement = ` [[${suggestion.tag}]]`
  } else if (option.type === 'correction' || option.type === 'retroactive') {
    // Replace with corrected tag
    replacement = `[[${suggestion.tag}]]`
  } else {
    // Keep original - wrap the term as-is (lowercase)
    replacement = `[[${suggestion.term.toLowerCase()}]]`
  }

  const positionDelta = replacement.length - (suggestion.docEnd - suggestion.docStart)

  // Filter out this suggestion and adjust positions of remaining suggestions
  const remaining = suggestions
    .filter(s => s.docStart !== suggestion.docStart)
    .map(s => ({
      ...s,
      docStart: s.docStart > suggestion.docStart ? s.docStart + positionDelta : s.docStart,
      docEnd: s.docEnd > suggestion.docStart ? s.docEnd + positionDelta : s.docEnd,
    }))

  hideCorrectionMenu()
  currentMenuOptions = []

  view.dispatch({
    changes: [{ from: suggestion.docStart, to: suggestion.docEnd, insert: replacement }],
    selection: EditorSelection.cursor(suggestion.docStart + replacement.length),
    effects: [
      setSuggestions.of(remaining),
      setCorrectionMenuState.of({ isOpen: false, corrections: [], selectedIndex: 0 }),
    ],
  })

  // For retroactive option, also tag other notes
  if (option.type === 'retroactive' && option.notes && option.notes.length > 0) {
    // Call the API to retroactively tag other notes
    window.api.retroactiveTag(suggestion.term, suggestion.tag, option.notes)
      .catch(() => {
        // Silently handle retroactive tag failure
      })
  }
}

/**
 * Accept the first non-correction suggestion (wrap as-is)
 */
function acceptFirstWrap(view: EditorView): boolean {
  const suggestions = view.state.field(suggestionState)

  // Find first non-correction suggestion
  const first = suggestions.find(s => !s.isCorrection)

  if (!first) {
    return false
  }

  // Just wrap the term with brackets
  const changes = [
    { from: first.docStart, insert: '[[' },
    { from: first.docEnd, insert: ']]' },
  ]
  const newCursorPos = first.docEnd + 4

  // Adjust positions for remaining suggestions
  const remaining = suggestions
    .filter(s => s.docStart !== first.docStart)
    .map(s => ({
      ...s,
      docStart: s.docStart > first.docStart ? s.docStart + 4 : s.docStart,
      docEnd: s.docEnd > first.docStart ? s.docEnd + 4 : s.docEnd,
    }))

  view.dispatch({
    changes,
    selection: EditorSelection.cursor(newCursorPos),
    effects: setSuggestions.of(remaining),
  })

  return true
}

// ============================================================================
// Keymap Handlers
// ============================================================================

/**
 * Handle Tab key
 */
function handleTab(view: EditorView): boolean {
  const menuState = view.state.field(correctionMenuState)
  const suggestions = view.state.field(suggestionState)

  if (suggestions.length === 0) {
    return false // Let Tab do default behavior
  }

  // If correction menu is open, accept selected option
  if (menuState.isOpen && currentMenuOptions.length > 0) {
    const selected = currentMenuOptions[menuState.selectedIndex]
    if (selected) {
      acceptMenuOption(view, selected)
      return true
    }
  }

  // No menu open, wrap the first exact match
  return acceptFirstWrap(view)
}

/**
 * Handle Escape key
 */
function handleEscape(view: EditorView): boolean {
  const menuState = view.state.field(correctionMenuState)
  const suggestions = view.state.field(suggestionState)

  // If correction menu is open, just close it (keep ghost brackets)
  if (menuState.isOpen) {
    hideCorrectionMenu()
    view.dispatch({
      effects: setCorrectionMenuState.of({ isOpen: false })
    })
    return true
  }

  // Otherwise dismiss all suggestions
  if (suggestions.length > 0) {
    hideCorrectionMenu()
    view.dispatch({
      effects: clearSuggestions.of(undefined),
    })
    return true
  }

  return false
}

/**
 * Handle Up arrow key
 */
function handleArrowUp(view: EditorView): boolean {
  const menuState = view.state.field(correctionMenuState)

  if (!menuState.isOpen || currentMenuOptions.length === 0) {
    return false // Let arrow do default behavior
  }

  // Move selection up (wrap around)
  const newIndex = menuState.selectedIndex > 0
    ? menuState.selectedIndex - 1
    : currentMenuOptions.length - 1

  view.dispatch({
    effects: setCorrectionMenuState.of({ selectedIndex: newIndex })
  })

  // Update menu UI
  showCorrectionMenu(view, menuState.corrections, newIndex)

  return true
}

/**
 * Handle Down arrow key
 */
function handleArrowDown(view: EditorView): boolean {
  const menuState = view.state.field(correctionMenuState)

  if (!menuState.isOpen || currentMenuOptions.length === 0) {
    return false // Let arrow do default behavior
  }

  // Move selection down (wrap around)
  const newIndex = menuState.selectedIndex < currentMenuOptions.length - 1
    ? menuState.selectedIndex + 1
    : 0

  view.dispatch({
    effects: setCorrectionMenuState.of({ selectedIndex: newIndex })
  })

  // Update menu UI
  showCorrectionMenu(view, menuState.corrections, newIndex)

  return true
}

/**
 * Keymap for suggestions and corrections
 */
const suggestionKeymap = Prec.highest(
  keymap.of([
    { key: 'Tab', run: handleTab },
    { key: 'Escape', run: handleEscape },
    { key: 'ArrowUp', run: handleArrowUp },
    { key: 'ArrowDown', run: handleArrowDown },
  ])
)

// ============================================================================
// Suggestion Fetcher
// ============================================================================

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

function createSuggestionFetcher() {
  let lastCursorLine = -1

  const fetchSuggestions = debounce(async (view: EditorView) => {
    if (!view.dom.isConnected) return

    const { state } = view
    const { main } = state.selection
    const line = state.doc.lineAt(main.from)
    const lineNumber = line.number
    const lineText = line.text

    if (lineText.trim().length < 3) {
      hideCorrectionMenu()
      view.dispatch({ effects: clearSuggestions.of(undefined) })
      return
    }

    try {
      const suggestions: TagSuggestion[] = await window.api.getTagSuggestions(lineText, currentNoteDate || undefined)

      if (suggestions.length === 0) {
        hideCorrectionMenu()
        view.dispatch({ effects: clearSuggestions.of(undefined) })
        return
      }

      // Convert to resolved suggestions and determine corrections
      // A suggestion needs the dropdown if:
      // 1. It's a correction (term.toLowerCase() !== tag), OR
      // 2. It's a frequency suggestion with otherNotes (for retroactive tagging)
      const resolved: ResolvedSuggestion[] = suggestions.map(s => {
        const termDiffersFromTag = s.term.toLowerCase() !== s.tag
        const hasRetroactiveOption = s.reason === 'frequency' && (s.otherNotes?.length ?? 0) > 0
        const isCorrection = termDiffersFromTag || hasRetroactiveOption

        const suggestion: ResolvedSuggestion = {
          ...s,
          docStart: line.from + s.startIndex,
          docEnd: line.from + s.endIndex,
          lineNumber,
          isCorrection,
        }
        if (isCorrection) {
          suggestion.correctionLabel = getCorrectionLabel(suggestion)
        }
        return suggestion
      })

      // Separate corrections from exact matches
      const corrections = resolved.filter(s => s.isCorrection)

      view.dispatch({
        effects: [
          setSuggestions.of(resolved),
          setCorrectionMenuState.of({
            isOpen: corrections.length > 0,
            corrections,
            selectedIndex: 0,
          }),
        ],
      })

      // Show correction menu if there are corrections
      if (corrections.length > 0) {
        showCorrectionMenu(view, corrections, 0)
      } else {
        hideCorrectionMenu()
      }
    } catch (error) {
      console.error('Failed to fetch tag suggestions:', error)
    }
  }, 500)

  return EditorView.updateListener.of((update) => {
    if (!update.docChanged && !update.selectionSet) return

    const { state } = update
    const { main } = state.selection
    const line = state.doc.lineAt(main.from)
    const lineNumber = line.number

    if (lineNumber !== lastCursorLine) {
      lastCursorLine = lineNumber
      hideCorrectionMenu()
      update.view.dispatch({ effects: clearSuggestions.of(undefined) })
    }

    fetchSuggestions(update.view)
  })
}

// ============================================================================
// Theme
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export function tagSuggestions() {
  return [
    suggestionState,
    correctionMenuState,
    ghostDecorator,
    suggestionKeymap,
    createSuggestionFetcher(),
    ghostTheme,
  ]
}
