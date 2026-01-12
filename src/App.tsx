import { useState, useCallback, useEffect, useMemo } from 'react'
import { Sidebar } from './components/Sidebar'
import { DailyEditor } from './components/DailyEditor'
import { DailyStream } from './components/DailyStream'
import { PageEditor } from './components/PageEditor'
import { SearchPage } from './components/SearchPage'
import { GraphView } from './components/GraphView'
import { SettingsModal } from './components/SettingsModal'
import { toLocalDateString } from './utils/format-date'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

type View = 'stream' | 'single-day' | 'tag' | 'search' | 'graph'
type Theme = 'light' | 'dark' | 'system'

function App() {
  const [view, setView] = useState<View>('stream')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('system')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Load and apply theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }

    localStorage.setItem('theme', theme)
  }, [theme])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const handleTagSelect = useCallback((tag: string) => {
    setSelectedTag(tag)
    setView('tag')
    setSidebarOpen(false)
  }, [])

  const handleDailyNotesSelect = useCallback(() => {
    setSelectedTag(null)
    setView('stream')
    setSidebarOpen(false)
  }, [])

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(tag)
    setView('tag')
  }, [])

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [])

  const [scrollToLine, setScrollToLine] = useState<number | null>(null)

  const handleDateSelect = useCallback((date: Date, line?: number) => {
    setSelectedTag(null)
    setView('single-day')
    setCurrentDate(date)
    setScrollToLine(line ?? null)
    setSidebarOpen(false)
  }, [])

  const handleSearchSelect = useCallback(() => {
    setSelectedTag(null)
    setView('search')
    setSidebarOpen(false)
  }, [])

  const handleGraphSelect = useCallback(() => {
    setSelectedTag(null)
    setView('graph')
    setSidebarOpen(false)
  }, [])

  // Handle copying content from an old note to today
  const handleCopyToToday = useCallback(async (content: string) => {
    if (window.api) {
      const todayStr = toLocalDateString(new Date())
      const existing = await window.api.readNote(todayStr) || '- '
      const newContent = existing.trimEnd() + '\n' + content
      await window.api.writeNote(todayStr, newContent)
    }
    // Navigate to today - note is already updated
    setSelectedTag(null)
    setView('single-day')
    setCurrentDate(new Date())
  }, [])

  // Handle escape key navigation
  const handleEscape = useCallback(() => {
    // Close sidebar if open on mobile
    if (sidebarOpen) {
      setSidebarOpen(false)
      return
    }
    // Close settings modal if open
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }
    // Navigate back based on current view
    if (view === 'search' || view === 'tag' || view === 'graph') {
      handleDailyNotesSelect()
    } else if (view === 'single-day') {
      setView('stream')
    }
  }, [sidebarOpen, settingsOpen, view, handleDailyNotesSelect])

  // Global keyboard shortcuts
  const keyboardCallbacks = useMemo(
    () => ({
      onOpenSearch: handleSearchSelect,
      onGoToToday: handleDailyNotesSelect,
      onEscape: handleEscape,
    }),
    [handleSearchSelect, handleDailyNotesSelect, handleEscape]
  )
  useKeyboardShortcuts(keyboardCallbacks)

  return (
    <div className="h-screen flex relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        onTagSelect={handleTagSelect}
        onDailyNotesSelect={handleDailyNotesSelect}
        onDateSelect={handleDateSelect}
        onSearchSelect={handleSearchSelect}
        onGraphSelect={handleGraphSelect}
        selectedTag={selectedTag}
        selectedDate={view === 'single-day' ? toLocalDateString(currentDate) : null}
        isStreamView={view === 'stream'}
        isSearchView={view === 'search'}
        isGraphView={view === 'graph'}
        onSettingsClick={() => setSettingsOpen(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'stream' && (
          <DailyStream
            onTagClick={handleTagClick}
            onCopyToToday={handleCopyToToday}
            onDateSelect={handleDateSelect}
          />
        )}
        {view === 'single-day' && (
          <DailyEditor
            date={currentDate}
            onTagClick={handleTagClick}
            scrollToLine={scrollToLine}
            onScrollComplete={() => setScrollToLine(null)}
            onCopyToToday={handleCopyToToday}
            onDateSelect={handleDateSelect}
          />
        )}
        {view === 'tag' && selectedTag && (
          <PageEditor
            pageName={selectedTag}
            onTagClick={handleTagClick}
            onBack={handleDailyNotesSelect}
            onDateSelect={handleDateSelect}
          />
        )}
        {view === 'search' && (
          <SearchPage
            onDateSelect={handleDateSelect}
            onTagClick={handleTagClick}
          />
        )}
        {view === 'graph' && (
          <GraphView onTagClick={handleTagClick} />
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={handleThemeChange}
      />
    </div>
  )
}

export default App
