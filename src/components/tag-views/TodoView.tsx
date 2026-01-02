import { useMemo } from 'react'
import { formatDate } from '../../utils/format-date'

export interface TagViewProps {
  notes: { date: string; line: number; content: string }[]
  onUpdateLine: (date: string, line: number, newContent: string) => void
}

interface TodoItem {
  date: string
  line: number
  content: string
  text: string
  isChecked: boolean
}

/**
 * Parse a line to extract todo information
 * Expects format: - [ ] Task text #todo or - [x] Task text #todo
 */
function parseTodoLine(content: string): { text: string; isChecked: boolean } | null {
  // Match markdown checkbox pattern
  const match = content.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/)
  if (!match) {
    // Fallback: just a line with #todo
    return { text: content, isChecked: false }
  }

  const [, , checkbox, text] = match
  return {
    text: text.trim(),
    isChecked: checkbox.toLowerCase() === 'x'
  }
}

/**
 * Toggle checkbox in a line
 */
function toggleCheckbox(content: string): string {
  // Match markdown checkbox pattern
  const match = content.match(/^(\s*-\s*)\[([ xX])\](\s*.*)$/)
  if (!match) {
    // No checkbox found, add one
    const listMatch = content.match(/^(\s*-\s*)(.*)$/)
    if (listMatch) {
      return `${listMatch[1]}[ ] ${listMatch[2]}`
    }
    return `- [ ] ${content}`
  }

  const [, prefix, checkbox, rest] = match
  const newCheckbox = checkbox === ' ' ? 'x' : ' '
  return `${prefix}[${newCheckbox}]${rest}`
}

export function TodoView({ notes, onUpdateLine }: TagViewProps) {
  // Parse and group todos
  const { incomplete, completed } = useMemo(() => {
    const items: TodoItem[] = notes.map(note => {
      const parsed = parseTodoLine(note.content)
      return {
        date: note.date,
        line: note.line,
        content: note.content,
        text: parsed?.text || note.content,
        isChecked: parsed?.isChecked || false
      }
    })

    return {
      incomplete: items.filter(item => !item.isChecked),
      completed: items.filter(item => item.isChecked)
    }
  }, [notes])

  const handleToggle = (item: TodoItem) => {
    const newContent = toggleCheckbox(item.content)
    onUpdateLine(item.date, item.line, newContent)
  }


  // Group by date
  const groupByDate = (items: TodoItem[]) => {
    const groups: Record<string, TodoItem[]> = {}
    for (const item of items) {
      if (!groups[item.date]) {
        groups[item.date] = []
      }
      groups[item.date].push(item)
    }
    // Sort dates newest first
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }

  const renderItem = (item: TodoItem) => (
    <label
      key={`${item.date}-${item.line}`}
      className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group"
    >
      <input
        type="checkbox"
        checked={item.isChecked}
        onChange={() => handleToggle(item)}
        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <span className={`block ${item.isChecked ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
          {item.text.replace(/#\w+/g, '').trim()}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatDate(item.date)}
        </span>
      </div>
    </label>
  )

  if (notes.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-center py-8">
        No todos found. Add items with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">- [ ] task #todo</code>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Incomplete todos */}
      {incomplete.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            To Do ({incomplete.length})
          </h2>
          <div className="space-y-1">
            {groupByDate(incomplete).map(([date, items]) => (
              <div key={date}>
                {items.map(renderItem)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed todos */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Completed ({completed.length})
          </h2>
          <div className="space-y-1 opacity-60">
            {groupByDate(completed).map(([date, items]) => (
              <div key={date}>
                {items.map(renderItem)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
