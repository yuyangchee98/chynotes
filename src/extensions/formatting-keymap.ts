/**
 * CodeMirror extension for markdown formatting keyboard shortcuts
 *
 * - Cmd/Ctrl + B → Bold (**text**)
 * - Cmd/Ctrl + I → Italic (*text*)
 * - Cmd/Ctrl + Shift + S → Strikethrough (~~text~~)
 */

import { keymap } from '@codemirror/view'
import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

/**
 * Wrap the current selection with a markdown wrapper.
 * If no selection, insert the wrapper pair and place cursor in the middle.
 */
function wrapSelection(view: EditorView, wrapper: string): boolean {
  const { state } = view
  const { from, to } = state.selection.main

  if (from === to) {
    // No selection: insert wrapper pair and place cursor inside
    const insert = wrapper + wrapper
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + wrapper.length),
    })
  } else {
    // Has selection: wrap it
    const text = state.sliceDoc(from, to)
    view.dispatch({
      changes: { from, to, insert: wrapper + text + wrapper },
      selection: EditorSelection.range(from + wrapper.length, to + wrapper.length),
    })
  }

  return true
}

/**
 * CodeMirror keymap extension for markdown formatting
 */
export const formattingKeymap = keymap.of([
  {
    key: 'Mod-b',
    run: (view) => wrapSelection(view, '**'),
  },
  {
    key: 'Mod-i',
    run: (view) => wrapSelection(view, '*'),
  },
  {
    key: 'Mod-Shift-s',
    run: (view) => wrapSelection(view, '~~'),
  },
])
