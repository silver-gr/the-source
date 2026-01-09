import { useCallback, useMemo } from 'react'
import { Loader2, Inbox, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ListItemRow } from '@/components/shared/ListItemRow'
import { cn } from '@/lib/utils'
import type { SavedItem } from '@/types'

interface ItemListViewProps {
  items: SavedItem[]
  selectedIds: Set<string>
  onSelect: (id: string, selected: boolean) => void
  onSelectAll: () => void
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}

/**
 * ItemListView component - Compact multi-column list for high-density viewing
 * Optimized for Raindrop bookmarks with 100-200 items per page
 * Features:
 * - 2-3 column responsive grid
 * - Compact rows with essential info only
 * - Bookmarked date prominently displayed
 * - Checkbox for bulk selection
 */
export function ItemListView({
  items,
  selectedIds,
  onSelect,
  onSelectAll,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
}: ItemListViewProps) {
  // Handle select all toggle
  const allSelected = useMemo(
    () => items.length > 0 && items.every((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  )

  const handleSelectAllToggle = useCallback(() => {
    onSelectAll()
  }, [onSelectAll])

  // Format date for compact display
  const formatCompactDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
        <Card className="max-h-[80vh] overflow-hidden">
          <CardContent className="p-4 max-h-[78vh] overflow-y-auto">
            <div className="grid gap-1 md:grid-cols-2">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded animate-pulse"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <div className="h-4 w-4 rounded bg-muted" />
                  <div className="h-4 w-4 rounded bg-muted" />
                  <div className="h-4 flex-1 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div
            className={cn(
              "mb-4 rounded-full p-4",
              "bg-gradient-to-br from-muted to-muted/50",
              "ring-1 ring-border"
            )}
          >
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-medium">No items found</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Try adjusting your filters or add some items to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Select All Header */}
      <div className="flex items-center justify-between">
        <label
          className={cn(
            "flex items-center gap-3 cursor-pointer group",
            "select-none"
          )}
        >
          <div
            className={cn(
              "relative flex h-4 w-4 items-center justify-center",
              "rounded border-2 border-muted-foreground/40",
              "transition-all duration-200",
              "group-hover:border-primary group-hover:scale-110",
              allSelected && "bg-primary border-primary"
            )}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAllToggle}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {allSelected && (
              <Check className="h-3 w-3 text-primary-foreground" />
            )}
          </div>
          <span
            className={cn(
              "text-sm text-muted-foreground",
              "transition-colors duration-200",
              "group-hover:text-foreground"
            )}
          >
            {allSelected ? 'Deselect all' : 'Select all'} ({items.length} items)
          </span>
        </label>

        {selectedIds.size > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "animate-in fade-in-50 zoom-in-95 duration-200",
              "bg-primary/10 text-primary"
            )}
          >
            {selectedIds.size} of {items.length} selected
          </Badge>
        )}
      </div>

      {/* Compact List View - 2 columns for more title visibility */}
      <Card className="max-h-[80vh] overflow-hidden transition-shadow hover:shadow-md">
        <CardContent className="p-4 max-h-[78vh] overflow-y-auto">
          <div className="grid gap-1 md:grid-cols-2">
            {items.map((item, index) => (
              <ListItemRow
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onSelect={onSelect}
                formatDate={formatCompactDate}
                index={index}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className={cn(
              "min-w-[200px]",
              "transition-all duration-200 ease-out",
              "hover:scale-105 hover:shadow-md",
              "active:scale-95",
              "disabled:hover:scale-100"
            )}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default ItemListView
