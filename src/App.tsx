import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { DailyEditor } from './components/DailyEditor'
import { TagPage } from './components/TagPage'
import { SettingsModal } from './components/SettingsModal'

type View = 'daily' | 'tag'
type Theme = 'light' | 'dark' | 'system'

function App() {
  const [view, setView] = useState<View>('daily')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('system')

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
  }, [])

  const handleDailyNotesSelect = useCallback(() => {
    setSelectedTag(null)
    setView('daily')
    setCurrentDate(new Date())
  }, [])

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(tag)
    setView('tag')
  }, [])

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [])

  return (
    <div className="h-screen flex bg-white dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar
        onTagSelect={handleTagSelect}
        onDailyNotesSelect={handleDailyNotesSelect}
        selectedTag={selectedTag}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'daily' ? (
          <DailyEditor
            date={currentDate}
            onTagClick={handleTagClick}
          />
        ) : (
          <TagPage
            tagName={selectedTag!}
            onTagClick={handleTagClick}
            onBack={handleDailyNotesSelect}
          />
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
