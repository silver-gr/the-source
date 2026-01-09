import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Youtube,
  MessageSquare,
  Instagram,
  Plus,
  ArrowLeft,
  ExternalLink,
  Check,
  Archive,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-client'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import type { Source } from '@/types'
import { SOURCE_METADATA } from '@/types'

export const Route = createFileRoute('/items/$itemId')({
  component: ItemDetailPage,
})

const SourceIcon = ({ source }: { source: Source }) => {
  switch (source) {
    case 'youtube':
      return <Youtube className="h-5 w-5" />
    case 'reddit':
      return <MessageSquare className="h-5 w-5" />
    case 'instagram':
      return <Instagram className="h-5 w-5" />
    case 'manual':
      return <Plus className="h-5 w-5" />
  }
}

function ItemDetailPage() {
  const { itemId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data: item, isLoading, error } = useQuery({
    queryKey: queryKeys.items.detail(itemId),
    queryFn: () => api.items.getItem(itemId),
  })

  const markAsReadMutation = useMutation({
    mutationFn: () => api.items.markAsRead(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.items.lists() })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.items.archiveItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.items.lists() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.items.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items.lists() })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded bg-muted" />
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
        <Card className="animate-pulse">
          <div className="aspect-video bg-muted" />
          <CardContent className="p-6 space-y-4">
            <div className="h-6 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="h-20 w-full rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <Link to="/items" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Items
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Item not found or an error occurred
            </p>
            <Button asChild variant="outline">
              <Link to="/items">Go Back</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/items"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Items
      </Link>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Item Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            {/* Thumbnail */}
            {item.thumbnail_url && (
              <div className="aspect-video overflow-hidden">
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={item.source}>
                  <SourceIcon source={item.source} />
                  <span className="ml-1">{SOURCE_METADATA[item.source].label}</span>
                </Badge>
                {!item.processed && (
                  <Badge variant="unprocessed">Unprocessed</Badge>
                )}
                {item.processed && (
                  <Badge variant="read">Read</Badge>
                )}
              </div>
              <CardTitle className="text-2xl">{item.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {item.description && (
                <p className="text-muted-foreground">{item.description}</p>
              )}

              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Original
                </a>
              )}

              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!item.processed && (
                <Button
                  className="w-full"
                  onClick={() => markAsReadMutation.mutate()}
                  disabled={markAsReadMutation.isPending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark as Read
                </Button>
              )}
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this item?')) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{SOURCE_METADATA[item.source].label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source ID</span>
                <span className="font-mono text-xs truncate max-w-[150px]">
                  {item.source_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Synced</span>
                <span>{formatRelativeTime(item.synced_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{item.processed ? 'Read' : 'Unprocessed'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
