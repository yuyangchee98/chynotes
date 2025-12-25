import { useState, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { DailyEditor } from './components/DailyEditor'
import { TagPage } from './components/TagPage'

type View = 'daily' | 'tag'

function App() {
  const [view, setView] = useState<View>('daily')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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

  return (
    <div className="h-screen flex bg-white dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar
        onTagSelect={handleTagSelect}
        onDailyNotesSelect={handleDailyNotesSelect}
        selectedTag={selectedTag}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
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
    </div>
  )
}

export default App
