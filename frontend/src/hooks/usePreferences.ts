import { useState, useCallback } from 'react'
import type { ViewMode } from '@/types'

const STORAGE_PREFIX = 'unifiedsaved:'

interface Preferences {
  defaultView: ViewMode
  defaultPageSize: number
}

const DEFAULT_PREFERENCES: Preferences = {
  defaultView: 'grid',
  defaultPageSize: 50,
}

/**
 * Read a preference from localStorage
 */
function readPreference<K extends keyof Preferences>(
  key: K,
  defaultValue: Preferences[K]
): Preferences[K] {
  if (typeof window === 'undefined') return defaultValue

  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    if (stored === null) return defaultValue
    return JSON.parse(stored) as Preferences[K]
  } catch {
    return defaultValue
  }
}

/**
 * Write a preference to localStorage
 */
function writePreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value))
  } catch {
    // Storage might be full or disabled
    console.warn(`Failed to save preference: ${key}`)
  }
}

/**
 * usePreferences hook - Manages user preferences with localStorage persistence
 * Features:
 * - Default view mode (grid/list)
 * - Default page size
 * - Automatic localStorage sync
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => ({
    defaultView: readPreference('defaultView', DEFAULT_PREFERENCES.defaultView),
    defaultPageSize: readPreference('defaultPageSize', DEFAULT_PREFERENCES.defaultPageSize),
  }))

  /**
   * Update default view mode
   */
  const setDefaultView = useCallback((view: ViewMode) => {
    setPreferences((prev) => ({ ...prev, defaultView: view }))
    writePreference('defaultView', view)
  }, [])

  /**
   * Update default page size
   */
  const setDefaultPageSize = useCallback((size: number) => {
    setPreferences((prev) => ({ ...prev, defaultPageSize: size }))
    writePreference('defaultPageSize', size)
  }, [])

  /**
   * Reset all preferences to defaults
   */
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    Object.keys(DEFAULT_PREFERENCES).forEach((key) => {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
    })
  }, [])

  return {
    preferences,
    setDefaultView,
    setDefaultPageSize,
    resetPreferences,
  }
}

export default usePreferences
