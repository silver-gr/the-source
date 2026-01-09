import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useMemo } from 'react'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemFilters, ItemGrid, ItemListView, BulkActions, GroupedItemsView } from '@/features/items/components'
import { ListItemRow } from '@/components/shared/ListItemRow'
import { useItems, useItemMutations, useItemFilters, useTagsWithCounts, useDomainsWithCounts, computeAvailableYears, getAllMonths } from '@/features/items/hooks'
import { usePreferences } from '@/hooks/usePreferences'
import { PaginationNav } from '@/components/shared/PaginationNav'
import { cn } from '@/lib/utils'
import type { FilterState, ViewMode, SavedItem } from '@/types'

export const Route = createFileRoute('/items/')({
  component: ItemsPage,
})

const PER_PAGE_GRID = 20
const PER_PAGE_LIST = 150

/**
 * ItemsPage - Main items listing page with ADHD-optimized UI
 * Features:
 * - Filterable item grid with search, source, and status filters
 * - Pagination with browser back/forward support
 * - Grid and list view modes
 * - Grouping by date, source, or tags
 * - Bulk selection and actions
 * - Responsive grid layout
 * - URL-synced filters for shareable links
 */
function ItemsPage() {
  // User preferences for default view
  const { preferences, setDefaultView } = usePreferences()

  // Filter state with URL sync
  const {
    filters,
    setFilters,
    page,
    setPage,
    viewMode: urlViewMode,
    setViewMode: setUrlViewMode,
  } = useItemFilters({ syncWithUrl: true })

  // Effective view mode: URL takes priority, then preferences
  const effectiveViewMode: ViewMode = urlViewMode ?? preferences.defaultView

  // Per page based on view mode
  const perPage = effectiveViewMode === 'list' ? PER_PAGE_LIST : PER_PAGE_GRID

  // Handle view mode change - update URL and save preference
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setUrlViewMode(mode)
    setDefaultView(mode) // Save to localStorage for next time
    setPage(1)
  }, [setPage, setUrlViewMode, setDefaultView])

  // Fetch items with current filters
  const { data, isLoading, isFetching } = useItems({
    filters,
    page,
    perPage,
  })

  // Item mutations
  const {
    markAsRead,
    archiveItem,
    deleteItem,
    bulkMarkAsRead,
    bulkArchive,
    bulkDelete,
    isLoading: isMutating,
  } = useItemMutations()

  // Fetch tags when grouping by tags
  const { data: tagsData } = useTagsWithCounts({
    enabled: filters.groupBy === 'tags',
  })

  // Fetch domains when grouping by website
  const { data: domainsData } = useDomainsWithCounts({
    enabled: filters.groupBy === 'website',
  })

  // Compute available years for date grouping
  const availableYears = useMemo(() => computeAvailableYears(2020), [])
  const availableMonths = useMemo(() => getAllMonths(), [])

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Item data
  const items = data?.items ?? []
  const totalCount = data?.total ?? 0
  const hasMore = data?.has_more ?? false
  const totalPages = Math.ceil(totalCount / perPage)

  // Selection handlers
  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (items.every((item) => selectedIds.has(item.id))) {
      // All selected, deselect all
      setSelectedIds(new Set())
    } else {
      // Select all visible items
      setSelectedIds(new Set(items.map((item) => item.id)))
    }
  }, [items, selectedIds])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Single item actions
  const handleMarkRead = useCallback(
    (id: string) => {
      markAsRead.mutate(id)
    },
    [markAsRead]
  )

  const handleArchive = useCallback(
    (id: string) => {
      archiveItem.mutate(id)
    },
    [archiveItem]
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteItem.mutate(id, {
        onSuccess: () => {
          // Remove from selection if deleted
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
      })
    },
    [deleteItem]
  )

  // Bulk actions
  const handleBulkMarkRead = useCallback(
    (ids: string[]) => {
      bulkMarkAsRead.mutate(ids, {
        onSuccess: () => {
          handleClearSelection()
        },
      })
    },
    [bulkMarkAsRead, handleClearSelection]
  )

  const handleBulkArchive = useCallback(
    (ids: string[]) => {
      bulkArchive.mutate(ids, {
        onSuccess: () => {
          handleClearSelection()
        },
      })
    },
    [bulkArchive, handleClearSelection]
  )

  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      bulkDelete.mutate(ids, {
        onSuccess: () => {
          handleClearSelection()
        },
      })
    },
    [bulkDelete, handleClearSelection]
  )

  // Pagination handler
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    handleClearSelection() // Clear selection on page change
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [setPage, handleClearSelection])

  // Load more (for "Load More" button if needed)
  const handleLoadMore = useCallback(() => {
    setPage(page + 1)
  }, [setPage, page])

  // Filter change handler
  const handleFiltersChange = useCallback(
    (newFilters: FilterState) => {
      setFilters(newFilters)
      handleClearSelection() // Clear selection on filter change
    },
    [setFilters, handleClearSelection]
  )

  // Date grouping handlers
  const handleYearChange = useCallback(
    (year: number) => {
      setFilters({ ...filters, groupYear: year, groupMonth: null })
      handleClearSelection()
    },
    [filters, setFilters, handleClearSelection]
  )

  const handleMonthChange = useCallback(
    (month: number | null) => {
      setFilters({ ...filters, groupMonth: month })
      handleClearSelection()
    },
    [filters, setFilters, handleClearSelection]
  )

  // Tag grouping handler
  const handleTagSelect = useCallback(
    (tag: string | null) => {
      setFilters({ ...filters, groupTag: tag })
      handleClearSelection()
    },
    [filters, setFilters, handleClearSelection]
  )

  // Website/domain grouping handler
  const handleDomainSelect = useCallback(
    (domain: string | null) => {
      setFilters({ ...filters, groupDomain: domain })
      handleClearSelection()
    },
    [filters, setFilters, handleClearSelection]
  )

  // Format date for compact list display
  const formatCompactDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }, [])

  // Render item for grouped view - use compact ListItemRow for better density
  const renderItem = useCallback((item: SavedItem) => (
    <ListItemRow
      key={item.id}
      item={item}
      isSelected={selectedIds.has(item.id)}
      onSelect={handleSelect}
      formatDate={formatCompactDate}
      index={0}
    />
  ), [selectedIds, handleSelect, formatCompactDate])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saved Items</h1>
          <p className="text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'item' : 'items'} total
            {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-md border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewModeChange('grid')}
              className={cn(
                'rounded-r-none',
                effectiveViewMode === 'grid' && 'bg-accent'
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewModeChange('list')}
              className={cn(
                'rounded-l-none',
                effectiveViewMode === 'list' && 'bg-accent'
              )}
              title="List view (150 items)"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ItemFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalCount={totalCount}
        filteredCount={items.length}
      />

      {/* Top Pagination Navigation */}
      {totalPages > 1 && (
        <PaginationNav
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}

      {/* Items View */}
      {filters.groupBy !== 'none' ? (
        // Grouped View
        <GroupedItemsView
          items={items}
          groupBy={filters.groupBy}
          totalItems={totalCount}
          renderItem={renderItem}
          isLoading={isLoading}
          // Date grouping props
          selectedYear={filters.groupYear}
          selectedMonth={filters.groupMonth}
          availableYears={availableYears}
          availableMonths={availableMonths}
          onYearChange={handleYearChange}
          onMonthChange={handleMonthChange}
          // Tag grouping props
          tagsWithCounts={tagsData?.tags}
          selectedTag={filters.groupTag}
          onTagSelect={handleTagSelect}
          // Website/domain grouping props
          domainsWithCounts={domainsData?.domains}
          selectedDomain={filters.groupDomain}
          onDomainSelect={handleDomainSelect}
        />
      ) : effectiveViewMode === 'grid' ? (
        // Grid View
        <ItemGrid
          items={items}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onMarkRead={handleMarkRead}
          onArchive={handleArchive}
          onDelete={handleDelete}
          hasMore={hasMore}
          isLoading={isLoading}
          isLoadingMore={isFetching && page > 1}
          onLoadMore={handleLoadMore}
        />
      ) : (
        // List View
        <ItemListView
          items={items}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          hasMore={hasMore}
          isLoading={isLoading}
          isLoadingMore={isFetching && page > 1}
          onLoadMore={handleLoadMore}
        />
      )}

      {/* Pagination Navigation */}
      {totalPages > 1 && (
        <PaginationNav
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}

      {/* Bulk Actions Floating Bar */}
      <BulkActions
        selectedIds={selectedIds}
        onMarkRead={handleBulkMarkRead}
        onArchive={handleBulkArchive}
        onDelete={handleBulkDelete}
        onClearSelection={handleClearSelection}
        isLoading={isMutating}
      />
    </div>
  )
}

export default ItemsPage
