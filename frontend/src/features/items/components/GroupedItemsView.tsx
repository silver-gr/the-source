import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { ChevronRight, Calendar, Clock, Tag, Globe, ChevronsUpDown, ChevronsDownUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SourceIcon } from '@/components/shared/SourceIcon'
import type { SavedItem, Source } from '@/types'
import type { GroupByOption } from '@/components/shared/GroupBySelect'

interface GroupedItemsViewProps {
  items: SavedItem[]
  groupBy: GroupByOption
  renderItem: (item: SavedItem) => ReactNode
  className?: string
}

interface ItemGroup {
  key: string
  label: string
  icon: ReactNode
  items: SavedItem[]
}

/**
 * Groups items by date into logical buckets
 */
function groupByDate(items: SavedItem[]): ItemGroup[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const groups: Record<string, SavedItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  }

  items.forEach((item) => {
    const date = new Date(item.created_at)
    if (date >= today) {
      groups.today.push(item)
    } else if (date >= yesterday) {
      groups.yesterday.push(item)
    } else if (date >= thisWeek) {
      groups.thisWeek.push(item)
    } else if (date >= thisMonth) {
      groups.thisMonth.push(item)
    } else {
      groups.older.push(item)
    }
  })

  const result: ItemGroup[] = []

  if (groups.today.length > 0) {
    result.push({
      key: 'today',
      label: 'Today',
      icon: <Clock className="h-4 w-4" />,
      items: groups.today,
    })
  }
  if (groups.yesterday.length > 0) {
    result.push({
      key: 'yesterday',
      label: 'Yesterday',
      icon: <Clock className="h-4 w-4" />,
      items: groups.yesterday,
    })
  }
  if (groups.thisWeek.length > 0) {
    result.push({
      key: 'thisWeek',
      label: 'This Week',
      icon: <Calendar className="h-4 w-4" />,
      items: groups.thisWeek,
    })
  }
  if (groups.thisMonth.length > 0) {
    result.push({
      key: 'thisMonth',
      label: 'This Month',
      icon: <Calendar className="h-4 w-4" />,
      items: groups.thisMonth,
    })
  }
  if (groups.older.length > 0) {
    result.push({
      key: 'older',
      label: 'Older',
      icon: <Calendar className="h-4 w-4" />,
      items: groups.older,
    })
  }

  return result
}

/**
 * Groups items by source platform
 */
function groupBySource(items: SavedItem[]): ItemGroup[] {
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

  const sourceOrder: Source[] = ['youtube', 'reddit', 'instagram', 'raindrop', 'facebook', 'telegram', 'manual']
  const sourceLabels: Record<Source, string> = {
    youtube: 'YouTube',
    reddit: 'Reddit',
    instagram: 'Instagram',
    raindrop: 'Raindrop',
    facebook: 'Facebook',
    telegram: 'Telegram',
    manual: 'Manual',
  }

  return sourceOrder
    .filter((source) => groups[source].length > 0)
    .map((source) => ({
      key: source,
      label: sourceLabels[source],
      icon: <SourceIcon source={source} size="sm" />,
      items: groups[source],
    }))
}

/**
 * Groups items by their first tag
 */
function groupByTags(items: SavedItem[]): ItemGroup[] {
  const groups: Record<string, SavedItem[]> = { untagged: [] }

  items.forEach((item) => {
    if (item.tags && item.tags.length > 0) {
      const firstTag = item.tags[0]
      if (!groups[firstTag]) {
        groups[firstTag] = []
      }
      groups[firstTag].push(item)
    } else {
      groups.untagged.push(item)
    }
  })

  const result: ItemGroup[] = []

  // Sort tags alphabetically, but put untagged at the end
  const tagKeys = Object.keys(groups).filter((k) => k !== 'untagged').sort()

  tagKeys.forEach((tag) => {
    result.push({
      key: tag,
      label: tag,
      icon: <Tag className="h-4 w-4" />,
      items: groups[tag],
    })
  })

  if (groups.untagged.length > 0) {
    result.push({
      key: 'untagged',
      label: 'Untagged',
      icon: <Tag className="h-4 w-4 text-muted-foreground" />,
      items: groups.untagged,
    })
  }

  return result
}

/**
 * GroupedItemsView component - Displays items in collapsible groups
 * Supports grouping by date, source, or tags
 */
export function GroupedItemsView({
  items,
  groupBy,
  renderItem,
  className,
}: GroupedItemsViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    switch (groupBy) {
      case 'date':
        return groupByDate(items)
      case 'source':
        return groupBySource(items)
      case 'tags':
        return groupByTags(items)
      case 'none':
      default:
        return [
          {
            key: 'all',
            label: 'All Items',
            icon: <Globe className="h-4 w-4" />,
            items,
          },
        ]
    }
  }, [items, groupBy])

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
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

  // If groupBy is 'none', render items directly without group headers
  if (groupBy === 'none') {
    return <div className={className}>{items.map(renderItem)}</div>
  }

  const allCollapsed = collapsedGroups.size === groups.length
  const allExpanded = collapsedGroups.size === 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Expand/Collapse All Controls */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {groups.length} {groups.length === 1 ? 'group' : 'groups'}
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

      {/* Groups */}
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
                  {group.icon}
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
                  {group.items.length}
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
                  <div className="p-4">
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

export default GroupedItemsView
