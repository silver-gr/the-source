import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  CheckCircle,
  Archive,
  RefreshCw,
  Inbox,
  ArrowRight,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SourceIcon, sourceColorClasses } from '@/components/shared/SourceIcon'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-client'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { SavedItem, Source } from '@/types'
import { SOURCE_METADATA } from '@/types'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

/**
 * Dashboard - Overview of saved items with ADHD-optimized design
 * Features:
 * - Stats cards: Total items, Unprocessed, By source
 * - Recent items preview (last 5 unprocessed)
 * - Quick action buttons: "Process Inbox", "Trigger Sync"
 * - Sync status overview
 */
function Dashboard() {
  const queryClient = useQueryClient()

  // Fetch sync status - poll while syncing
  const { data: syncStatus } = useQuery({
    queryKey: queryKeys.sync.status(),
    queryFn: async () => {
      const status = await api.sync.getStatus()
      console.log('[Sync] Status fetched:', status?.map(s => `${s.source}: ${s.status}`).join(', '))
      return status
    },
    refetchInterval: (query) => {
      // Poll every 3 seconds if any source is syncing/running
      const data = query.state.data
      const isSyncing = data?.some((s) => s.status === 'syncing')
      if (isSyncing) {
        console.log('[Sync] Polling active - sources syncing')
      }
      return isSyncing ? 3000 : false
    },
  })

  // Check if any sync is in progress
  const isSyncing = syncStatus?.some((s) => s.status === 'syncing')

  // Fetch items for stats - refresh while syncing
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: queryKeys.items.lists(),
    queryFn: async () => {
      const result = await api.items.getItems({ per_page: 100 })
      console.log(`[Items] Fetched ${result.items?.length ?? 0} items (total: ${result.total})`)
      return result
    },
    refetchInterval: isSyncing ? 5000 : false,
  })

  // Trigger sync mutation
  const triggerSync = useMutation({
    mutationFn: async () => {
      console.log('[Sync] Triggering sync for all sources...')
      return api.sync.triggerSyncAll()
    },
    onSuccess: (data) => {
      console.log('[Sync] Sync triggered successfully:', data)
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.status() })
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all })
    },
    onError: (error) => {
      console.error('[Sync] Sync failed:', error)
    },
  })

  const items = itemsData?.items ?? []
  const totalItems = itemsData?.total ?? 0

  // Calculate stats
  const unprocessedItems = items.filter((item) => !item.processed)
  const processedItems = items.filter((item) => item.processed)

  // Group items by source
  const sourceStats = items.reduce(
    (acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1
      return acc
    },
    {} as Record<Source, number>
  )

  // Recent unprocessed items (last 5)
  const recentUnprocessed = unprocessedItems.slice(0, 5)

  if (itemsLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Your saved items at a glance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => triggerSync.mutate()}
            disabled={triggerSync.isPending}
          >
            {triggerSync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Trigger Sync
          </Button>
          <Link to="/items" search={{ status: 'unprocessed' }}>
            <Button>
              <Inbox className="mr-2 h-4 w-4" />
              Process Inbox
              {unprocessedItems.length > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0">
                  {unprocessedItems.length}
                </Badge>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">
              Across all sources
            </p>
          </CardContent>
        </Card>

        {/* Unprocessed (Inbox) */}
        <Card className="border-l-4 border-l-amber-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inbox</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">
              {unprocessedItems.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Items to review
            </p>
          </CardContent>
        </Card>

        {/* Processed */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">
              {processedItems.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed items
            </p>
          </CardContent>
        </Card>

        {/* By Source */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">By Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sourceStats).map(([source, count]) => (
                <Badge key={source} variant={source as Source} className="gap-1">
                  <SourceIcon source={source as Source} size="sm" />
                  <span>{count}</span>
                </Badge>
              ))}
              {Object.keys(sourceStats).length === 0 && (
                <p className="text-xs text-muted-foreground">No items yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Unprocessed Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Inbox Items</CardTitle>
            <CardDescription>
              Latest items waiting for review
            </CardDescription>
          </div>
          <Link to="/items" search={{ status: 'unprocessed' }}>
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentUnprocessed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 rounded-full bg-green-100 p-3 dark:bg-green-900/20">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="mb-1 font-medium">Inbox Zero!</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                All caught up. Start by syncing your accounts or adding items manually.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentUnprocessed.map((item: SavedItem) => (
                <RecentItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Status */}
      {syncStatus && syncStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Status</CardTitle>
            <CardDescription>
              Connected sources and their sync status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {syncStatus.map((status) => (
                <div
                  key={status.source}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                    'hover:bg-accent/50'
                  )}
                >
                  <Badge variant={status.source} className="h-8 w-8 p-0 flex items-center justify-center">
                    <SourceIcon source={status.source} size="sm" />
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {SOURCE_METADATA[status.source].label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status.last_sync
                        ? formatRelativeTime(status.last_sync)
                        : 'Never synced'}
                    </p>
                  </div>
                  <SyncStatusIndicator status={status.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Recent Item Card - Compact item display for dashboard
 */
function RecentItemCard({ item }: { item: SavedItem }) {
  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="group"
    >
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border p-3 transition-all',
          'hover:bg-accent/50 hover:shadow-sm',
          sourceColorClasses[item.source]
        )}
      >
        {/* Thumbnail */}
        {item.thumbnail_url && !item.thumbnail_url.includes('no_thumbnail') ? (
          <img
            src={item.thumbnail_url}
            alt=""
            className="h-12 w-16 rounded object-cover flex-shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="flex h-12 w-16 items-center justify-center rounded bg-muted flex-shrink-0">
            <SourceIcon source={item.source} className="text-muted-foreground" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={item.source} className="text-xs px-1.5 py-0">
              {SOURCE_METADATA[item.source].label}
            </Badge>
            <Badge variant="unprocessed" className="text-xs px-1.5 py-0">
              New
            </Badge>
          </div>
          <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {item.title}
          </h4>
          <p className="text-xs text-muted-foreground">
            {formatRelativeTime(item.created_at)}
          </p>
        </div>

        {/* External link indicator */}
        {item.url && (
          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}
      </div>
    </Link>
  )
}

/**
 * Sync Status Indicator
 */
function SyncStatusIndicator({ status }: { status: string | undefined }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    idle: {
      color: 'bg-green-500',
      label: 'Synced',
    },
    completed: {
      color: 'bg-green-500',
      label: 'Synced',
    },
    running: {
      color: 'bg-blue-500 animate-pulse',
      label: 'Syncing',
    },
    syncing: {
      color: 'bg-blue-500 animate-pulse',
      label: 'Syncing',
    },
    failed: {
      color: 'bg-red-500',
      label: 'Error',
    },
    error: {
      color: 'bg-red-500',
      label: 'Error',
    },
  }

  const config = statusConfig[status ?? 'idle'] ?? { color: 'bg-gray-400', label: 'Unknown' }

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('h-2 w-2 rounded-full', config.color)} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  )
}

/**
 * Dashboard loading skeleton
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="mt-2 h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded bg-muted animate-pulse" />
          <div className="h-10 w-36 rounded bg-muted animate-pulse" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 rounded bg-muted" />
              <div className="mt-1 h-3 w-20 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 rounded-lg border p-3">
              <div className="h-12 w-16 rounded bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
