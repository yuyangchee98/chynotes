import { ComponentType } from 'react'
import { TodoView, TagViewProps } from './TodoView'
import { DoneView } from './DoneView'

export type { TagViewProps } from './TodoView'

/**
 * Registry of hardcoded views for specific tags
 * These views have full access to callbacks and provide a polished UX
 */
export const HARDCODED_VIEWS: Record<string, ComponentType<TagViewProps>> = {
  'todo': TodoView,
  'done': DoneView,
}

/**
 * Check if a tag has a hardcoded view
 */
export function hasHardcodedView(tagName: string): boolean {
  return tagName.toLowerCase() in HARDCODED_VIEWS
}

/**
 * Get the hardcoded view for a tag (if it exists)
 */
export function getHardcodedView(tagName: string): ComponentType<TagViewProps> | null {
  return HARDCODED_VIEWS[tagName.toLowerCase()] || null
}
