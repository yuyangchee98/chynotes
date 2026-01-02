import { useMemo } from 'react'
import { TagViewProps } from './TodoView'
import { formatDateCompact } from '../../utils/format-date'

interface DoneItem {
  date: string
  line: number
  content: string
  text: string
}

/**
 * Parse a line to extract the text (remove tag and checkbox)
 */
function parseContent(content: string): string {
  // Remove checkbox if present
  let text = content.replace(/^(\s*)-\s*\[[xX]\]\s*/, '- ')
  // Remove #done tag
  text = text.replace(/#done\b/gi, '').trim()
  return text
}

export function DoneView({ notes }: TagViewProps) {
  // Parse and group by date
  const groupedByDate = useMemo(() => {
    const items: DoneItem[] = notes.map(note => ({
      date: note.date,
      line: note.line,
      content: note.content,
      text: parseContent(note.content)
    }))

    // Group by date
    const groups: Record<string, DoneItem[]> = {}
    for (const item of items) {
      if (!groups[item.date]) {
        groups[item.date] = []
      }
      groups[item.date].push(item)
    }

    // Sort dates newest first
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [notes])


  if (notes.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-center py-8">
        No completed items yet.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>{notes.length} completed item{notes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Items grouped by date */}
      {groupedByDate.map(([date, items]) => (
        <div key={date}>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            {formatDateCompact(date)}
          </h2>
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={`${item.date}-${item.line}`}
                className="flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900"
              >
                <svg className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-600 dark:text-gray-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
