import { useState, useCallback, useMemo, useEffect } from 'react'
import type { FilterState, Source, ItemStatus, SortByField, SortOrder, GroupByOption, ViewMode } from '@/types'

interface UseItemFiltersOptions {
  /**
   * Initial filter state (defaults to empty filters)
   */
  initialFilters?: Partial<FilterState>
  /**
   * Whether to sync filters with URL search params
   */
  syncWithUrl?: boolean
}

/**
 * Default empty filter state
 */
const DEFAULT_FILTERS: FilterState = {
  sources: [],
  status: null,
  search: '',
  tags: [],
  sortBy: 'saved_at',
  sortOrder: 'desc',
  savedAfter: null,
  savedBefore: null,
  groupBy: 'none',
}

/**
 * Parse filters from URL search params
 */
function parseFiltersFromUrl(searchParams: URLSearchParams): Partial<FilterState> {
  const filters: Partial<FilterState> = {}

  // Parse sources
  const sources = searchParams.get('sources')
  if (sources) {
    filters.sources = sources.split(',').filter(Boolean) as Source[]
  }

  // Parse status
  const status = searchParams.get('status')
  if (status && ['unprocessed', 'read', 'archived'].includes(status)) {
    filters.status = status as ItemStatus
  }

  // Parse search
  const search = searchParams.get('search')
  if (search) {
    filters.search = search
  }

  // Parse tags
  const tags = searchParams.get('tags')
  if (tags) {
    filters.tags = tags.split(',').filter(Boolean)
  }

  // Parse sort
  const sort = searchParams.get('sort')
  if (sort) {
    const [sortBy, sortOrder] = sort.split(':')
    if (['saved_at', 'synced_at', 'created_at', 'title', 'priority'].includes(sortBy)) {
      filters.sortBy = sortBy as SortByField
    }
    if (['asc', 'desc'].includes(sortOrder)) {
      filters.sortOrder = sortOrder as SortOrder
    }
  }

  // Parse date range
  const from = searchParams.get('from')
  if (from) {
    filters.savedAfter = from
  }

  const to = searchParams.get('to')
  if (to) {
    filters.savedBefore = to
  }

  // Parse groupBy
  const groupBy = searchParams.get('group')
  if (groupBy && ['none', 'date', 'source', 'tags'].includes(groupBy)) {
    filters.groupBy = groupBy as GroupByOption
  }

  return filters
}

/**
 * Parse page from URL
 */
function parsePageFromUrl(searchParams: URLSearchParams): number {
  const page = searchParams.get('page')
  if (page) {
    const parsed = parseInt(page, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return 1
}

/**
 * Parse view mode from URL
 */
function parseViewFromUrl(searchParams: URLSearchParams): ViewMode | null {
  const view = searchParams.get('view')
  if (view && ['grid', 'list'].includes(view)) {
    return view as ViewMode
  }
  return null
}

/**
 * Serialize filters to URL search params
 */
function serializeFiltersToUrl(
  filters: FilterState,
  page: number,
  viewMode: ViewMode | null
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.sources.length > 0) {
    params.set('sources', filters.sources.join(','))
  }

  if (filters.status) {
    params.set('status', filters.status)
  }

  if (filters.search) {
    params.set('search', filters.search)
  }

  if (filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','))
  }

  // Sort (only if not default)
  if (filters.sortBy !== 'saved_at' || filters.sortOrder !== 'desc') {
    params.set('sort', `${filters.sortBy}:${filters.sortOrder}`)
  }

  // Date range
  if (filters.savedAfter) {
    params.set('from', filters.savedAfter)
  }

  if (filters.savedBefore) {
    params.set('to', filters.savedBefore)
  }

  // Group by (only if not default)
  if (filters.groupBy !== 'none') {
    params.set('group', filters.groupBy)
  }

  // Page (only if not 1)
  if (page > 1) {
    params.set('page', String(page))
  }

  // View mode (if set)
  if (viewMode) {
    params.set('view', viewMode)
  }

  return params
}

/**
 * useItemFilters hook - Manages filter state with optional URL sync
 * Features:
 * - Type-safe filter state management
 * - URL synchronization for shareable links and browser back/forward
 * - Pagination, sorting, date range, and grouping support
 */
export function useItemFilters(options: UseItemFiltersOptions = {}) {
  const { initialFilters = {}, syncWithUrl = true } = options

  // Initialize filters from URL if syncing, otherwise use initial values
  const [filters, setFiltersState] = useState<FilterState>(() => {
    if (syncWithUrl && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const urlFilters = parseFiltersFromUrl(urlParams)
      return { ...DEFAULT_FILTERS, ...initialFilters, ...urlFilters }
    }
    return { ...DEFAULT_FILTERS, ...initialFilters }
  })

  // Pagination state - initialized from URL
  const [page, setPageState] = useState(() => {
    if (syncWithUrl && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return parsePageFromUrl(urlParams)
    }
    return 1
  })

  // View mode state - initialized from URL or null (use preference)
  const [viewMode, setViewModeState] = useState<ViewMode | null>(() => {
    if (syncWithUrl && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return parseViewFromUrl(urlParams)
    }
    return null
  })

  /**
   * Sync state to URL
   */
  const syncToUrl = useCallback(
    (newFilters: FilterState, newPage: number, newViewMode: ViewMode | null) => {
      if (!syncWithUrl) return

      const params = serializeFiltersToUrl(newFilters, newPage, newViewMode)
      const searchString = params.toString()
      const newUrl = searchString
        ? `${window.location.pathname}?${searchString}`
        : window.location.pathname

      // Use pushState for actual navigation (not replaceState)
      // This allows browser back/forward to work
      window.history.pushState({ filters: newFilters, page: newPage }, '', newUrl)
    },
    [syncWithUrl]
  )

  /**
   * Handle browser back/forward
   */
  useEffect(() => {
    if (!syncWithUrl) return

    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const urlFilters = parseFiltersFromUrl(urlParams)
      const urlPage = parsePageFromUrl(urlParams)
      const urlView = parseViewFromUrl(urlParams)

      setFiltersState({ ...DEFAULT_FILTERS, ...urlFilters })
      setPageState(urlPage)
      setViewModeState(urlView)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [syncWithUrl])

  /**
   * Update filters and sync to URL
   */
  const setFilters = useCallback(
    (newFilters: FilterState) => {
      setFiltersState(newFilters)
      setPageState(1) // Reset pagination on filter change
      syncToUrl(newFilters, 1, viewMode)
    },
    [syncToUrl, viewMode]
  )

  /**
   * Set page and sync to URL
   */
  const setPage = useCallback(
    (newPage: number) => {
      setPageState(newPage)
      syncToUrl(filters, newPage, viewMode)
    },
    [filters, syncToUrl, viewMode]
  )

  /**
   * Set view mode and sync to URL
   */
  const setViewMode = useCallback(
    (newViewMode: ViewMode) => {
      setViewModeState(newViewMode)
      syncToUrl(filters, page, newViewMode)
    },
    [filters, page, syncToUrl]
  )

  /**
   * Update a single filter property
   */
  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters({ ...filters, [key]: value })
    },
    [filters, setFilters]
  )

  /**
   * Toggle a source in the sources array
   */
  const toggleSource = useCallback(
    (source: Source) => {
      const newSources = filters.sources.includes(source)
        ? filters.sources.filter((s) => s !== source)
        : [...filters.sources, source]
      setFilters({ ...filters, sources: newSources })
    },
    [filters, setFilters]
  )

  /**
   * Toggle a tag in the tags array
   */
  const toggleTag = useCallback(
    (tag: string) => {
      const newTags = filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag]
      setFilters({ ...filters, tags: newTags })
    },
    [filters, setFilters]
  )

  /**
   * Set date range
   */
  const setDateRange = useCallback(
    (from: string | null, to: string | null) => {
      setFilters({ ...filters, savedAfter: from, savedBefore: to })
    },
    [filters, setFilters]
  )

  /**
   * Set sort
   */
  const setSort = useCallback(
    (sortBy: SortByField, sortOrder: SortOrder) => {
      setFilters({ ...filters, sortBy, sortOrder })
    },
    [filters, setFilters]
  )

  /**
   * Set group by
   */
  const setGroupBy = useCallback(
    (groupBy: GroupByOption) => {
      setFilters({ ...filters, groupBy })
    },
    [filters, setFilters]
  )

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [setFilters])

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(
    () =>
      filters.search !== '' ||
      filters.sources.length > 0 ||
      filters.status !== null ||
      filters.tags.length > 0 ||
      filters.savedAfter !== null ||
      filters.savedBefore !== null,
    [filters]
  )

  /**
   * Count of active filters
   */
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    count += filters.sources.length
    if (filters.status) count++
    count += filters.tags.length
    if (filters.savedAfter || filters.savedBefore) count++
    return count
  }, [filters])

  return {
    filters,
    setFilters,
    updateFilter,
    toggleSource,
    toggleTag,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    page,
    setPage,
    viewMode,
    setViewMode,
    setDateRange,
    setSort,
    setGroupBy,
  }
}

export default useItemFilters
