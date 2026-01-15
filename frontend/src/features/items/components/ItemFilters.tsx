import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Filter, X, Inbox, Sparkles, Link2, Link2Off, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { SourceIcon } from '@/components/shared/SourceIcon'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { SortSelect } from '@/components/shared/SortSelect'
import { GroupBySelect, type GroupByOption } from '@/components/shared/GroupBySelect'
import { cn, formatNumber } from '@/lib/utils'
import type { Source, ItemStatus, FilterState, SortByField, SortOrder } from '@/types'
import { SOURCE_METADATA, STATUS_METADATA } from '@/types'

interface ItemFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  totalCount: number
  filteredCount: number
  /** Item counts per source for display, e.g., { youtube: 45, reddit: 355 } */
  sourceStats?: Partial<Record<Source, number>>
}

const ALL_SOURCES: Source[] = ['youtube', 'reddit', 'raindrop', 'instagram', 'facebook', 'telegram', 'manual']
const ALL_STATUSES: (ItemStatus | null)[] = [null, 'unprocessed', 'read', 'archived']

/**
 * ItemFilters component - Filter bar for items list
 * Features:
 * - Search input with 300ms debounce
 * - Source multi-select dropdown/buttons
 * - Status filter (All, Unprocessed, Read, Archived)
 * - Date range picker with presets
 * - Sort options
 * - Grouping options
 * - Quick filter chips: "Inbox" (unprocessed)
 * - Clear all filters button
 * - URL-synced filters via search params
 */
export function ItemFilters({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
  sourceStats = {},
}: ItemFiltersProps) {
  // Local search state for immediate UI feedback
  const [searchInput, setSearchInput] = useState(filters.search)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search handler - updates filters after 300ms
  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      debounceTimeoutRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value })
      }, 300)
    },
    [filters, onFiltersChange]
  )

  // Handle search input change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchInput(value)
      debouncedSearch(value)
    },
    [debouncedSearch]
  )

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    onFiltersChange({ ...filters, search: '' })
  }, [filters, onFiltersChange])

  // Toggle source filter
  const toggleSource = useCallback(
    (source: Source) => {
      const newSources = filters.sources.includes(source)
        ? filters.sources.filter((s) => s !== source)
        : [...filters.sources, source]
      onFiltersChange({ ...filters, sources: newSources })
    },
    [filters, onFiltersChange]
  )

  // Set status filter
  const setStatus = useCallback(
    (status: ItemStatus | null) => {
      onFiltersChange({ ...filters, status })
    },
    [filters, onFiltersChange]
  )

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (range: { from: Date; to: Date } | undefined) => {
      onFiltersChange({
        ...filters,
        savedAfter: range?.from ? range.from.toISOString() : null,
        savedBefore: range?.to ? range.to.toISOString() : null,
      })
    },
    [filters, onFiltersChange]
  )

  // Handle sort change
  const handleSortChange = useCallback(
    (sortBy: string, sortOrder: SortOrder) => {
      onFiltersChange({ ...filters, sortBy: sortBy as SortByField, sortOrder })
    },
    [filters, onFiltersChange]
  )

  // Handle group by change
  const handleGroupByChange = useCallback(
    (groupBy: GroupByOption) => {
      onFiltersChange({ ...filters, groupBy })
    },
    [filters, onFiltersChange]
  )

  // Quick filter: Inbox (unprocessed items)
  const handleInboxFilter = useCallback(() => {
    onFiltersChange({
      ...filters,
      status: filters.status === 'unprocessed' ? null : 'unprocessed',
      sources: [],
    })
  }, [filters, onFiltersChange])

  // Cycle link filter: all -> working -> broken -> all
  const handleLinkFilterCycle = useCallback(() => {
    const current = filters.linkFilter
    let next: 'all' | 'working' | 'broken' | null
    if (current === null || current === 'all') {
      next = 'working'  // Hide broken links
    } else if (current === 'working') {
      next = 'broken'   // Show only broken links
    } else {
      next = null       // Back to all
    }
    onFiltersChange({ ...filters, linkFilter: next })
  }, [filters, onFiltersChange])

  // Cycle NSFW filter: all -> safe -> nsfw -> all
  const handleNsfwFilterCycle = useCallback(() => {
    const current = filters.nsfwFilter
    let next: 'all' | 'safe' | 'nsfw' | null
    if (current === null || current === 'all') {
      next = 'safe'     // Hide NSFW content
    } else if (current === 'safe') {
      next = 'nsfw'     // Show only NSFW content
    } else {
      next = null       // Back to all
    }
    onFiltersChange({ ...filters, nsfwFilter: next })
  }, [filters, onFiltersChange])

  // Clear all filters
  const handleClearAll = useCallback(() => {
    setSearchInput('')
    onFiltersChange({
      sources: [],
      status: null,
      search: '',
      tags: [],
      sortBy: 'synced_at',  // Default to synced_at (always has value)
      sortOrder: 'desc',
      savedAfter: null,
      savedBefore: null,
      groupBy: 'none',
      groupYear: null,
      groupMonth: null,
      groupTag: null,
      groupDomain: null,
      groupSubreddit: null,
      linkFilter: null,
      nsfwFilter: null,
    })
  }, [onFiltersChange])

  // Check if any filters are active
  const hasActiveFilters =
    filters.search ||
    filters.sources.length > 0 ||
    filters.status !== null ||
    filters.tags.length > 0 ||
    filters.savedAfter !== null ||
    filters.savedBefore !== null ||
    (filters.linkFilter !== null && filters.linkFilter !== 'all') ||
    (filters.nsfwFilter !== null && filters.nsfwFilter !== 'all')

  // Sync local search with external filter changes
  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-border/60">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          {/* Row 1: Search + Quick Filters + Sort/Group */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search Input with debounce */}
            <div className="relative flex-1 max-w-md group">
              <Search
                className={cn(
                  "absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2",
                  "text-muted-foreground transition-colors duration-200",
                  "group-focus-within:text-primary"
                )}
              />
              <Input
                placeholder="Search items..."
                value={searchInput}
                onChange={handleSearchChange}
                className={cn(
                  "pl-10 pr-10 h-10",
                  "bg-muted/30 border-transparent",
                  "transition-all duration-200",
                  "focus:bg-background focus:border-border focus:ring-2 focus:ring-primary/20",
                  "hover:bg-muted/50"
                )}
              />
              {searchInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2",
                    "rounded-md",
                    "transition-all duration-200",
                    "hover:bg-destructive/10 hover:text-destructive"
                  )}
                  onClick={handleClearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-2">
              <Button
                variant={filters.status === 'unprocessed' ? 'default' : 'outline'}
                size="sm"
                onClick={handleInboxFilter}
                className={cn(
                  'h-9 px-4',
                  'transition-all duration-200 ease-out',
                  'hover:scale-[1.02]',
                  'active:scale-[0.98]',
                  filters.status === 'unprocessed'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25 border-amber-500'
                    : 'hover:border-amber-500/50 hover:bg-amber-500/5'
                )}
              >
                <Inbox className="mr-2 h-4 w-4" />
                Inbox
                {filters.status === 'unprocessed' && (
                  <span className="ml-2 px-1.5 py-0 text-xs font-mono font-bold rounded bg-white/20">
                    {filteredCount}
                  </span>
                )}
              </Button>

              {/* Link Filter Toggle */}
              <Button
                variant={filters.linkFilter && filters.linkFilter !== 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={handleLinkFilterCycle}
                title={
                  filters.linkFilter === 'working'
                    ? 'Hiding dead links (click for dead only)'
                    : filters.linkFilter === 'broken'
                    ? 'Showing dead links only (click for all)'
                    : 'Click to hide dead links'
                }
                className={cn(
                  'h-9 px-3',
                  'transition-all duration-200 ease-out',
                  'hover:scale-[1.02]',
                  'active:scale-[0.98]',
                  filters.linkFilter === 'working'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 border-emerald-500'
                    : filters.linkFilter === 'broken'
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 border-red-500'
                    : 'hover:border-muted-foreground/50'
                )}
              >
                {filters.linkFilter === 'working' ? (
                  <>
                    <Link2 className="mr-1.5 h-4 w-4" />
                    Working
                  </>
                ) : filters.linkFilter === 'broken' ? (
                  <>
                    <Link2Off className="mr-1.5 h-4 w-4" />
                    Dead Only
                  </>
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
              </Button>

              {/* NSFW Filter Toggle */}
              <Button
                variant={filters.nsfwFilter && filters.nsfwFilter !== 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={handleNsfwFilterCycle}
                title={
                  filters.nsfwFilter === 'safe'
                    ? 'Hiding NSFW content (click for NSFW only)'
                    : filters.nsfwFilter === 'nsfw'
                    ? 'Showing NSFW only (click for all)'
                    : 'Click to hide NSFW content'
                }
                className={cn(
                  'h-9 px-3',
                  'transition-all duration-200 ease-out',
                  'hover:scale-[1.02]',
                  'active:scale-[0.98]',
                  filters.nsfwFilter === 'safe'
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 border-blue-500'
                    : filters.nsfwFilter === 'nsfw'
                    ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/25 border-pink-500'
                    : 'hover:border-muted-foreground/50'
                )}
              >
                {filters.nsfwFilter === 'safe' ? (
                  <>
                    <Eye className="mr-1.5 h-4 w-4" />
                    SFW
                  </>
                ) : filters.nsfwFilter === 'nsfw' ? (
                  <>
                    <EyeOff className="mr-1.5 h-4 w-4" />
                    NSFW
                  </>
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8 hidden lg:block bg-border/60" />

            {/* Date Range Picker */}
            <DateRangePicker
              value={
                filters.savedAfter && filters.savedBefore
                  ? { from: new Date(filters.savedAfter), to: new Date(filters.savedBefore) }
                  : undefined
              }
              onChange={handleDateRangeChange}
            />

            <Separator orientation="vertical" className="h-8 hidden lg:block bg-border/60" />

            {/* Sort + Group By */}
            <div className="flex items-center gap-2">
              <SortSelect
                sortBy={filters.sortBy}
                sortOrder={filters.sortOrder}
                onChange={handleSortChange}
              />
              <GroupBySelect
                value={filters.groupBy}
                onValueChange={handleGroupByChange}
                className="w-[140px]"
              />
            </div>
          </div>

          {/* Row 2: Source + Status Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Source Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground mr-1 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Source:
              </span>
              {ALL_SOURCES.map((source) => {
                const isActive = filters.sources.includes(source)
                const count = sourceStats[source]
                return (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
                      'text-sm font-medium',
                      'transition-all duration-200 ease-out',
                      'hover:scale-[1.03]',
                      'active:scale-[0.97]',
                      isActive
                        ? cn(getSourceButtonClass(source), 'shadow-md')
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <SourceIcon source={source} size="sm" />
                    <span className="hidden sm:inline">
                      {SOURCE_METADATA[source].label}
                      {count !== undefined && (
                        <span className="ml-1 font-mono opacity-75">({formatNumber(count)})</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Status:</span>
              {ALL_STATUSES.map((status) => {
                const isActive = filters.status === status
                return (
                  <button
                    key={status ?? 'all'}
                    onClick={() => setStatus(status)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium',
                      'transition-all duration-200 ease-out',
                      'hover:scale-[1.03]',
                      'active:scale-[0.97]',
                      isActive && status
                        ? cn(getStatusButtonClass(status), 'shadow-md')
                        : isActive
                        ? 'bg-foreground text-background shadow-md'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {status ? STATUS_METADATA[status].label : 'All'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Row 3: Active Filters Summary + Clear */}
          {hasActiveFilters && (
            <div
              className={cn(
                "flex items-center justify-between border-t border-border/60 pt-4",
                "animate-in fade-in-50 slide-in-from-top-2 duration-200"
              )}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{formatNumber(filteredCount)}</span> of {formatNumber(totalCount)} items
                </span>
                {filters.search && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1 group/badge cursor-pointer",
                      "transition-all duration-200",
                      "hover:bg-destructive/10 hover:text-destructive"
                    )}
                    onClick={handleClearSearch}
                  >
                    Search: "{filters.search}"
                    <X className="h-3 w-3 transition-transform group-hover/badge:scale-110" />
                  </Badge>
                )}
                {filters.sources.map((source) => (
                  <Badge
                    key={source}
                    variant={source}
                    className={cn(
                      "gap-1 group/badge cursor-pointer",
                      "transition-all duration-200",
                      "hover:opacity-80"
                    )}
                    onClick={() => toggleSource(source)}
                  >
                    {SOURCE_METADATA[source].label}
                    <X className="h-3 w-3 transition-transform group-hover/badge:scale-110" />
                  </Badge>
                ))}
                {filters.status && (
                  <Badge
                    variant={filters.status}
                    className={cn(
                      "gap-1 group/badge cursor-pointer",
                      "transition-all duration-200",
                      "hover:opacity-80"
                    )}
                    onClick={() => setStatus(null)}
                  >
                    {STATUS_METADATA[filters.status].label}
                    <X className="h-3 w-3 transition-transform group-hover/badge:scale-110" />
                  </Badge>
                )}
                {(filters.savedAfter || filters.savedBefore) && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1 group/badge cursor-pointer",
                      "transition-all duration-200",
                      "hover:bg-destructive/10 hover:text-destructive"
                    )}
                    onClick={() => handleDateRangeChange(undefined)}
                  >
                    Date range
                    <X className="h-3 w-3 transition-transform group-hover/badge:scale-110" />
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className={cn(
                  "gap-1.5",
                  "text-muted-foreground",
                  "transition-all duration-200",
                  "hover:text-destructive hover:bg-destructive/10",
                  "active:scale-95"
                )}
              >
                <Sparkles className="h-4 w-4" />
                Clear All
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function to get source-specific button styling
function getSourceButtonClass(source: Source): string {
  const classes: Record<Source, string> = {
    youtube: 'bg-[#ff0000] hover:bg-[#cc0000] text-white',
    reddit: 'bg-[#ff4500] hover:bg-[#cc3700] text-white',
    instagram: 'bg-[#e1306c] hover:bg-[#b52657] text-white',
    raindrop: 'bg-[#0093e0] hover:bg-[#0076b3] text-white',
    facebook: 'bg-[#1877f2] hover:bg-[#1466d2] text-white',
    telegram: 'bg-[#26a5e4] hover:bg-[#1e8fc7] text-white',
    manual: 'bg-[#6366f1] hover:bg-[#4f52c4] text-white',
  }
  return classes[source]
}

// Helper function to get status-specific button styling
function getStatusButtonClass(status: ItemStatus): string {
  const classes: Record<ItemStatus, string> = {
    unprocessed: 'bg-amber-400 hover:bg-amber-500 text-black',
    read: 'bg-green-500 hover:bg-green-600 text-white',
    archived: 'bg-slate-400 hover:bg-slate-500 text-white',
  }
  return classes[status]
}

export default ItemFilters
