import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// Decoration for hashtags
const tagDecoration = Decoration.mark({ class: 'cm-tag' })

// Decoration for wiki-links
const wikilinkDecoration = Decoration.mark({ class: 'cm-wikilink' })

// Regex patterns
const HASHTAG_PATTERN = /#[\w\-]+(?:\/[\w\-]+)*/g
const WIKILINK_PATTERN = /\[\[[\w\-]+(?:\/[\w\-]+)*\]\]/g

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    // Find hashtags
    let match: RegExpExecArray | null
    const hashtagRegex = new RegExp(HASHTAG_PATTERN.source, 'g')

    while ((match = hashtagRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      builder.add(start, end, tagDecoration)
    }

    // Find wiki-links
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
 * CodeMirror extension for highlighting #tags and [[wiki-links]]
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
