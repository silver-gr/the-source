import { useCallback, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ItemCard } from './ItemCard'
import { cn } from '@/lib/utils'
import type { SavedItem } from '@/types'

interface ItemGridProps {
  items: SavedItem[]
  selectedIds: Set<string>
  onSelect: (id: string, selected: boolean) => void
  onSelectAll: () => void
  onMarkRead: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}

/**
 * ItemGrid component - Responsive grid layout for items
 * Features:
 * - Responsive grid (1-4 columns based on screen size)
 * - Uses ItemCard for each item
 * - Selection state management
 * - Load More button for pagination
 * - Loading skeleton states
 */
export function ItemGrid({
  items,
  selectedIds,
  onSelect,
  onSelectAll,
  onMarkRead,
  onArchive,
  onDelete,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
}: ItemGridProps) {
  // Handle select all toggle
  const allSelected = useMemo(
    () => items.length > 0 && items.every((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  )

  const handleSelectAllToggle = useCallback(() => {
    onSelectAll()
  }, [onSelectAll])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Select All header skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
        {/* Grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 rounded-full bg-muted p-4">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
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
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleSelectAllToggle}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {allSelected ? 'Deselect all' : 'Select all'} ({items.length} items)
          </span>
        </label>

        {selectedIds.size > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} of {items.length} selected
          </span>
        )}
      </div>

      {/* Items Grid - Responsive 1-4 columns */}
      <div
        className={cn(
          'grid gap-4',
          'grid-cols-1',
          'sm:grid-cols-2',
          'lg:grid-cols-3',
          'xl:grid-cols-4'
        )}
      >
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onSelect={onSelect}
            onMarkRead={onMarkRead}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="min-w-[200px]"
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

/**
 * Skeleton component for loading state
 */
function ItemCardSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="aspect-video bg-muted" />
      {/* Content skeleton */}
      <CardContent className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-12 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  )
}

export default ItemGrid
