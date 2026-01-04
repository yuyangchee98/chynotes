import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// Decoration for wiki-links
const wikilinkDecoration = Decoration.mark({ class: 'cm-wikilink' })

// Wiki-link pattern: [[word]] or [[word/subword]]
const WIKILINK_PATTERN = /\[\[[\w\-]+(?:\/[\w\-]+)*\]\]/g

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    // Find wiki-links
    let match: RegExpExecArray | null
    const wikilinkRegex = new RegExp(WIKILINK_PATTERN.source, 'g')

    while ((match = wikilinkRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      builder.add(start, end, wikilinkDecoration)
    }
  }

  return builder.finish()
}

/**
 * CodeMirror extension for highlighting [[wiki-links]]
 */
export function tagHighlighter() {
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
