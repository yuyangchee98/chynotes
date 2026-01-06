/**
 * Block Reference Extension
 *
 * Renders ((block-id)) syntax as inline embeds showing the referenced block content.
 * Supports parent-child relationships - shows block with all its children.
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
  // Cache now stores arrays of blocks (parent + children)
  blockCache: Map<string, BlockRecord[]>
  onClick?: (noteDate: string, lineNumber: number) => void
}

// Facet to provide configuration
const blockRefConfig = Facet.define<BlockRefConfig, BlockRefConfig>({
  combine: values => values[0] ?? { blockCache: new Map() }
})

/**
 * Widget that displays a block reference with children
 */
class BlockRefWidget extends WidgetType {
  constructor(
    readonly blockId: string,
    readonly blocks: BlockRecord[], // Parent + children
    readonly config: BlockRefConfig
  ) {
    super()
  }

  eq(other: BlockRefWidget) {
    return other.blockId === this.blockId &&
           other.blocks.length === this.blocks.length &&
           other.blocks.every((b, i) => b.content === this.blocks[i]?.content)
  }

  toDOM() {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-block-reference'

    // Check if blocks exist
    if (this.blocks.length === 0) {
      wrapper.className += ' cm-block-reference-missing'
      wrapper.textContent = '[Block not found]'
      return wrapper
    }

    const parentBlock = this.blocks[0]
    const children = this.blocks.slice(1)
    const hasChildren = children.length > 0

    // Create container
    const container = document.createElement('div')
    container.className = 'cm-block-ref-container'

    // Parent block content
    const parentDiv = document.createElement('div')
    parentDiv.className = 'cm-block-ref-parent'
    let parentContent = parentBlock.content
      .replace(/\s*§[a-z0-9]+§\s*$/, '') // Strip block ID
      .replace(/^\s*-\s*/, '') // Strip bullet
    parentDiv.textContent = parentContent
    container.appendChild(parentDiv)

    // Children (if any)
    if (hasChildren) {
      const childrenContainer = document.createElement('div')
      childrenContainer.className = 'cm-block-ref-children'

      for (const child of children) {
        const childDiv = document.createElement('div')
        childDiv.className = 'cm-block-ref-child'

        // Calculate relative indent (relative to parent)
        const relativeIndent = child.indent_level - parentBlock.indent_level
        childDiv.style.paddingLeft = `${relativeIndent * 12}px`

        let childContent = child.content
          .replace(/\s*§[a-z0-9]+§\s*$/, '') // Strip block ID
          .replace(/^\s*-\s*/, '') // Strip bullet
        childDiv.textContent = childContent
        childrenContainer.appendChild(childDiv)
      }

      container.appendChild(childrenContainer)
    }

    wrapper.appendChild(container)

    // Add click handler for navigation
    if (this.config.onClick && parentBlock) {
      wrapper.style.cursor = 'pointer'
      wrapper.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.config.onClick!(parentBlock.note_date, parentBlock.line_number)
      })

      // Add title for hover info
      const childCount = children.length
      wrapper.title = `From ${parentBlock.note_date}${childCount > 0 ? ` (${childCount} children)` : ''} - click to navigate`
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
    const blocks = config.blockCache.get(ref.blockId) ?? []
    const widget = new BlockRefWidget(ref.blockId, blocks, config)

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
