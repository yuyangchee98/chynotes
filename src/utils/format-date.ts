/**
 * Smart date formatting
 * Format: "January 2, 2025 Today" or "December 31, 2024 Tuesday"
 * Always shows full date with year, plus relative label when relevant
 */

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  // Format the date part (always with year)
  const dateFormatted = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  // Single-word relative label (only for recent dates)
  let label = ''
  if (diffDays === 0) {
    label = 'Today'
  } else if (diffDays === 1) {
    label = 'Yesterday'
  } else if (diffDays < 7) {
    label = date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  // Combine: "January 2, 2025 Today" or just "January 2, 2025"
  if (label) {
    return `${dateFormatted} ${label}`
  }
  return dateFormatted
}

/**
 * Format a Date object
 */
export function formatDateFromDate(date: Date): string {
  const dateStr = date.toISOString().split('T')[0]
  return formatDate(dateStr)
}
