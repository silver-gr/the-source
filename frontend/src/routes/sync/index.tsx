import type React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Youtube,
  MessageSquare,
  Instagram,
  Plus,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-client'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { Source, SyncStatus } from '@/types'
import { SOURCE_METADATA } from '@/types'

export const Route = createFileRoute('/sync/')({
  component: SyncPage,
})

const SourceIcon = ({ source, className, style }: { source: Source; className?: string; style?: React.CSSProperties }) => {
  switch (source) {
    case 'youtube':
      return <Youtube className={cn('h-6 w-6', className)} style={style} />
    case 'reddit':
      return <MessageSquare className={cn('h-6 w-6', className)} style={style} />
    case 'instagram':
      return <Instagram className={cn('h-6 w-6', className)} style={style} />
    case 'manual':
      return <Plus className={cn('h-6 w-6', className)} style={style} />
  }
}

const StatusIcon = ({ status }: { status: SyncStatus['status'] }) => {
  switch (status) {
    case 'syncing':
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
    case 'error':
      return <AlertCircle className="h-5 w-5 text-red-500" />
    case 'idle':
      return <Check className="h-5 w-5 text-green-500" />
  }
}

function SyncPage() {
  const queryClient = useQueryClient()

  const { data: syncStatus, isLoading } = useQuery({
    queryKey: queryKeys.sync.status(),
    queryFn: () => api.sync.getStatus(),
    refetchInterval: 5000, // Poll every 5 seconds to check for sync updates
  })

  const triggerSyncMutation = useMutation({
    mutationFn: (source: 'youtube' | 'reddit') => api.sync.triggerSync(source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.status() })
    },
  })

  const triggerSyncAllMutation = useMutation({
    mutationFn: () => api.sync.triggerSyncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.status() })
    },
  })

  const allSources: Source[] = ['youtube', 'reddit', 'instagram', 'manual']

  // Get status for a source, or create a default one
  const getSourceStatus = (source: Source): SyncStatus => {
    const status = syncStatus?.find((s) => s.source === source)
    return status ?? {
      source,
      last_sync: null,
      status: 'idle',
      error_message: null,
      items_synced: 0,
    }
  }

  const isSyncing = syncStatus?.some((s) => s.status === 'syncing') ?? false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sync Status</h1>
          <p className="text-muted-foreground">
            Manage and monitor your source synchronization
          </p>
        </div>
        <Button
          onClick={() => triggerSyncAllMutation.mutate()}
          disabled={triggerSyncAllMutation.isPending || isSyncing}
        >
          {triggerSyncAllMutation.isPending || isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync All
        </Button>
      </div>

      {/* Sync Cards */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-24 rounded bg-muted mb-2" />
                <div className="h-4 w-48 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {allSources.map((source) => {
            const status = getSourceStatus(source)
            const metadata = SOURCE_METADATA[source]
            const isSourceSyncing = status.status === 'syncing'

            return (
              <Card key={source} className="relative overflow-hidden">
                {/* Color accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: metadata.color }}
                />

                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${metadata.color}20` }}
                    >
                      <SourceIcon source={source} style={{ color: metadata.color }} />
                    </div>
                    <div>
                      <CardTitle>{metadata.label}</CardTitle>
                      <CardDescription>
                        {status.last_sync
                          ? `Last synced ${formatRelativeTime(status.last_sync)}`
                          : 'Never synced'}
                      </CardDescription>
                    </div>
                  </div>
                  <StatusIcon status={status.status} />
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Items synced:</span>
                      <Badge variant="secondary">{status.items_synced}</Badge>
                    </div>
                  </div>

                  {/* Error Message */}
                  {status.error_message && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      {status.error_message}
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge
                      variant={
                        status.status === 'syncing'
                          ? 'default'
                          : status.status === 'error'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {status.status === 'syncing' && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                    </Badge>
                  </div>

                  {/* Action Button - only for syncable sources */}
                  {(source === 'youtube' || source === 'reddit') && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => triggerSyncMutation.mutate(source)}
                      disabled={triggerSyncMutation.isPending || isSourceSyncing}
                    >
                      {isSourceSyncing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync Now
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>How Sync Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            UnifiedSaved periodically syncs your saved items from connected sources.
            You can also trigger a manual sync at any time.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-foreground mb-2">YouTube</h4>
              <p>Syncs your "Watch Later" playlist and liked videos.</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Reddit</h4>
              <p>Syncs your saved posts and comments from Reddit.</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Instagram</h4>
              <p>Syncs your saved posts and collections from Instagram.</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Manual</h4>
              <p>Items you add manually through the dashboard.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
