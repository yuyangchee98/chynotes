import { useState, useEffect, useRef } from 'react'
import { KeyBinding, formatKeyBinding } from '../core/keyboard-config'

interface KeyCaptureProps {
  currentBinding: KeyBinding
  onSave: (binding: KeyBinding) => void
  onCancel: () => void
}

export function KeyCapture({ currentBinding, onSave, onCancel }: KeyCaptureProps) {
  const [capturedBinding, setCapturedBinding] = useState<KeyBinding | null>(null)
  const [isListening, setIsListening] = useState(true)
  const inputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isListening) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore just modifier keys
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) {
        return
      }

      // Capture the combination
      const binding: KeyBinding = {
        key: e.key.toLowerCase(),
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      }

      setCapturedBinding(binding)
      setIsListening(false)
      e.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isListening])

  // Focus the capture area on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSave = () => {
    if (capturedBinding) {
      onSave(capturedBinding)
    }
  }

  const handleClear = () => {
    setCapturedBinding(null)
    setIsListening(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Record Keyboard Shortcut
        </h3>

        {/* Capture area */}
        <div
          ref={inputRef}
          tabIndex={0}
          className="mb-4 p-4 border-2 border-blue-500 rounded-md bg-gray-50 dark:bg-gray-800 text-center focus:outline-none"
        >
          {isListening ? (
            <div className="text-gray-500 dark:text-gray-400">
              Press any key combination...
            </div>
          ) : capturedBinding ? (
            <div className="text-lg font-mono text-gray-900 dark:text-gray-100">
              {formatKeyBinding(capturedBinding)}
            </div>
          ) : null}
        </div>

        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2">Current: <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">{formatKeyBinding(currentBinding)}</kbd></p>
          {capturedBinding && (
            <p>New: <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">{formatKeyBinding(capturedBinding)}</kbd></p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            disabled={!capturedBinding}
          >
            Clear
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!capturedBinding}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
