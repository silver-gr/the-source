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
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SourceIcon, sourceColorClasses } from '@/components/shared/SourceIcon'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-client'
import { formatRelativeTime, cn, formatNumber } from '@/lib/utils'
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
      return status
    },
    refetchInterval: (query) => {
      const data = query.state.data
      const isSyncing = data?.some((s) => s.status === 'syncing')
      return isSyncing ? 3000 : false
    },
  })

  // Check if any sync is in progress
  const isSyncing = syncStatus?.some((s) => s.status === 'syncing')

  // Fetch item stats for accurate counts
  const { data: statsData } = useQuery({
    queryKey: ['items', 'stats'],
    queryFn: async () => {
      return api.items.getStats()
    },
    refetchInterval: isSyncing ? 5000 : false,
  })

  // Fetch recent unprocessed items for preview (limit to 20)
  const { data: recentData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', 'recent-unprocessed'],
    queryFn: async () => {
      const result = await api.items.getItems({ 
        per_page: 20,
        status: 'unprocessed',
      })
      return result
    },
    refetchInterval: isSyncing ? 5000 : false,
  })

  // Trigger sync mutation
  const triggerSync = useMutation({
    mutationFn: async () => {
      return api.sync.triggerSyncAll()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.status() })
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all })
    },
  })

  // Use stats for accurate counts
  const totalItems = statsData?.total_items ?? 0
  const unprocessedCount = statsData?.unprocessed_items ?? 0
  const processedCount = statsData?.processed_items ?? 0
  const sourceStats = statsData?.items_by_source ?? ({} as Record<Source, number>)

  // Recent unprocessed items (up to 20)
  const recentUnprocessed = recentData?.items ?? []

  if (itemsLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header with Quick Actions */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Your saved content at a glance
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => triggerSync.mutate()}
            disabled={triggerSync.isPending}
            className={cn(
              'transition-all duration-200',
              'hover:shadow-md hover:scale-[1.02]',
              'active:scale-[0.98]'
            )}
          >
            {triggerSync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className={cn('mr-2 h-4 w-4', isSyncing && 'animate-spin')} />
            )}
            {isSyncing ? 'Syncing...' : 'Trigger Sync'}
          </Button>
          <Link to="/items" search={{ status: 'unprocessed' }}>
            <Button
              className={cn(
                'transition-all duration-200',
                'hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02]',
                'active:scale-[0.98]'
              )}
            >
              <Inbox className="mr-2 h-4 w-4" />
              Process Inbox
              {unprocessedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-white/20">
                  {formatNumber(unprocessedCount)}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {/* Total Items */}
        <Card className="card-hover group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items
            </CardTitle>
            <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
              <Archive className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold font-mono tracking-tight">
              {formatNumber(totalItems)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Across all sources
            </p>
          </CardContent>
        </Card>

        {/* Unprocessed (Inbox) - now uses unprocessedCount */}
        <Card
          className={cn(
            'card-hover group relative overflow-hidden',
            'border-l-4 border-l-amber-500'
          )}
        >
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inbox
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-semibold font-mono tracking-tight text-amber-500">
              {formatNumber(unprocessedCount)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Items awaiting review
            </p>
          </CardContent>
        </Card>

        {/* Processed - now uses processedCount */}
        <Card
          className={cn(
            'card-hover group relative overflow-hidden',
            'border-l-4 border-l-emerald-500'
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Processed
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-semibold font-mono tracking-tight text-emerald-500">
              {formatNumber(processedCount)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed items
            </p>
          </CardContent>
        </Card>

        {/* By Source - now uses sourceStats from stats API */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sourceStats).map(([source, count]) => (
                <Badge
                  key={source}
                  variant={source as Source}
                  className={cn(
                    'gap-1.5 px-2.5 py-1',
                    'transition-transform duration-200 hover:scale-105'
                  )}
                >
                  <SourceIcon source={source as Source} size="sm" />
                  <span className="font-mono font-semibold">{formatNumber(count)}</span>
                </Badge>
              ))}
              {Object.keys(sourceStats).length === 0 && (
                <p className="text-xs text-muted-foreground">No items yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent Unprocessed Items */}
      <section>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Recent Inbox Items
              </CardTitle>
              <CardDescription className="mt-1">
                Latest items waiting for your review
              </CardDescription>
            </div>
            <Link to="/items" search={{ status: 'unprocessed' }}>
              <Button variant="ghost" size="sm" className="gap-1.5 group">
                View All
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentUnprocessed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-4">
                  <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold">Inbox Zero!</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                  All caught up. Start by syncing your accounts or adding items manually.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {recentUnprocessed.map((item: SavedItem, index) => (
                  <RecentItemCard key={item.id} item={item} index={index} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Sync Status */}
      {syncStatus && syncStatus.length > 0 && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Connected Sources</CardTitle>
              <CardDescription>
                Status of your connected platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
                {syncStatus.map((status) => (
                  <div
                    key={status.source}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-4',
                      'transition-all duration-200',
                      'hover:bg-accent/50 hover:shadow-sm',
                      'card-hover'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        'transition-transform duration-200 hover:scale-110'
                      )}
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--color-source-${status.source}) 15%, transparent)`,
                      }}
                    >
                      <SourceIcon source={status.source} className="h-5 w-5" />
                    </div>
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
        </section>
      )}
    </div>
  )
}

/**
 * Recent Item Card - Compact item display for dashboard
 */
function RecentItemCard({ item, index }: { item: SavedItem; index: number }) {
  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="group block"
    >
      <div
        className={cn(
          'flex items-start gap-4 p-4',
          'transition-all duration-200',
          'hover:bg-accent/50',
          sourceColorClasses[item.source]
        )}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Thumbnail */}
        {item.thumbnail_url && !item.thumbnail_url.includes('no_thumbnail') ? (
          <img
            src={item.thumbnail_url}
            alt=""
            className={cn(
              'h-14 w-20 rounded-lg object-cover flex-shrink-0',
              'ring-1 ring-border',
              'transition-transform duration-200 group-hover:scale-105'
            )}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div
            className={cn(
              'flex h-14 w-20 items-center justify-center rounded-lg flex-shrink-0',
              'bg-muted ring-1 ring-border'
            )}
          >
            <SourceIcon source={item.source} className="text-muted-foreground h-6 w-6" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={item.source} className="text-xs px-1.5 py-0 h-5">
              {SOURCE_METADATA[item.source].label}
            </Badge>
            <Badge
              variant="unprocessed"
              className="text-xs px-1.5 py-0 h-5 animate-subtle-pulse"
            >
              New
            </Badge>
          </div>
          <h4
            className={cn(
              'font-medium text-sm line-clamp-1',
              'transition-colors duration-200',
              'group-hover:text-primary'
            )}
          >
            {item.title}
          </h4>
          <p className="text-xs text-muted-foreground">
            {formatRelativeTime(item.created_at)}
          </p>
        </div>

        {/* External link indicator */}
        {item.url && (
          <ExternalLink
            className={cn(
              'h-4 w-4 text-muted-foreground flex-shrink-0',
              'opacity-0 group-hover:opacity-100',
              'transition-all duration-200',
              'group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
            )}
          />
        )}
      </div>
    </Link>
  )
}

/**
 * Sync Status Indicator
 */
function SyncStatusIndicator({ status }: { status: string | undefined }) {
  const statusConfig: Record<string, { color: string; pulse: boolean; label: string }> = {
    idle: { color: 'bg-emerald-500', pulse: false, label: 'Synced' },
    completed: { color: 'bg-emerald-500', pulse: false, label: 'Synced' },
    running: { color: 'bg-blue-500', pulse: true, label: 'Syncing' },
    syncing: { color: 'bg-blue-500', pulse: true, label: 'Syncing' },
    failed: { color: 'bg-red-500', pulse: false, label: 'Error' },
    error: { color: 'bg-red-500', pulse: false, label: 'Error' },
  }

  const config = statusConfig[status ?? 'idle'] ?? { color: 'bg-gray-400', pulse: false, label: 'Unknown' }

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2.5 w-2.5 rounded-full',
          config.color,
          config.pulse && 'animate-pulse'
        )}
      />
      <span className="text-xs text-muted-foreground font-medium">
        {config.label}
      </span>
    </div>
  )
}

/**
 * Dashboard loading skeleton
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-end justify-between">
        <div>
          <div className="h-10 w-48 rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-32 rounded bg-muted" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 rounded-lg bg-muted" />
          <div className="h-10 w-40 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-10 w-20 rounded bg-muted" />
              <div className="mt-2 h-3 w-28 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent items skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-14 w-20 rounded-lg bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-muted" />
                  <div className="h-5 w-12 rounded-full bg-muted" />
                </div>
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
