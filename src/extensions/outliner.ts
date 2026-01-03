import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
  keymap,
} from '@codemirror/view'
import { RangeSetBuilder, Prec, EditorSelection } from '@codemirror/state'

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
      const bulletEnd = bulletStart + 2 // "- " is 2 chars

      const indentLevel = Math.floor(indentLength / 4)

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
const cursorGuard = EditorView.updateListener.of((update) => {
  if (!update.selectionSet) return

  const { state } = update
  const { main } = state.selection

  // Only handle simple cursor (no selection range)
  if (main.from !== main.to) return

  const line = state.doc.lineAt(main.from)
  const match = line.text.match(/^(\s*)- /)

  if (match) {
    const contentStart = line.from + match[0].length
    if (main.from < contentStart) {
      // Cursor is before content, move it after "- "
      update.view.dispatch({
        selection: EditorSelection.cursor(contentStart),
      })
    }
  }
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
        changes: { from: line.from, to: line.to, insert: '- ' },
        selection: { anchor: line.from + 2 },
      })
    } else {
      // Line has content: prepend bullet to current line, create new bullet below
      const cursorPosInLine = from - line.from
      const contentBeforeCursor = lineText.slice(0, cursorPosInLine)
      const contentAfterCursor = lineText.slice(cursorPosInLine)

      // Replace line with: "- contentBefore" + newline + "- " + contentAfter
      const newText = '- ' + contentBeforeCursor + '\n- ' + contentAfterCursor

      view.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
        selection: { anchor: line.from + 2 + contentBeforeCursor.length + 3 }, // after "- content\n- "
      })
    }
    return true
  }

  const [, indent, content] = bulletMatch
  const cursorPosInLine = from - line.from
  const bulletPrefix = indent + '- '

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
  const newLinePrefix = '\n' + indent + '- '

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
  // Add newline with indentation matching content position (indent + 4 for "- ")
  const contentIndent = indent + '    '

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

  // Add 4 spaces at start of line
  view.dispatch({
    changes: { from: line.from, insert: '    ' },
    selection: { anchor: from + 4 },
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
  if (currentIndent.length < 4) {
    return true // Already at minimum indent, do nothing but consume the key
  }

  // Remove 4 spaces from start of line
  view.dispatch({
    changes: { from: line.from, to: line.from + 4, insert: '' },
    selection: { anchor: Math.max(line.from, from - 4) },
  })

  return true
}

// Backspace: Delete empty bullet
function handleBackspace(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main

  // Only handle when no selection
  if (from !== to) {
    return false
  }

  const line = state.doc.lineAt(from)

  // Check if at end of empty bullet line (just "- " or "  - " etc)
  const bulletMatch = line.text.match(/^(\s*)- $/)

  if (!bulletMatch) {
    return false
  }

  const bulletPrefix = bulletMatch[0]
  if (from !== line.from + bulletPrefix.length) {
    return false
  }

  if (line.number === 1) {
    // First line - just remove bullet prefix
    view.dispatch({
      changes: { from: line.from, to: line.from + bulletPrefix.length, insert: '' },
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

// --- Auto-insert bullet on empty doc ---
const autoInsertBullet = EditorView.updateListener.of((update) => {
  if (!update.docChanged) return

  const { state } = update
  const doc = state.doc

  // Check if this is the first character being typed on an empty doc
  // and it's not already a bullet
  if (doc.lines === 1) {
    const line = doc.line(1)
    const text = line.text

    // If user typed something that's not starting with "- " and not empty
    if (text.length > 0 && !text.startsWith('- ') && !text.startsWith(' ')) {
      // We need to prepend "- "
      // But we need to be careful not to create infinite loop
      // Check if the change was us adding "- "
      const lastChange = update.changes
      let wasAutoInsert = false

      lastChange.iterChanges((fromA, toA, fromB, toB, inserted) => {
        if (inserted.toString() === '- ') {
          wasAutoInsert = true
        }
      })

      if (!wasAutoInsert && text.length === 1) {
        // First character typed, prepend bullet
        update.view.dispatch({
          changes: { from: 0, insert: '- ' },
          selection: { anchor: state.selection.main.anchor + 2 },
        })
      }
    }
  }
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
      if (trimmed.startsWith('- ')) return line
      // Otherwise, add bullet
      return '- ' + line
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
    autoInsertBullet,
    pasteHandler,
  ]
}
