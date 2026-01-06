/**
 * Block Context Menu Extension
 *
 * Adds a right-click context menu option to copy block references.
 * When a user right-clicks on a line with a block ID, they can copy
 * the block reference in ((block-id)) format.
 */

import { EditorView } from '@codemirror/view'

// Block ID pattern: §alphanumeric§ at end of line
const BLOCK_ID_PATTERN = /§([a-z0-9]+)§\s*$/

/**
 * Extract block ID from a line of text
 */
function extractBlockId(lineText: string): string | null {
  const match = lineText.match(BLOCK_ID_PATTERN)
  return match ? match[1] : null
}

/**
 * Create and show a custom context menu
 */
function showContextMenu(
  event: MouseEvent,
  blockId: string,
  onCopy: () => void
) {
  // Remove any existing context menu
  const existing = document.querySelector('.cm-block-context-menu')
  if (existing) {
    existing.remove()
  }

  const menu = document.createElement('div')
  menu.className = 'cm-block-context-menu'
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 180px;
  `

  const menuItem = document.createElement('button')
  menuItem.className = 'cm-block-context-menu-item'
  menuItem.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px 12px;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
  `
  menuItem.textContent = 'Copy block reference'
  menuItem.addEventListener('mouseenter', () => {
    menuItem.style.background = 'var(--bg-tertiary)'
  })
  menuItem.addEventListener('mouseleave', () => {
    menuItem.style.background = 'transparent'
  })
  menuItem.addEventListener('click', () => {
    navigator.clipboard.writeText(`((${blockId}))`)
    menu.remove()
    onCopy()
  })

  menu.appendChild(menuItem)
  document.body.appendChild(menu)

  // Close menu when clicking outside
  const closeMenu = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove()
      document.removeEventListener('click', closeMenu)
      document.removeEventListener('contextmenu', closeMenu)
    }
  }

  // Use setTimeout to avoid immediately closing from the same click
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
    document.addEventListener('contextmenu', closeMenu)
  }, 0)

  // Close on escape
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      menu.remove()
      document.removeEventListener('keydown', handleKeydown)
    }
  }
  document.addEventListener('keydown', handleKeydown)
}

/**
 * CodeMirror extension that adds context menu for copying block references
 */
export function blockContextMenu(onCopySuccess?: () => void) {
  return EditorView.domEventHandlers({
    contextmenu: (event: MouseEvent, view: EditorView) => {
      // Get the position from click coordinates
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return false

      // Get the line at this position
      const line = view.state.doc.lineAt(pos)
      const blockId = extractBlockId(line.text)

      if (blockId) {
        event.preventDefault()
        showContextMenu(event, blockId, () => {
          onCopySuccess?.()
        })
        return true
      }

      return false
    }
  })
}
