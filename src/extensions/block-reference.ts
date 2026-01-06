/**
 * Block Reference Extension
 *
 * Renders ((block-id)) syntax as inline embeds showing the referenced block content.
 * Supports recursive expansion up to 3 levels deep with circular reference detection.
 */

import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { RangeSetBuilder, Facet } from '@codemirror/state'

// Block reference pattern: ((8 hex characters))
const BLOCK_REF_PATTERN = /\(\(([a-f0-9]{8})\)\)/g

// Block record interface (matches database schema)
export interface BlockRecord {
  id: string
  note_date: string
  content: string
  parent_id: string | null
  indent_level: number
  line_number: number
  updated_at: number
  embedded_at: number | null
}

// Configuration for the block reference extension
interface BlockRefConfig {
  blockCache: Map<string, BlockRecord | null>
  onClick?: (noteDate: string, lineNumber: number) => void
}

// Facet to provide configuration
const blockRefConfig = Facet.define<BlockRefConfig, BlockRefConfig>({
  combine: values => values[0] ?? { blockCache: new Map() }
})

// Maximum recursion depth for nested block references
const MAX_DEPTH = 3

/**
 * Widget that displays a block reference inline
 */
class BlockRefWidget extends WidgetType {
  constructor(
    readonly blockId: string,
    readonly block: BlockRecord | null,
    readonly config: BlockRefConfig,
    readonly depth: number = 0,
    readonly visitedIds: Set<string> = new Set()
  ) {
    super()
  }

  eq(other: BlockRefWidget) {
    return other.blockId === this.blockId &&
           other.block?.content === this.block?.content &&
           other.depth === this.depth
  }

  toDOM() {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-block-reference'

    // Check for circular reference
    if (this.visitedIds.has(this.blockId)) {
      wrapper.className += ' cm-block-reference-circular'
      wrapper.textContent = '[Circular reference]'
      return wrapper
    }

    // Check if block exists
    if (!this.block) {
      wrapper.className += ' cm-block-reference-missing'
      wrapper.textContent = '[Block not found]'
      return wrapper
    }

    // Strip block ID from content for display
    let displayContent = this.block.content.replace(/\s*§[a-z0-9]+§\s*$/, '')

    // Strip leading bullet if present
    displayContent = displayContent.replace(/^\s*-\s*/, '')

    // Handle nested block references (recursive expansion)
    if (this.depth < MAX_DEPTH) {
      const newVisitedIds = new Set(this.visitedIds)
      newVisitedIds.add(this.blockId)

      // Find nested references
      const nestedRefs = [...displayContent.matchAll(BLOCK_REF_PATTERN)]

      if (nestedRefs.length > 0) {
        // Build content with nested widgets
        let lastIndex = 0
        const fragment = document.createDocumentFragment()

        for (const match of nestedRefs) {
          // Add text before this reference
          if (match.index! > lastIndex) {
            fragment.appendChild(
              document.createTextNode(displayContent.slice(lastIndex, match.index))
            )
          }

          // Create nested widget
          const nestedId = match[1]
          const nestedBlock = this.config.blockCache.get(nestedId) ?? null
          const nestedWidget = new BlockRefWidget(
            nestedId,
            nestedBlock,
            this.config,
            this.depth + 1,
            newVisitedIds
          )
          fragment.appendChild(nestedWidget.toDOM())

          lastIndex = match.index! + match[0].length
        }

        // Add remaining text
        if (lastIndex < displayContent.length) {
          fragment.appendChild(
            document.createTextNode(displayContent.slice(lastIndex))
          )
        }

        wrapper.appendChild(fragment)
      } else {
        wrapper.textContent = displayContent
      }
    } else {
      // Max depth reached, show content without further expansion
      wrapper.textContent = displayContent
    }

    // Add click handler for navigation
    if (this.config.onClick && this.block) {
      wrapper.style.cursor = 'pointer'
      wrapper.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.config.onClick!(this.block!.note_date, this.block!.line_number)
      })

      // Add title for hover info
      wrapper.title = `From ${this.block.note_date} (click to navigate)`
    }

    return wrapper
  }

  ignoreEvent() {
    return false // Allow click events
  }
}

/**
 * Find all block references in the visible range
 */
function findBlockRefs(view: EditorView): Array<{ from: number; to: number; blockId: string }> {
  const refs: Array<{ from: number; to: number; blockId: string }> = []

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    const regex = new RegExp(BLOCK_REF_PATTERN.source, 'g')
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      refs.push({
        from: from + match.index,
        to: from + match.index + match[0].length,
        blockId: match[1]
      })
    }
  }

  return refs
}

/**
 * Build decorations for block references
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const config = view.state.facet(blockRefConfig)
  const refs = findBlockRefs(view)

  for (const ref of refs) {
    const block = config.blockCache.get(ref.blockId) ?? null
    const widget = new BlockRefWidget(ref.blockId, block, config)

    builder.add(ref.from, ref.to, Decoration.replace({ widget }))
  }

  return builder.finish()
}

/**
 * Extract all block IDs referenced in content
 */
export function extractBlockRefIds(content: string): string[] {
  const ids: string[] = []
  const regex = new RegExp(BLOCK_REF_PATTERN.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1])
  }

  return ids
}

/**
 * CodeMirror extension for rendering block references
 */
export function blockReference(config: BlockRefConfig) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate) {
        // Rebuild on doc change, viewport change, or when facet config changes
        if (update.docChanged || update.viewportChanged ||
            update.state.facet(blockRefConfig) !== update.startState.facet(blockRefConfig)) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  )

  return [
    plugin,
    blockRefConfig.of(config)
  ]
}
