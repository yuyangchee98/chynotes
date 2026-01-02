/**
 * Smart date formatting - single line, relative when useful
 *
 * Compact: Today, Yesterday, Tuesday, Last Sun, Dec 28, Dec 28 '24
 * Full: Today, Yesterday, Tuesday, Last Sunday, December 28, December 28, 2024
 */

export function formatDate(dateStr: string, options?: { compact?: boolean }): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  const dayOfWeek = date.getDay()
  const todayDayOfWeek = today.getDay()

  // Calculate week difference
  const todayWeekStart = new Date(today)
  todayWeekStart.setDate(today.getDate() - todayDayOfWeek)
  const dateWeekStart = new Date(date)
  dateWeekStart.setDate(date.getDate() - dayOfWeek)
  const weekDiff = Math.floor((todayWeekStart.getTime() - dateWeekStart.getTime()) / (1000 * 60 * 60 * 24 * 7))

  const compact = options?.compact
  const sameYear = date.getFullYear() === today.getFullYear()

  // Today / Yesterday - always use word
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  // This week - just day name
  if (weekDiff === 0) {
    return date.toLocaleDateString('en-US', { weekday: compact ? 'short' : 'long' })
  }

  // Last week - "Last Sun" or "Last Sunday"
  if (weekDiff === 1) {
    const dayName = date.toLocaleDateString('en-US', { weekday: compact ? 'short' : 'long' })
    return `Last ${dayName}`
  }

  // Older - just show date
  if (compact) {
    // "Dec 28" or "Dec 28 '24"
    if (sameYear) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    // Use 2-digit year for compactness
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${monthDay} '${String(date.getFullYear()).slice(-2)}`
  } else {
    // "December 28" or "December 28, 2024"
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: sameYear ? undefined : 'numeric'
    })
  }
}

/**
 * Compact version for sidebar and inline use
 */
export function formatDateCompact(dateStr: string): string {
  return formatDate(dateStr, { compact: true })
}

/**
 * Format a Date object (for DailyStream which uses Date objects)
 */
export function formatDateFromDate(date: Date, options?: { compact?: boolean }): string {
  const dateStr = date.toISOString().split('T')[0]
  return formatDate(dateStr, options)
}
