import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
  keymap,
} from '@codemirror/view'
import { RangeSetBuilder, Prec, EditorSelection, EditorState } from '@codemirror/state'

// Constants
const BULLET_MARKER = '- '
const INDENT_UNIT = '    '
const INDENT_SIZE = INDENT_UNIT.length // 4

// Bullet widget that replaces "- " with a styled dot
class BulletWidget extends WidgetType {
  constructor(readonly indentLevel: number) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-bullet-widget'
    span.setAttribute('data-indent', String(this.indentLevel))
    // The dot is rendered via CSS ::before pseudo-element
    return span
  }

  eq(other: BulletWidget) {
    return other.indentLevel === this.indentLevel
  }

  // Prevent cursor from entering the widget
  ignoreEvent() {
    return false
  }
}

// Pattern to match bullet lines: optional indent + "- "
const BULLET_PATTERN = /^(\s*)- /gm

// Build decorations that replace "- " with bullet widgets
function buildBulletDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const match = line.text.match(/^(\s*)- /)

    if (match) {
      const indentLength = match[1].length
      const bulletStart = line.from + indentLength
      const bulletEnd = bulletStart + BULLET_MARKER.length

      const indentLevel = Math.floor(indentLength / INDENT_SIZE)

      const decoration = Decoration.replace({
        widget: new BulletWidget(indentLevel),
      })

      builder.add(bulletStart, bulletEnd, decoration)
    }
  }

  return builder.finish()
}

// ViewPlugin to manage bullet decorations
const bulletDecorator = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildBulletDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildBulletDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

// Prevent cursor from being placed before bullet content
const cursorGuard = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection) return tr

  const { main } = tr.newSelection

  // Only handle simple cursor (no selection range)
  if (main.from !== main.to) return tr

  const line = tr.newDoc.lineAt(main.from)
  const match = line.text.match(/^(\s*)- /)

  if (match) {
    const contentStart = line.from + match[0].length
    if (main.from < contentStart) {
      // Fix selection before transaction is applied
      return [{
        changes: tr.changes,
        effects: tr.effects,
        selection: EditorSelection.cursor(contentStart),
        scrollIntoView: tr.scrollIntoView,
      }]
    }
  }

  return tr
})

// --- Key Handlers ---

// Enter: Create new bullet (Logseq-style: always forces bullets)
function handleEnter(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main

  const line = state.doc.lineAt(from)
  const lineText = line.text

  // Check if line starts with bullet
  const bulletMatch = lineText.match(/^(\s*)- (.*)$/)

  if (!bulletMatch) {
    // Not a bullet line - force it to become one
    if (lineText === '') {
      // Empty line: just insert bullet
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: BULLET_MARKER },
        selection: { anchor: line.from + BULLET_MARKER.length },
      })
    } else {
      // Line has content: prepend bullet to current line, create new bullet below
      const cursorPosInLine = from - line.from
      const contentBeforeCursor = lineText.slice(0, cursorPosInLine)
      const contentAfterCursor = lineText.slice(cursorPosInLine)

      // Replace line with: "- contentBefore" + newline + "- contentAfter"
      const newText = BULLET_MARKER + contentBeforeCursor + '\n' + BULLET_MARKER + contentAfterCursor
      const newCursorPos = line.from + BULLET_MARKER.length + contentBeforeCursor.length + 1 + BULLET_MARKER.length

      view.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
        selection: { anchor: newCursorPos },
      })
    }
    return true
  }

  const [, indent, content] = bulletMatch
  const cursorPosInLine = from - line.from
  const bulletPrefix = indent + BULLET_MARKER

  // If cursor is at start of empty bullet content, delete the bullet
  if (content === '' && cursorPosInLine === bulletPrefix.length) {
    if (line.number === 1) {
      // First line - just remove bullet prefix
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
      })
    } else {
      // Delete entire line including preceding newline
      const prevLine = state.doc.line(line.number - 1)
      view.dispatch({
        changes: { from: prevLine.to, to: line.to, insert: '' },
        selection: { anchor: prevLine.to },
      })
    }
    return true
  }

  // Insert new line with same indentation + bullet
  const newLinePrefix = '\n' + indent + BULLET_MARKER

  view.dispatch({
    changes: {
      from,
      to,
      insert: newLinePrefix,
    },
    selection: { anchor: from + newLinePrefix.length },
  })

  return true
}

// Shift+Enter: Soft line break within block
function handleShiftEnter(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main

  const line = state.doc.lineAt(from)
  const bulletMatch = line.text.match(/^(\s*)- /)

  if (!bulletMatch) {
    return false
  }

  const indent = bulletMatch[1]
  // Add newline with indentation matching content position
  const contentIndent = indent + INDENT_UNIT

  view.dispatch({
    changes: { from, to, insert: '\n' + contentIndent },
    selection: { anchor: from + 1 + contentIndent.length },
  })

  return true
}

// Tab: Indent block
function handleTab(view: EditorView): boolean {
  const { state } = view
  const { from } = state.selection.main

  const line = state.doc.lineAt(from)
  const bulletMatch = line.text.match(/^(\s*)- /)

  if (!bulletMatch) {
    return false
  }

  // Add indent at start of line
  view.dispatch({
    changes: { from: line.from, insert: INDENT_UNIT },
    selection: { anchor: from + INDENT_SIZE },
  })

  return true
}

// Shift+Tab: Outdent block
function handleShiftTab(view: EditorView): boolean {
  const { state } = view
  const { from } = state.selection.main

  const line = state.doc.lineAt(from)
  const bulletMatch = line.text.match(/^(\s*)- /)

  if (!bulletMatch) {
    return false
  }

  const currentIndent = bulletMatch[1]
  if (currentIndent.length < INDENT_SIZE) {
    return true // Already at minimum indent, do nothing but consume the key
  }

  // Remove indent from start of line
  view.dispatch({
    changes: { from: line.from, to: line.from + INDENT_SIZE, insert: '' },
    selection: { anchor: Math.max(line.from, from - INDENT_SIZE) },
  })

  return true
}

// Block ID pattern for extraction
const BLOCK_ID_PATTERN = /\s*§[a-z0-9]+§\s*$/

// Backspace: Handle bullet merging and empty bullet deletion
function handleBackspace(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main

  // Only handle when no selection
  if (from !== to) {
    return false
  }

  const line = state.doc.lineAt(from)
  const bulletMatch = line.text.match(/^(\s*)- (.*)$/)

  if (!bulletMatch) {
    return false
  }

  const [, indent, content] = bulletMatch
  const bulletPrefix = indent + BULLET_MARKER
  const cursorAtContentStart = from === line.from + bulletPrefix.length

  if (!cursorAtContentStart) {
    return false // Let default backspace handle mid-content deletion
  }

  // Case 1: Empty bullet (just "- " with optional whitespace)
  if (content.trim() === '' || content.match(/^§[a-z0-9]+§\s*$/)) {
    if (line.number === 1) {
      // First line - keep the bullet, just consume the keypress
      return true
    } else {
      // Delete entire line including preceding newline
      const prevLine = state.doc.line(line.number - 1)
      view.dispatch({
        changes: { from: prevLine.to, to: line.to, insert: '' },
        selection: { anchor: prevLine.to },
      })
    }
    return true
  }

  // Case 2: Non-empty bullet - merge with previous line
  if (line.number === 1) {
    return false // Can't merge first line with anything
  }

  const prevLine = state.doc.line(line.number - 1)
  const prevBulletMatch = prevLine.text.match(/^(\s*)- (.*)$/)

  if (!prevBulletMatch) {
    return false // Previous line is not a bullet, let default handle it
  }

  const [, prevIndent, prevContent] = prevBulletMatch

  // Extract content without block IDs
  const currentContentWithoutId = content.replace(BLOCK_ID_PATTERN, '')
  const prevContentWithoutId = prevContent.replace(BLOCK_ID_PATTERN, '')

  // Extract the previous line's block ID (if any) - we keep this one
  const prevIdMatch = prevContent.match(/(§[a-z0-9]+§)\s*$/)
  const prevBlockId = prevIdMatch ? ' ' + prevIdMatch[1] : ''

  // Merge: prev content + current content + prev block ID
  const mergedContent = prevIndent + BULLET_MARKER + prevContentWithoutId + currentContentWithoutId + prevBlockId
  const cursorPosition = prevLine.from + prevIndent.length + BULLET_MARKER.length + prevContentWithoutId.length

  view.dispatch({
    changes: { from: prevLine.from, to: line.to, insert: mergedContent },
    selection: { anchor: cursorPosition },
  })

  return true
}

// Compose keymap with high precedence
const outlinerKeymap = Prec.high(
  keymap.of([
    { key: 'Enter', run: handleEnter },
    { key: 'Shift-Enter', run: handleShiftEnter },
    { key: 'Tab', run: handleTab },
    { key: 'Shift-Tab', run: handleShiftTab },
    { key: 'Backspace', run: handleBackspace },
  ])
)

// --- Ensure document always has a bullet on line 1 ---
const ensureBullet = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr

  const newDoc = tr.newDoc

  // Empty doc: add bullet
  if (newDoc.length === 0) {
    return [tr, {
      changes: { from: 0, insert: BULLET_MARKER },
      selection: { anchor: BULLET_MARKER.length },
    }]
  }

  // First line not a bullet: prepend bullet
  const firstLine = newDoc.line(1)
  if (!firstLine.text.match(/^(\s*)- /)) {
    return [tr, {
      changes: { from: 0, insert: BULLET_MARKER },
      selection: { anchor: tr.newSelection.main.anchor + BULLET_MARKER.length },
    }]
  }

  return tr
})


// --- Paste handler ---
const pasteHandler = EditorView.domEventHandlers({
  paste(event, view) {
    const clipboardData = event.clipboardData
    if (!clipboardData) return false

    const text = clipboardData.getData('text/plain')
    if (!text) return false

    // Convert pasted lines to bullets
    const lines = text.split('\n')
    const bulletedLines = lines.map((line) => {
      const trimmed = line.trim()
      if (trimmed === '') return ''
      // If already a bullet, keep it
      if (trimmed.startsWith(BULLET_MARKER)) return line
      // Otherwise, add bullet
      return BULLET_MARKER + line
    })

    const bulletedText = bulletedLines.join('\n')

    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: bulletedText },
      selection: { anchor: from + bulletedText.length },
    })

    event.preventDefault()
    return true
  },
})

// Export the combined extension
export function outliner() {
  return [
    bulletDecorator,
    cursorGuard,
    outlinerKeymap,
    ensureBullet,
    pasteHandler,
  ]
}
