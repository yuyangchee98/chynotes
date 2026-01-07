import { useState, useRef, useCallback, ReactNode, useEffect } from 'react'
import { explanations, ExplanationKey } from '../content/explanations'

interface TooltipProps {
  explanationKey: ExplanationKey
  children: ReactNode
  delay?: number
  /** Called when user clicks a tag link inside the tooltip */
  onTagClick?: (tag: string) => void
  /** Nested tooltip level (0 = root, 1 = nested) */
  level?: number
}

/**
 * Parse tooltip body text and convert [[tag]] syntax to interactive elements
 */
function parseBody(
  text: string,
  onTagHover: (tag: string, rect: DOMRect) => void,
  onTagLeave: () => void,
  onTagClick?: (tag: string) => void
): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /\[\[([^\]]+)\]\]/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const tagName = match[1]
    parts.push(
      <span
        key={match.index}
        className="tooltip-inline-tag"
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          onTagHover(tagName, rect)
        }}
        onMouseLeave={onTagLeave}
        onClick={(e) => {
          e.stopPropagation()
          onTagClick?.(tagName)
        }}
      >
        [[{tagName}]]
      </span>
    )

    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export function Tooltip({
  explanationKey,
  children,
  delay = 400,
  onTagClick,
  level = 0,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isLeftSide, setIsLeftSide] = useState(false)

  // Nested tooltip state
  const [nestedTag, setNestedTag] = useState<string | null>(null)
  const [nestedPosition, setNestedPosition] = useState({ x: 0, y: 0 })
  const nestedTimeoutRef = useRef<number | null>(null)

  const showTimeoutRef = useRef<number | null>(null)
  const hideTimeoutRef = useRef<number | null>(null)
  const lockTimeoutRef = useRef<number | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const explanation = explanations[explanationKey]

  const clearAllTimeouts = useCallback(() => {
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current)
    if (nestedTimeoutRef.current) clearTimeout(nestedTimeoutRef.current)
  }, [])

  const showTooltip = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const tooltipWidth = 320 // max-width of tooltip
      const viewportWidth = window.innerWidth

      // Check if tooltip would overflow right side
      const wouldOverflowRight = rect.right + 12 + tooltipWidth > viewportWidth

      if (wouldOverflowRight) {
        // Position to the left of trigger
        setPosition({
          x: rect.left - 12,
          y: rect.top,
        })
        setIsLeftSide(true)
      } else {
        // Position to the right of trigger
        setPosition({
          x: rect.right + 12,
          y: rect.top,
        })
        setIsLeftSide(false)
      }
    }
    setIsVisible(true)

    // Start lock timer - after 800ms of visibility, tooltip locks
    lockTimeoutRef.current = window.setTimeout(() => {
      setIsLocked(true)
    }, 800)
  }, [])

  const hideTooltip = useCallback(() => {
    setIsVisible(false)
    setIsLocked(false)
    setIsHovering(false)
    setNestedTag(null)
  }, [])

  const handleTriggerEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    setIsHovering(true)
    showTimeoutRef.current = window.setTimeout(showTooltip, delay)
  }, [delay, showTooltip])

  const handleTriggerLeave = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }
    setIsHovering(false)

    // Small delay before hiding to allow mouse to enter panel
    hideTimeoutRef.current = window.setTimeout(() => {
      if (!panelRef.current?.matches(':hover')) {
        hideTooltip()
      }
    }, 100)
  }, [hideTooltip])

  const handlePanelEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  const handlePanelLeave = useCallback(() => {
    // When leaving panel, hide after small delay (unless re-entering)
    hideTimeoutRef.current = window.setTimeout(() => {
      hideTooltip()
    }, 150)
  }, [hideTooltip])

  // Nested tag hover handlers
  const handleNestedTagHover = useCallback((tag: string, rect: DOMRect) => {
    if (nestedTimeoutRef.current) {
      clearTimeout(nestedTimeoutRef.current)
    }
    nestedTimeoutRef.current = window.setTimeout(() => {
      setNestedPosition({
        x: rect.right + 8,
        y: rect.top,
      })
      setNestedTag(tag)
    }, 300)
  }, [])

  const handleNestedTagLeave = useCallback(() => {
    if (nestedTimeoutRef.current) {
      clearTimeout(nestedTimeoutRef.current)
      nestedTimeoutRef.current = null
    }
    // Delay hiding nested tooltip
    nestedTimeoutRef.current = window.setTimeout(() => {
      setNestedTag(null)
    }, 200)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return clearAllTimeouts
  }, [clearAllTimeouts])

  // Check if we have a nested explanation for the hovered tag
  const nestedExplanation = nestedTag && nestedTag.toLowerCase() === 'tags'
    ? explanations.tags
    : null

  return (
    <>
      <div
        ref={triggerRef}
        className="tooltip-wrapper"
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
        data-hovering={isHovering}
        data-tooltip-visible={isVisible}
      >
        {children}
        <span className="tooltip-pending" />
      </div>

      {isVisible && (
        <div
          ref={panelRef}
          className={`tooltip-panel ${isLocked ? 'is-locked' : ''} ${isLeftSide ? 'is-left' : ''}`}
          style={isLeftSide
            ? { right: window.innerWidth - position.x, top: position.y }
            : { left: position.x, top: position.y }
          }
          onMouseEnter={handlePanelEnter}
          onMouseLeave={handlePanelLeave}
        >
          <div className="tooltip-header">{explanation.title}</div>
          <div className="tooltip-body">
            {parseBody(
              explanation.body,
              handleNestedTagHover,
              handleNestedTagLeave,
              onTagClick
            )}
          </div>

          {/* Lock indicator */}
          {isLocked && <div className="tooltip-lock-indicator" />}

          {/* Nested tooltip for [[tags]] */}
          {nestedTag && nestedExplanation && (
            <div
              className="tooltip-panel tooltip-nested"
              style={{ left: nestedPosition.x - position.x, top: nestedPosition.y - position.y }}
              onMouseEnter={() => {
                if (nestedTimeoutRef.current) {
                  clearTimeout(nestedTimeoutRef.current)
                }
              }}
              onMouseLeave={handleNestedTagLeave}
            >
              <div className="tooltip-header">{nestedExplanation.title}</div>
              <div className="tooltip-body">{nestedExplanation.body}</div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .tooltip-wrapper {
          position: relative;
        }

        .tooltip-pending {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 0;
          background: var(--accent);
          opacity: 0;
          border-radius: 1px;
          transition: height 0.3s ease, opacity 0.2s ease;
        }

        .tooltip-wrapper[data-hovering="true"] .tooltip-pending {
          height: 16px;
          opacity: 0.5;
        }

        .tooltip-wrapper[data-tooltip-visible="true"] .tooltip-pending {
          height: 24px;
          opacity: 0.8;
        }

        .tooltip-panel {
          position: fixed;
          z-index: 1000;
          max-width: 320px;
          padding: 12px 14px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-left: 2px solid var(--accent);
          border-radius: 6px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          animation: tooltipIn 0.15s ease-out;
        }

        .tooltip-panel.is-locked {
          border-left-width: 3px;
        }

        .tooltip-panel.is-left {
          border-left: 1px solid var(--border);
          border-right: 2px solid var(--accent);
          animation: tooltipInLeft 0.15s ease-out;
        }

        .tooltip-panel.is-left.is-locked {
          border-right-width: 3px;
        }

        .tooltip-nested {
          position: absolute;
          animation: tooltipIn 0.12s ease-out;
        }

        .tooltip-lock-indicator {
          position: absolute;
          bottom: 6px;
          right: 6px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.4;
        }

        @keyframes tooltipIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes tooltipInLeft {
          from {
            opacity: 0;
            transform: translateX(8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .tooltip-header {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
          letter-spacing: 0.01em;
        }

        .tooltip-body {
          font-size: 12px;
          line-height: 1.55;
          color: var(--text-secondary);
          white-space: pre-line;
        }

        .tooltip-inline-tag {
          color: var(--accent);
          cursor: pointer;
          border-bottom: 1px dashed var(--accent);
          opacity: 0.9;
          transition: opacity 0.15s ease;
        }

        .tooltip-inline-tag:hover {
          opacity: 1;
          border-bottom-style: solid;
        }
      `}</style>
    </>
  )
}
