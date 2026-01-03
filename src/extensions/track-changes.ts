import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
  keymap,
} from '@codemirror/view'
import {
  RangeSetBuilder,
  Prec,
  EditorSelection,
  Facet,
  StateField,
  Transaction,
  EditorState,
  ChangeSpec,
} from '@codemirror/state'

// --- Configuration ---

export interface TrackChangesConfig {
  trackChangesEnabled: boolean
  showGhostText: boolean
}

export const trackChangesConfig = Facet.define<TrackChangesConfig, TrackChangesConfig>({
  combine(values) {
    return values[0] ?? { trackChangesEnabled: true, showGhostText: true }
  },
})

// --- Marker Types ---

interface DeletionMarker {
  type: 'deletion'
  from: number
  to: number
  timestamp: string
  content: string
}

interface AdditionMarker {
  type: 'addition'
  from: number
  to: number
  timestamp: string
}

type Marker = DeletionMarker | AdditionMarker

// --- Marker Parsing ---

const DELETION_PATTERN = /<!--@d:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\|([\s\S]*?)-->/g
const ADDITION_PATTERN = /<!--@a:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})-->/g

function parseAllMarkers(text: string): Marker[] {
  const markers: Marker[] = []

  // Parse deletion markers
  let match: RegExpExecArray | null
  const delRegex = new RegExp(DELETION_PATTERN.source, 'g')
  while ((match = delRegex.exec(text)) !== null) {
    markers.push({
      type: 'deletion',
      from: match.index,
      to: match.index + match[0].length,
      timestamp: match[1],
      content: match[2],
    })
  }

  // Parse addition markers
  const addRegex = new RegExp(ADDITION_PATTERN.source, 'g')
  while ((match = addRegex.exec(text)) !== null) {
    markers.push({
      type: 'addition',
      from: match.index,
      to: match.index + match[0].length,
      timestamp: match[1],
    })
  }

  // Sort by position
  return markers.sort((a, b) => a.from - b.from)
}

// StateField for cached markers
const markerCache = StateField.define<Marker[]>({
  create(state) {
    return parseAllMarkers(state.doc.toString())
  },
  update(markers, tr) {
    if (!tr.docChanged) return markers
    return parseAllMarkers(tr.newDoc.toString())
  },
})

// --- Widgets ---

class GhostTextWidget extends WidgetType {
  constructor(
    readonly content: string,
    readonly timestamp: string
  ) {
    super()
  }

  toDOM() {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-ghost-text'

    // Ghost content with strikethrough
    const textSpan = document.createElement('span')
    textSpan.className = 'cm-ghost-content'
    // Decode escaped newlines for display
    textSpan.textContent = this.content.replace(/\\n/g, '\u21b5')
    wrapper.appendChild(textSpan)

    // Timestamp tooltip
    const timeSpan = document.createElement('span')
    timeSpan.className = 'cm-ghost-timestamp'
    timeSpan.textContent = this.formatTime(this.timestamp)
    wrapper.appendChild(timeSpan)

    return wrapper
  }

  formatTime(iso: string): string {
    const match = iso.match(/T(\d{2}:\d{2}:\d{2})/)
    return match ? match[1] : ''
  }

  eq(other: GhostTextWidget) {
    return other.content === this.content && other.timestamp === this.timestamp
  }

  ignoreEvent() {
    return true
  }
}

class AdditionMarkerWidget extends WidgetType {
  constructor(readonly timestamp: string) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-addition-marker'
    span.setAttribute('data-timestamp', this.formatTime(this.timestamp))
    return span
  }

  formatTime(iso: string): string {
    const match = iso.match(/T(\d{2}:\d{2}:\d{2})/)
    return match ? match[1] : ''
  }

  eq(other: AdditionMarkerWidget) {
    return other.timestamp === this.timestamp
  }

  ignoreEvent() {
    return true
  }
}

// --- Decoration Plugin ---

const ghostDecorator = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
        return
      }
      // Also rebuild if config changed
      const prevConfig = update.startState.facet(trackChangesConfig)
      const newConfig = update.state.facet(trackChangesConfig)
      if (prevConfig.showGhostText !== newConfig.showGhostText) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const config = view.state.facet(trackChangesConfig)
      const markers = view.state.field(markerCache)
      const builder = new RangeSetBuilder<Decoration>()

      for (const marker of markers) {
        if (marker.type === 'deletion') {
          if (config.showGhostText) {
            builder.add(
              marker.from,
              marker.to,
              Decoration.replace({
                widget: new GhostTextWidget(marker.content, marker.timestamp),
              })
            )
          } else {
            // Hide entirely
            builder.add(
              marker.from,
              marker.to,
              Decoration.replace({})
            )
          }
        } else if (marker.type === 'addition') {
          builder.add(
            marker.from,
            marker.to,
            Decoration.replace({
              widget: new AdditionMarkerWidget(marker.timestamp),
            })
          )
        }
      }

      return builder.finish()
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

// --- Helper: Find marker at position ---

function findMarkerAt(pos: number, markers: Marker[]): Marker | null {
  for (const marker of markers) {
    if (pos >= marker.from && pos < marker.to) {
      return marker
    }
    if (marker.from > pos) break
  }
  return null
}

function findMarkerEndingAt(pos: number, markers: Marker[]): Marker | null {
  for (const marker of markers) {
    if (marker.to === pos) {
      return marker
    }
    if (marker.from > pos) break
  }
  return null
}

function findMarkerStartingAt(pos: number, markers: Marker[]): Marker | null {
  for (const marker of markers) {
    if (marker.from === pos) {
      return marker
    }
    if (marker.from > pos) break
  }
  return null
}

// --- Cursor Guard ---

const ghostCursorGuard = EditorView.updateListener.of((update) => {
  if (!update.selectionSet) return

  const config = update.state.facet(trackChangesConfig)
  if (!config.trackChangesEnabled) return

  const markers = update.state.field(markerCache)
  const { main } = update.state.selection

  // Only handle simple cursor
  if (main.from !== main.to) return

  const marker = findMarkerAt(main.from, markers)
  if (marker && marker.type === 'deletion') {
    // Move cursor to end of marker
    update.view.dispatch({
      selection: EditorSelection.cursor(marker.to),
    })
  }
})

// --- Arrow Key Navigation ---

const ghostNavigationKeymap = Prec.high(
  keymap.of([
    {
      key: 'ArrowRight',
      run: (view) => {
        const config = view.state.facet(trackChangesConfig)
        if (!config.trackChangesEnabled) return false

        const markers = view.state.field(markerCache)
        const { from, to } = view.state.selection.main

        if (from !== to) return false

        // Check if next position would enter a deletion marker
        const marker = findMarkerStartingAt(from, markers)
        if (marker && marker.type === 'deletion') {
          view.dispatch({
            selection: EditorSelection.cursor(marker.to),
          })
          return true
        }

        return false
      },
    },
    {
      key: 'ArrowLeft',
      run: (view) => {
        const config = view.state.facet(trackChangesConfig)
        if (!config.trackChangesEnabled) return false

        const markers = view.state.field(markerCache)
        const { from, to } = view.state.selection.main

        if (from !== to) return false

        // Check if previous position is end of a deletion marker
        const marker = findMarkerEndingAt(from, markers)
        if (marker && marker.type === 'deletion') {
          view.dispatch({
            selection: EditorSelection.cursor(marker.from),
          })
          return true
        }

        return false
      },
    },
  ])
)

// --- Keyboard Handlers ---

function handleBackspace(view: EditorView): boolean {
  const config = view.state.facet(trackChangesConfig)
  const markers = view.state.field(markerCache)
  const { from, to } = view.state.selection.main

  // Handle selection
  if (from !== to) {
    return handleSelectionDelete(view, from, to, config, markers)
  }

  // Single character backspace
  if (from === 0) return false

  const charBefore = from - 1

  // Check if backspace would hit a deletion marker
  const markerAtPrev = findMarkerAt(charBefore, markers)
  if (markerAtPrev && markerAtPrev.type === 'deletion') {
    if (config.trackChangesEnabled) {
      // Can't delete ghost text when tracking is on - just skip over it
      view.dispatch({
        selection: EditorSelection.cursor(markerAtPrev.from),
      })
      return true
    } else {
      // Track changes off - delete the entire marker
      view.dispatch({
        changes: { from: markerAtPrev.from, to: markerAtPrev.to, insert: '' },
        selection: EditorSelection.cursor(markerAtPrev.from),
      })
      return true
    }
  }

  // Check if we're right after a marker (at marker.to)
  const markerBefore = findMarkerEndingAt(from, markers)
  if (markerBefore && markerBefore.type === 'deletion') {
    if (config.trackChangesEnabled) {
      // Skip back over the marker
      view.dispatch({
        selection: EditorSelection.cursor(markerBefore.from),
      })
      return true
    }
  }

  // Normal deletion - if tracking enabled, create ghost marker
  if (config.trackChangesEnabled) {
    const deletedChar = view.state.doc.sliceString(charBefore, from)
    const timestamp = new Date().toISOString().slice(0, 19)
    const marker = `<!--@d:${timestamp}|${deletedChar}-->`

    view.dispatch({
      changes: { from: charBefore, to: from, insert: marker },
      selection: EditorSelection.cursor(charBefore + marker.length),
    })
    return true
  }

  return false
}

function handleDelete(view: EditorView): boolean {
  const config = view.state.facet(trackChangesConfig)
  const markers = view.state.field(markerCache)
  const { from, to } = view.state.selection.main

  // Handle selection
  if (from !== to) {
    return handleSelectionDelete(view, from, to, config, markers)
  }

  const docLength = view.state.doc.length
  if (from >= docLength) return false

  // Check if delete would hit a deletion marker
  const markerAtNext = findMarkerAt(from, markers)
  if (markerAtNext && markerAtNext.type === 'deletion') {
    if (config.trackChangesEnabled) {
      // Can't delete ghost text - move cursor past it
      view.dispatch({
        selection: EditorSelection.cursor(markerAtNext.to),
      })
      return true
    } else {
      // Delete entire marker
      view.dispatch({
        changes: { from: markerAtNext.from, to: markerAtNext.to, insert: '' },
      })
      return true
    }
  }

  // Normal deletion
  if (config.trackChangesEnabled) {
    const deletedChar = view.state.doc.sliceString(from, from + 1)
    const timestamp = new Date().toISOString().slice(0, 19)
    const marker = `<!--@d:${timestamp}|${deletedChar}-->`

    view.dispatch({
      changes: { from, to: from + 1, insert: marker },
      selection: EditorSelection.cursor(from + marker.length),
    })
    return true
  }

  return false
}

function handleSelectionDelete(
  view: EditorView,
  from: number,
  to: number,
  config: TrackChangesConfig,
  markers: Marker[]
): boolean {
  if (!config.trackChangesEnabled) {
    // Track changes off - let default behavior handle, but we need to handle ghost text
    // Find all deletion markers in the selection and remove them too
    return false
  }

  // Track changes on - need to only delete non-ghost portions
  const { normalRanges, hasGhost } = getNonGhostRanges(from, to, markers)

  if (normalRanges.length === 0) {
    // Only ghost text selected - do nothing
    return true
  }

  // Create ghost markers for normal text portions
  const timestamp = new Date().toISOString().slice(0, 19)
  const changes: ChangeSpec[] = []

  // Process in reverse order to avoid position shifts
  for (let i = normalRanges.length - 1; i >= 0; i--) {
    const range = normalRanges[i]
    const text = view.state.doc.sliceString(range.from, range.to)
    const encoded = text.replace(/\n/g, '\\n')
    const marker = `<!--@d:${timestamp}|${encoded}-->`
    changes.push({ from: range.from, to: range.to, insert: marker })
  }

  view.dispatch({
    changes,
    selection: EditorSelection.cursor(from),
  })

  return true
}

function getNonGhostRanges(
  from: number,
  to: number,
  markers: Marker[]
): { normalRanges: Array<{ from: number; to: number }>; hasGhost: boolean } {
  const normalRanges: Array<{ from: number; to: number }> = []
  let hasGhost = false
  let currentPos = from

  for (const marker of markers) {
    if (marker.type !== 'deletion') continue
    if (marker.to <= from) continue
    if (marker.from >= to) break

    hasGhost = true

    // Normal range before this marker
    if (currentPos < marker.from && currentPos < to) {
      normalRanges.push({
        from: currentPos,
        to: Math.min(marker.from, to),
      })
    }

    currentPos = marker.to
  }

  // Remaining normal range after last marker
  if (currentPos < to) {
    normalRanges.push({ from: currentPos, to })
  }

  return { normalRanges, hasGhost }
}

const trackChangesKeymap = Prec.high(
  keymap.of([
    { key: 'Backspace', run: handleBackspace },
    { key: 'Delete', run: handleDelete },
  ])
)

// --- Clipboard Handlers ---

function stripMarkers(text: string): string {
  // Remove deletion markers, keeping their content
  let result = text.replace(/<!--@d:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\|([\s\S]*?)-->/g, '$1')
  // Remove addition markers entirely
  result = result.replace(/<!--@a:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-->/g, '')
  // Decode escaped newlines
  result = result.replace(/\\n/g, '\n')
  return result
}

const clipboardHandlers = EditorView.domEventHandlers({
  copy(event, view) {
    const { from, to } = view.state.selection.main
    if (from === to) return false

    const selectedText = view.state.doc.sliceString(from, to)
    const strippedText = stripMarkers(selectedText)

    event.clipboardData?.setData('text/plain', strippedText)
    event.preventDefault()
    return true
  },

  cut(event, view) {
    const { from, to } = view.state.selection.main
    if (from === to) return false

    const selectedText = view.state.doc.sliceString(from, to)
    const strippedText = stripMarkers(selectedText)

    event.clipboardData?.setData('text/plain', strippedText)

    // Trigger delete through our handler
    handleSelectionDelete(
      view,
      from,
      to,
      view.state.facet(trackChangesConfig),
      view.state.field(markerCache)
    )

    event.preventDefault()
    return true
  },

  paste(event, view) {
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return false

    // Strip any markers from pasted text
    const cleanText = stripMarkers(text)

    const { from, to } = view.state.selection.main
    const config = view.state.facet(trackChangesConfig)
    const markers = view.state.field(markerCache)

    // Handle deletion of selected text if any
    if (from !== to && config.trackChangesEnabled) {
      handleSelectionDelete(view, from, to, config, markers)
      // Now insert at from position
      view.dispatch({
        changes: { from, to: from, insert: cleanText },
        selection: EditorSelection.cursor(from + cleanText.length),
      })
    } else {
      view.dispatch({
        changes: { from, to, insert: cleanText },
        selection: EditorSelection.cursor(from + cleanText.length),
      })
    }

    event.preventDefault()
    return true
  },
})

// --- Addition Marker Debouncing ---

let additionTimer: ReturnType<typeof setTimeout> | null = null
let lastInsertPos: number | null = null

const additionDebouncer = EditorView.updateListener.of((update) => {
  if (!update.docChanged) return

  const config = update.state.facet(trackChangesConfig)
  if (!config.trackChangesEnabled) return

  // Check if this was an insertion (not our own marker insertion)
  let hasInsertion = false
  let insertPos = 0

  update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    const insertedText = inserted.toString()
    // Skip if this is a marker we're inserting
    if (insertedText.startsWith('<!--@')) return

    if (inserted.length > 0 && fromA === toA) {
      // Pure insertion
      hasInsertion = true
      insertPos = fromB
    }
  })

  if (hasInsertion) {
    // Clear existing timer
    if (additionTimer) {
      clearTimeout(additionTimer)
    }

    lastInsertPos = insertPos

    // Set new timer
    additionTimer = setTimeout(() => {
      if (lastInsertPos !== null) {
        const timestamp = new Date().toISOString().slice(0, 19)
        const marker = `<!--@a:${timestamp}-->`

        // We need to dispatch to the current view
        // This is tricky because the view might have changed
        // For now, we skip addition markers as they add complexity
        // and focus on deletion tracking which is the core feature
      }
      additionTimer = null
      lastInsertPos = null
    }, 1000)
  }
})

// --- Export ---

export function trackChanges(config: TrackChangesConfig) {
  return [
    trackChangesConfig.of(config),
    markerCache,
    ghostDecorator,
    ghostCursorGuard,
    ghostNavigationKeymap,
    trackChangesKeymap,
    clipboardHandlers,
    // additionDebouncer, // Disabled for now - deletion tracking is the priority
  ]
}
