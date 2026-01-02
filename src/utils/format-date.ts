/**
 * Smart date formatting
 * Returns { date, label } for aligned display with optional pill
 * Date format: "Jan 02, 2025" (short month, padded day, always year)
 * Label: "Today", "Yesterday", or weekday for recent dates
 */

export interface FormattedDate {
  date: string
  label?: string
}

export function formatDate(dateStr: string): FormattedDate {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  // Format: "Jan 02, 2025" (aligned format)
  const monthStr = date.toLocaleDateString('en-US', { month: 'short' })
  const dayStr = String(day).padStart(2, '0')
  const dateFormatted = `${monthStr} ${dayStr}, ${year}`

  // Label for recent dates
  let label: string | undefined
  if (diffDays === 0) {
    label = 'Today'
  } else if (diffDays === 1) {
    label = 'Yesterday'
  } else if (diffDays < 7) {
    label = date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  return { date: dateFormatted, label }
}

/**
 * Format a Date object
 */
export function formatDateFromDate(date: Date): FormattedDate {
  const dateStr = date.toISOString().split('T')[0]
  return formatDate(dateStr)
}
