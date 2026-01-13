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
import type { BlockRecord } from '../core/types'

// Re-export for consumers
export type { BlockRecord }

// Block reference pattern: ((8 hex characters))
const BLOCK_REF_PATTERN = /\(\(([a-f0-9]{8})\)\)/g

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

    // Render blocks - parent has no bullet (editor provides it), children have bullets
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i]
      const isParent = i === 0
      const line = document.createElement('div')
      line.className = 'cm-block-ref-line'

      // Calculate indent relative to parent
      const relativeIndent = block.indent_level - parentBlock.indent_level
      line.style.paddingLeft = `${relativeIndent * 20}px`

      // Add bullet only for children (parent's bullet comes from the editor)
      if (!isParent) {
        const bullet = document.createElement('span')
        bullet.className = 'cm-bullet-widget'
        bullet.setAttribute('data-indent', String(relativeIndent))
        line.appendChild(bullet)
      }

      // Add content (strip block ID and original bullet)
      const content = document.createElement('span')
      content.textContent = block.content
        .replace(/\s*§[a-z0-9]+§\s*$/, '') // Strip block ID
        .replace(/^\s*-\s*/, '') // Strip bullet
      line.appendChild(content)

      wrapper.appendChild(line)
    }

    // Add click handler for navigation
    if (this.config.onClick && parentBlock) {
      wrapper.style.cursor = 'pointer'
      wrapper.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.config.onClick!(parentBlock.note_date, parentBlock.line_number)
      })

      // Hover title
      const childCount = children.length
      wrapper.title = `From ${parentBlock.note_date}${childCount > 0 ? ` (+${childCount})` : ''}`
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
