import { useCallback } from 'react'
import { ExternalLink, Check, Archive, Trash2, Calendar, Tag, Link2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SourceIcon } from '@/components/shared/SourceIcon'
import { FaviconImage } from '@/components/shared/FaviconImage'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type { SavedItem } from '@/types'
import { SOURCE_METADATA } from '@/types'

export interface ItemDetailModalProps {
  item: SavedItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMarkRead?: (id: string) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}

/**
 * ItemDetailModal - Modal for viewing item details and performing actions
 * Opens when clicking the info icon on list rows or cards
 * Shows complete item information and quick action buttons
 * Replaces need to navigate to detail page for quick actions
 */
export function ItemDetailModal({
  item,
  open,
  onOpenChange,
  onMarkRead,
  onArchive,
  onDelete,
}: ItemDetailModalProps) {
  const handleMarkRead = useCallback(() => {
    if (item && onMarkRead) {
      onMarkRead(item.id)
      onOpenChange(false)
    }
  }, [item, onMarkRead, onOpenChange])

  const handleArchive = useCallback(() => {
    if (item && onArchive) {
      onArchive(item.id)
      onOpenChange(false)
    }
  }, [item, onArchive, onOpenChange])

  const handleDelete = useCallback(() => {
    if (item && onDelete) {
      onDelete(item.id)
      onOpenChange(false)
    }
  }, [item, onDelete, onOpenChange])

  const handleOpenUrl = useCallback(() => {
    if (item?.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    }
  }, [item])

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {/* Favicon or Source Icon */}
            <div className="flex-shrink-0 mt-1">
              {item.source === 'raindrop' && item.url ? (
                <FaviconImage
                  url={item.url}
                  size="lg"
                  className="transition-transform duration-150"
                />
              ) : (
                <SourceIcon
                  source={item.source}
                  size="lg"
                  className="transition-transform duration-150"
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Title */}
              <DialogTitle className="text-2xl font-bold leading-tight mb-2">
                {item.title}
              </DialogTitle>

              {/* Source Badge */}
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={item.source}>
                  <SourceIcon source={item.source} size="sm" />
                  <span className="ml-1">{SOURCE_METADATA[item.source].label}</span>
                </Badge>
                {!item.processed && (
                  <Badge variant="unprocessed" className="animate-pulse">
                    Unprocessed
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* URL */}
          {item.url && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-muted rounded-md">
              <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate flex-1 min-w-0"
                title={item.url}
              >
                {item.url}
              </a>
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          )}
        </DialogHeader>

        <Separator className="my-4" />

        {/* Description */}
        {item.description && (
          <div className="mb-4">
            <DialogDescription className="text-base leading-relaxed whitespace-pre-wrap">
              {item.description}
            </DialogDescription>
          </div>
        )}

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-sm">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span>Created</span>
            </div>
            <div className="font-medium">{formatRelativeTime(item.created_at)}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(item.created_at).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span>Last Synced</span>
            </div>
            <div className="font-medium">{formatRelativeTime(item.synced_at)}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(item.synced_at).toLocaleString()}
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {item.url && (
            <Button
              onClick={handleOpenUrl}
              className="flex-1 min-w-[160px]"
              size="lg"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Link
            </Button>
          )}

          {!item.processed && onMarkRead && (
            <Button
              onClick={handleMarkRead}
              variant="outline"
              className={cn(
                "flex-1 min-w-[140px]",
                "hover:bg-green-500 hover:text-white hover:border-green-500"
              )}
              size="lg"
            >
              <Check className="mr-2 h-4 w-4" />
              Mark as Read
            </Button>
          )}

          {onArchive && (
            <Button
              onClick={handleArchive}
              variant="outline"
              className={cn(
                "flex-1 min-w-[140px]",
                "hover:bg-blue-500 hover:text-white hover:border-blue-500"
              )}
              size="lg"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          )}

          {onDelete && (
            <Button
              onClick={handleDelete}
              variant="outline"
              className={cn(
                "flex-1 min-w-[140px]",
                "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
              )}
              size="lg"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ItemDetailModal
