import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, Facet } from '@codemirror/state'

// Decoration for wiki-links
const wikilinkDecoration = Decoration.mark({ class: 'cm-wikilink' })

// Wiki-link pattern: [[word]] or [[word/subword]]
const WIKILINK_PATTERN = /\[\[([\w\-]+(?:\/[\w\-]+)*)\]\]/g

// Facet to provide the click callback
const tagClickCallback = Facet.define<((tag: string) => void) | null, ((tag: string) => void) | null>({
  combine: values => values.find(v => v !== null) ?? null
})

/**
 * Find wiki-link ranges in the document
 */
function findWikiLinks(view: EditorView): Array<{ from: number; to: number; tag: string }> {
  const links: Array<{ from: number; to: number; tag: string }> = []

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    const regex = new RegExp(WIKILINK_PATTERN.source, 'g')
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      links.push({
        from: from + match.index,
        to: from + match.index + match[0].length,
        tag: match[1].toLowerCase()
      })
    }
  }

  return links
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const links = findWikiLinks(view)

  for (const link of links) {
    builder.add(link.from, link.to, wikilinkDecoration)
  }

  return builder.finish()
}

/**
 * CodeMirror extension for highlighting [[wiki-links]] with click handling
 */
export function tagHighlighter(onTagClick?: (tag: string) => void) {
  const plugin = ViewPlugin.fromClass(
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
      eventHandlers: {
        click: (event: MouseEvent, view: EditorView) => {
          // Get the callback from the facet
          const callback = view.state.facet(tagClickCallback)
          if (!callback) return false

          // Get the position in the document from click coordinates
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
          if (pos === null) return false

          // Check if this position is within a wiki-link
          const links = findWikiLinks(view)
          const clickedLink = links.find(link => pos >= link.from && pos <= link.to)

          if (clickedLink) {
            callback(clickedLink.tag)
            event.preventDefault()
            return true
          }

          return false
        }
      }
    }
  )

  return [
    plugin,
    tagClickCallback.of(onTagClick ?? null)
  ]
}
