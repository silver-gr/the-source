import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { ChevronRight, ChevronsUpDown, ChevronsDownUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SourceIcon } from '@/components/shared/SourceIcon'
import { DateGroupNavigator } from '@/components/shared/DateGroupNavigator'
import { TagGroupSelector } from '@/components/shared/TagGroupSelector'
import { WebsiteGroupSidebar } from '@/components/shared/WebsiteGroupSidebar'
import type { SavedItem, Source } from '@/types'
import type { GroupByOption } from '@/components/shared/GroupBySelect'

interface GroupedItemsViewProps {
  groupBy: GroupByOption
  items: SavedItem[]
  totalItems?: number

  // For date grouping (required when groupBy === 'date')
  selectedYear?: number | null
  selectedMonth?: number | null
  availableYears?: number[]
  availableMonths?: number[]
  onYearChange?: (year: number) => void
  onMonthChange?: (month: number | null) => void

  // For tag grouping (required when groupBy === 'tags')
  tagsWithCounts?: Array<{ tag: string; count: number }>
  selectedTag?: string | null
  onTagSelect?: (tag: string | null) => void

  // For website grouping (required when groupBy === 'website')
  domainsWithCounts?: Array<{ domain: string; count: number }>
  selectedDomain?: string | null
  onDomainSelect?: (domain: string | null) => void

  // Common
  renderItem: (item: SavedItem) => ReactNode
  isLoading?: boolean
  className?: string
}

interface SourceGroup {
  key: Source
  label: string
  items: SavedItem[]
}

const SOURCE_ORDER: Source[] = ['youtube', 'reddit', 'instagram', 'raindrop', 'facebook', 'telegram', 'manual']
const SOURCE_LABELS: Record<Source, string> = {
  youtube: 'YouTube',
  reddit: 'Reddit',
  instagram: 'Instagram',
  raindrop: 'Raindrop',
  facebook: 'Facebook',
  telegram: 'Telegram',
  manual: 'Manual',
}

/**
 * Groups items by source platform
 */
function groupItemsBySource(items: SavedItem[]): SourceGroup[] {
  const groups: Record<Source, SavedItem[]> = {
    youtube: [],
    reddit: [],
    instagram: [],
    raindrop: [],
    facebook: [],
    telegram: [],
    manual: [],
  }

  items.forEach((item) => {
    groups[item.source].push(item)
  })

  return SOURCE_ORDER
    .filter((source) => groups[source].length > 0)
    .map((source) => ({
      key: source,
      label: SOURCE_LABELS[source],
      items: groups[source],
    }))
}

/**
 * Loading skeleton for item lists
 */
function ItemListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <Skeleton className="h-10 w-10 rounded shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Source grouped view with collapsible sections
 */
function SourceGroupedView({
  items,
  renderItem,
  isLoading,
}: {
  items: SavedItem[]
  renderItem: (item: SavedItem) => ReactNode
  isLoading?: boolean
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<Source>>(new Set())

  const groups = useMemo(() => groupItemsBySource(items), [items])

  const toggleGroup = useCallback((source: Source) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setCollapsedGroups(new Set())
  }, [])

  const collapseAll = useCallback(() => {
    setCollapsedGroups(new Set(groups.map((g) => g.key)))
  }, [groups])

  if (isLoading) {
    return <ItemListSkeleton count={8} />
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No items to display
      </div>
    )
  }

  const allCollapsed = collapsedGroups.size === groups.length
  const allExpanded = collapsedGroups.size === 0

  return (
    <div className="space-y-4">
      {/* Expand/Collapse All Controls */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {groups.length} {groups.length === 1 ? 'source' : 'sources'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            disabled={allExpanded}
            className={cn(
              'h-7 text-xs gap-1.5',
              'transition-all duration-200',
              'hover:bg-accent',
              'disabled:opacity-40'
            )}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            disabled={allCollapsed}
            className={cn(
              'h-7 text-xs gap-1.5',
              'transition-all duration-200',
              'hover:bg-accent',
              'disabled:opacity-40'
            )}
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            Collapse All
          </Button>
        </div>
      </div>

      {/* Source Groups */}
      <div className="space-y-3">
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.key)

          return (
            <div
              key={group.key}
              className={cn(
                'border rounded-lg overflow-hidden bg-card',
                'transition-all duration-200 ease-out',
                'hover:shadow-md hover:border-primary/20',
                !isCollapsed && 'shadow-sm'
              )}
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3',
                  'bg-muted/50 transition-all duration-200',
                  'hover:bg-muted',
                  'text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                  'group'
                )}
              >
                <div
                  className={cn(
                    'transition-transform duration-200 ease-out',
                    isCollapsed ? 'rotate-0' : 'rotate-90'
                  )}
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>

                <span className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                  <SourceIcon source={group.key} size="sm" />
                </span>

                <span className="font-medium flex-1 transition-colors group-hover:text-primary">
                  {group.label}
                </span>

                <Badge
                  variant="secondary"
                  className={cn(
                    'ml-auto transition-all duration-200',
                    'group-hover:bg-primary group-hover:text-primary-foreground'
                  )}
                >
                  {group.items.length.toLocaleString()}
                </Badge>
              </button>

              {/* Group Content with animation */}
              <div
                className={cn(
                  'grid transition-all duration-300 ease-out',
                  isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                )}
              >
                <div className="overflow-hidden">
                  <div className="p-4 space-y-1">
                    {group.items.map(renderItem)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * GroupedItemsView component - Unified grouping interface
 *
 * Supports different grouping modes:
 * - source: Collapsible sections by platform (YouTube, Reddit, etc.)
 * - date: DateGroupNavigator for year/month filtering via API
 * - tags: TagGroupSelector pills for tag filtering via API
 * - website: WebsiteGroupSidebar for domain filtering via API
 * - none: Flat list without grouping
 */
export function GroupedItemsView({
  groupBy,
  items,
  totalItems,
  // Date grouping props
  selectedYear,
  selectedMonth,
  availableYears,
  availableMonths,
  onYearChange,
  onMonthChange,
  // Tag grouping props
  tagsWithCounts,
  selectedTag,
  onTagSelect,
  // Website grouping props
  domainsWithCounts,
  selectedDomain,
  onDomainSelect,
  // Common props
  renderItem,
  isLoading,
  className,
}: GroupedItemsViewProps) {
  // Loading state with spinner
  const renderLoadingOverlay = () => {
    if (!isLoading) return null
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Empty state
  const renderEmptyState = () => {
    if (isLoading || items.length > 0) return null
    return (
      <div className="text-center py-12 text-muted-foreground">
        No items found
      </div>
    )
  }

  // Item list renderer
  const renderItemList = () => {
    if (isLoading) return <ItemListSkeleton />
    if (items.length === 0) return renderEmptyState()
    return <div className="space-y-1">{items.map(renderItem)}</div>
  }

  // Source grouping - collapsible sections (works with pre-filtered items)
  if (groupBy === 'source') {
    return (
      <div className={className}>
        <SourceGroupedView items={items} renderItem={renderItem} isLoading={isLoading} />
      </div>
    )
  }

  // Date grouping - navigator + flat list
  if (groupBy === 'date') {
    return (
      <div className={cn('space-y-4', className)}>
        <DateGroupNavigator
          selectedYear={selectedYear ?? new Date().getFullYear()}
          selectedMonth={selectedMonth ?? null}
          availableYears={availableYears ?? []}
          availableMonths={availableMonths ?? []}
          onYearChange={onYearChange ?? (() => {})}
          onMonthChange={onMonthChange ?? (() => {})}
        />
        {renderLoadingOverlay()}
        {renderItemList()}
      </div>
    )
  }

  // Tags grouping - pill selector + flat list
  if (groupBy === 'tags') {
    return (
      <div className={cn('space-y-4', className)}>
        <TagGroupSelector
          tags={tagsWithCounts ?? []}
          selectedTag={selectedTag ?? null}
          onTagSelect={onTagSelect ?? (() => {})}
          totalItems={totalItems ?? items.length}
        />
        {renderLoadingOverlay()}
        {renderItemList()}
      </div>
    )
  }

  // Website grouping - sidebar + main content
  if (groupBy === 'website') {
    return (
      <div className={cn('flex gap-4', className)}>
        <WebsiteGroupSidebar
          domains={domainsWithCounts ?? []}
          selectedDomain={selectedDomain ?? null}
          onDomainSelect={onDomainSelect ?? (() => {})}
        />
        <div className="flex-1">
          {renderLoadingOverlay()}
          {renderItemList()}
        </div>
      </div>
    )
  }

  // 'none' - flat list without grouping
  return (
    <div className={className}>
      {renderLoadingOverlay()}
      {renderItemList()}
    </div>
  )
}

export default GroupedItemsView
