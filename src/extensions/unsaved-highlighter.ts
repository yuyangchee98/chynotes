import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// Decoration for unsaved (modified) lines - lighter opacity
const unsavedLineDecoration = Decoration.line({ class: 'cm-line-unsaved' })

/**
 * Compare current document lines with snapshot lines and find which are different
 */
function findUnsavedLines(currentContent: string, snapshotContent: string): Set<number> {
  const currentLines = currentContent.split('\n')
  const snapshotLines = snapshotContent.split('\n')
  const unsavedLineNumbers = new Set<number>()

  for (let i = 0; i < currentLines.length; i++) {
    const currentLine = currentLines[i]
    const snapshotLine = snapshotLines[i]

    // Line is unsaved if it's new or different from snapshot
    if (snapshotLine === undefined || currentLine !== snapshotLine) {
      unsavedLineNumbers.add(i + 1) // 1-indexed line numbers
    }
  }

  return unsavedLineNumbers
}

function buildDecorations(view: EditorView, snapshotContent: string | null): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  // If no snapshot content, nothing to compare against
  if (snapshotContent === null) {
    return builder.finish()
  }

  const currentContent = view.state.doc.toString()
  const unsavedLines = findUnsavedLines(currentContent, snapshotContent)

  // Apply decoration to each unsaved line
  for (let i = 1; i <= view.state.doc.lines; i++) {
    if (unsavedLines.has(i)) {
      const line = view.state.doc.line(i)
      builder.add(line.from, line.from, unsavedLineDecoration)
    }
  }

  return builder.finish()
}

/**
 * CodeMirror extension for highlighting lines that differ from the last snapshot.
 * Lines that have been modified but not yet snapshotted appear lighter.
 */
export function unsavedHighlighter(snapshotContent: string | null) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      snapshotContent: string | null

      constructor(view: EditorView) {
        this.snapshotContent = snapshotContent
        this.decorations = buildDecorations(view, this.snapshotContent)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, this.snapshotContent)
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  )
}
