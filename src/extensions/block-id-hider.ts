/**
 * Block ID Hider Extension
 *
 * Hides §id§ block identifiers in the CodeMirror editor.
 * IDs are still in the document, just visually hidden.
 */

import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// Block ID pattern: §alphanumeric§ at end of line (with optional trailing whitespace)
const BLOCK_ID_PATTERN = /§[a-z0-9]+§\s*$/g

// Invisible placeholder widget
class HiddenIdWidget extends WidgetType {
  constructor(readonly id: string) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-block-id-hidden'
    // Store the ID as data attribute for potential debugging
    span.setAttribute('data-block-id', this.id)
    // Widget is zero-width, invisible
    return span
  }

  eq(other: HiddenIdWidget) {
    return other.id === this.id
  }

  ignoreEvent() {
    return true
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    const lines = text.split('\n')
    let pos = from

    for (const line of lines) {
      const match = line.match(/§([a-z0-9]+)§\s*$/)
      if (match) {
        const idStart = pos + match.index!
        const idEnd = pos + line.length

        // Replace the §id§ with an invisible widget
        const decoration = Decoration.replace({
          widget: new HiddenIdWidget(match[1]),
        })

        builder.add(idStart, idEnd, decoration)
      }

      pos += line.length + 1 // +1 for newline
    }
  }

  return builder.finish()
}

/**
 * CodeMirror extension that hides §id§ block identifiers
 */
export function blockIdHider() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  )
}
