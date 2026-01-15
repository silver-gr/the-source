import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useMemo } from 'react'
import { Plus, LayoutGrid, List, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemFilters, ItemGrid, ItemListView, BulkActions, GroupedItemsView } from '@/features/items/components'
import { ListItemRow } from '@/components/shared/ListItemRow'
import { ItemDetailModal } from '@/components/shared/ItemDetailModal'
import { AddItemDialog } from '@/components/shared/AddItemDialog'
import { useItems, useItemMutations, useItemFilters, useTagsWithCounts, useDomainsWithCounts, useSubredditsWithCounts, useItemStats, computeAvailableYears, getAllMonths } from '@/features/items/hooks'
import { usePreferences } from '@/hooks/usePreferences'
import { PaginationNav } from '@/components/shared/PaginationNav'
import { cn, formatNumber } from '@/lib/utils'
import type { FilterState, ViewMode, SavedItem } from '@/types'

export const Route = createFileRoute('/items/')({
  component: ItemsPage,
})

const PER_PAGE_GRID = 100
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

  // Fetch subreddits when grouping by subreddit
  const { data: subredditsData } = useSubredditsWithCounts({
    enabled: filters.groupBy === 'subreddit',
  })

  // Fetch item stats for source counts
  const { data: statsData } = useItemStats()

  // Compute available years for date grouping
  const availableYears = useMemo(() => computeAvailableYears(2020), [])
  const availableMonths = useMemo(() => getAllMonths(), [])

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modal state
  const [detailModalItem, setDetailModalItem] = useState<SavedItem | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // Item data
  const items = data?.items ?? []
  const totalCount = data?.total ?? 0
  const hasMore = data?.has_next ?? false
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

  // Modal handlers
  const handleInfoClick = useCallback((item: SavedItem) => {
    setDetailModalItem(item)
    setIsDetailModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setIsDetailModalOpen(false)
    // Delay clearing item to allow modal close animation
    setTimeout(() => setDetailModalItem(null), 200)
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
      // Auto-set groupYear to current year when switching to date grouping
      if (newFilters.groupBy === 'date' && newFilters.groupYear == null) {
        newFilters = { ...newFilters, groupYear: new Date().getFullYear() }
      }
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

  // Subreddit grouping handler
  const handleSubredditSelect = useCallback(
    (subreddit: string | null) => {
      setFilters({ ...filters, groupSubreddit: subreddit })
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
      onInfoClick={handleInfoClick}
      formatDate={formatCompactDate}
      index={0}
    />
  ), [selectedIds, handleSelect, handleInfoClick, formatCompactDate])

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bookmark className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Saved Items
            </h1>
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            <span className="font-mono text-foreground font-semibold">
              {formatNumber(totalCount)}
            </span>
            <span>{totalCount === 1 ? 'item' : 'items'} total</span>
            {totalPages > 1 && (
              <>
                <span className="text-border">·</span>
                <span>
                  Page <span className="font-mono font-medium">{page}</span> of{' '}
                  <span className="font-mono font-medium">{formatNumber(totalPages)}</span>
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div
            className={cn(
              'flex rounded-lg border bg-muted/50 p-1',
              'shadow-sm'
            )}
          >
            <button
              onClick={() => handleViewModeChange('grid')}
              className={cn(
                'flex items-center justify-center rounded-md px-3 py-1.5',
                'transition-all duration-200',
                effectiveViewMode === 'grid'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={cn(
                'flex items-center justify-center rounded-md px-3 py-1.5',
                'transition-all duration-200',
                effectiveViewMode === 'list'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="List view (150 items)"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className={cn(
              'transition-all duration-200',
              'hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02]',
              'active:scale-[0.98]'
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </header>

      {/* Filters */}
      <ItemFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalCount={totalCount}
        filteredCount={items.length}
        sourceStats={statsData?.items_by_source}
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
          // Subreddit grouping props
          subredditsWithCounts={subredditsData?.subreddits}
          selectedSubreddit={filters.groupSubreddit}
          onSubredditSelect={handleSubredditSelect}
        />
      ) : effectiveViewMode === 'grid' ? (
        // Grid View
        <ItemGrid
          items={items}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onInfoClick={handleInfoClick}
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
          onInfoClick={handleInfoClick}
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

      {/* Item Detail Modal */}
      <ItemDetailModal
        item={detailModalItem}
        open={isDetailModalOpen}
        onOpenChange={handleModalClose}
        onMarkRead={handleMarkRead}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />

      {/* Add Item Dialog */}
      <AddItemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </div>
  )
}

export default ItemsPage
