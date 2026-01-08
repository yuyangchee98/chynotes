/**
 * CodeMirror extension for markdown formatting keyboard shortcuts
 *
 * - Cmd/Ctrl + B → Bold (**text**)
 * - Cmd/Ctrl + I → Italic (*text*)
 * - Cmd/Ctrl + Shift + S → Strikethrough (~~text~~)
 *
 * Uses Prec.highest() to override CodeMirror's default bindings
 * (e.g., Mod-i is normally selectParentSyntax for code editing)
 */

import { keymap, EditorView } from '@codemirror/view'
import { EditorSelection, Prec } from '@codemirror/state'
import { KeyBinding, getBinding } from '../core/keyboard-config'

/**
 * Convert KeyBinding to CodeMirror key format
 * Example: {key: 'b', ctrl: true, meta: true} → 'Mod-b'
 *          {key: 's', ctrl: true, meta: true, shift: true} → 'Mod-Shift-s'
 */
function keyBindingToCodeMirrorKey(binding: KeyBinding): string {
  const parts: string[] = []

  // 'Mod' means Cmd on Mac, Ctrl on Windows/Linux
  if (binding.ctrl || binding.meta) {
    parts.push('Mod')
  }

  if (binding.shift) parts.push('Shift')
  if (binding.alt) parts.push('Alt')

  parts.push(binding.key.toLowerCase())

  return parts.join('-')
}

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
 * Create CodeMirror keymap extension for markdown formatting
 * Wrapped in Prec.highest() to override default CodeMirror bindings
 *
 * @param customBindings - Custom keyboard bindings from settings
 */
export function createFormattingKeymap(customBindings: Record<string, KeyBinding> = {}) {
  const boldKey = keyBindingToCodeMirrorKey(getBinding('bold', customBindings))
  const italicKey = keyBindingToCodeMirrorKey(getBinding('italic', customBindings))
  const strikethroughKey = keyBindingToCodeMirrorKey(getBinding('strikethrough', customBindings))

  return Prec.highest(
    keymap.of([
      {
        key: boldKey,
        run: (view) => wrapSelection(view, '**'),
      },
      {
        key: italicKey,
        run: (view) => wrapSelection(view, '*'),
      },
      {
        key: strikethroughKey,
        run: (view) => wrapSelection(view, '~~'),
      },
    ])
  )
}

/**
 * Default formatting keymap (backward compatibility)
 */
export const formattingKeymap = createFormattingKeymap()
