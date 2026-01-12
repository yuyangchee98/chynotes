/**
 * Image Attachment Extension
 *
 * Handles drag & drop and paste for images/files.
 * Renders images inline in the editor.
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

// Markdown image pattern: ![alt text](path)
const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g

// Image file extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']

/**
 * Check if a path points to an image file
 */
function isImagePath(path: string): boolean {
  const lower = path.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

// Configuration for the image attachment extension
interface ImageAttachmentConfig {
  /** Current note date in YYYY-MM-DD format */
  noteDate: string
  /** Function to resolve relative asset paths to absolute paths */
  resolveAssetPath: (relativePath: string) => Promise<string>
  /** Function to save an asset */
  saveAsset: (
    buffer: Uint8Array,
    originalName: string,
    dateStr: string
  ) => Promise<{ relativePath: string; absolutePath: string; hash: string; isNew: boolean }>
  /** Function to generate AI description for an image */
  generateImageDescription?: (imageBase64: string) => Promise<string>
}

// Facet to provide configuration
const imageConfig = Facet.define<ImageAttachmentConfig, ImageAttachmentConfig>({
  combine: (values) =>
    values[0] ?? {
      noteDate: '',
      resolveAssetPath: async () => '',
      saveAsset: async () => ({ relativePath: '', absolutePath: '', hash: '', isNew: false }),
    },
})

// Cache for resolved paths (relative -> absolute)
const pathCache = new Map<string, string>()

/**
 * Widget that displays an inline image
 */
class ImageWidget extends WidgetType {
  constructor(
    readonly alt: string,
    readonly src: string,
    readonly absoluteSrc: string
  ) {
    super()
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM() {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-image-widget'

    const img = document.createElement('img')
    img.src = this.absoluteSrc
    img.alt = this.alt
    img.title = this.alt || this.src
    img.className = 'cm-inline-image'

    // Error handling for missing images
    img.onerror = () => {
      wrapper.innerHTML = `<span class="cm-image-error">[Image not found: ${this.src}]</span>`
    }

    wrapper.appendChild(img)
    return wrapper
  }

  ignoreEvent() {
    return true // Don't intercept events on images
  }
}

/**
 * Widget that displays a file link (non-image attachments)
 */
class FileWidget extends WidgetType {
  constructor(
    readonly filename: string,
    readonly src: string
  ) {
    super()
  }

  eq(other: FileWidget) {
    return other.src === this.src
  }

  toDOM() {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-file-widget'

    const icon = document.createElement('span')
    icon.className = 'cm-file-icon'
    icon.textContent = '📎'

    const link = document.createElement('span')
    link.className = 'cm-file-link'
    link.textContent = this.filename || this.src

    wrapper.appendChild(icon)
    wrapper.appendChild(link)
    return wrapper
  }

  ignoreEvent() {
    return true
  }
}

/**
 * Find all image/file references in the visible range
 */
function findImageRefs(
  view: EditorView
): Array<{ from: number; to: number; alt: string; src: string }> {
  const refs: Array<{ from: number; to: number; alt: string; src: string }> = []

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    const regex = new RegExp(IMAGE_PATTERN.source, 'g')
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      refs.push({
        from: from + match.index,
        to: from + match.index + match[0].length,
        alt: match[1],
        src: match[2],
      })
    }
  }

  return refs
}

/**
 * Build decorations for images/files
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const config = view.state.facet(imageConfig)
  const refs = findImageRefs(view)

  for (const ref of refs) {
    // Check if this is an asset path (starts with "assets/")
    const isAssetPath = ref.src.startsWith('assets/')

    if (isImagePath(ref.src)) {
      // For images, we need the absolute path
      // Use cached path if available, otherwise show placeholder
      let absoluteSrc = ref.src

      if (isAssetPath) {
        const cached = pathCache.get(ref.src)
        if (cached) {
          absoluteSrc = `file://${cached}`
        } else {
          // Queue path resolution (async)
          config.resolveAssetPath(ref.src).then((resolved) => {
            if (resolved) {
              pathCache.set(ref.src, resolved)
              // Trigger re-render by dispatching a no-op transaction
              view.dispatch({})
            }
          })
          // Use relative path for now (won't display but will update)
          absoluteSrc = ref.src
        }
      }

      const widget = new ImageWidget(ref.alt, ref.src, absoluteSrc)
      builder.add(ref.from, ref.to, Decoration.replace({ widget }))
    } else {
      // Non-image file
      const filename = ref.src.split('/').pop() || ref.src
      const widget = new FileWidget(filename, ref.src)
      builder.add(ref.from, ref.to, Decoration.replace({ widget }))
    }
  }

  return builder.finish()
}

/**
 * Read file as ArrayBuffer
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Read file as Base64 (for AI vision)
 */
async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Remove the data URL prefix to get just the base64
      const base64 = dataUrl.split(',')[1]
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Handle a file being dropped or pasted
 */
async function handleFile(
  file: File,
  view: EditorView,
  insertPos: number
): Promise<void> {
  const config = view.state.facet(imageConfig)

  if (!config.noteDate) {
    console.error('No noteDate configured for image attachment')
    return
  }

  try {
    // Read file content
    const arrayBuffer = await readFileAsArrayBuffer(file)
    const buffer = new Uint8Array(arrayBuffer)

    // Save the asset
    const result = await config.saveAsset(buffer, file.name, config.noteDate)

    // Generate AI description for images (if available and it's an image)
    let altText = file.name
    if (isImagePath(file.name) && config.generateImageDescription) {
      try {
        const base64 = await readFileAsBase64(file)
        const description = await config.generateImageDescription(base64)
        if (description) {
          altText = description
        }
      } catch (err) {
        console.warn('Failed to generate image description:', err)
      }
    }

    // Insert markdown at position
    const markdown = `![${altText}](${result.relativePath})`

    view.dispatch({
      changes: { from: insertPos, insert: markdown },
      selection: { anchor: insertPos + markdown.length },
    })

    // Cache the resolved path immediately
    pathCache.set(result.relativePath, result.absolutePath)
  } catch (err) {
    console.error('Failed to save asset:', err)
  }
}

/**
 * DOM event handlers for drag & drop and paste
 */
const eventHandlers = EditorView.domEventHandlers({
  dragover(event) {
    // Accept file drops
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      return true
    }
    return false
  },

  drop(event, view) {
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return false

    event.preventDefault()

    // Get drop position
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false

    // Handle each file
    for (const file of Array.from(files)) {
      handleFile(file, view, pos)
    }

    return true
  },

  paste(event, view) {
    const items = event.clipboardData?.items
    if (!items) return false

    // Check for files in clipboard
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (!file) continue

        event.preventDefault()

        // Insert at cursor position
        const { from } = view.state.selection.main
        handleFile(file, view, from)

        return true
      }
    }

    return false
  },
})

/**
 * CodeMirror extension for image attachments
 */
export function imageAttachment(config: ImageAttachmentConfig) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.state.facet(imageConfig) !== update.startState.facet(imageConfig)
        ) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  )

  return [plugin, imageConfig.of(config), eventHandlers]
}

/**
 * Clear the path cache (useful when switching notes)
 */
export function clearPathCache() {
  pathCache.clear()
}
