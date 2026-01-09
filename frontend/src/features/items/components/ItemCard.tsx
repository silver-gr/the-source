import { useState, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Archive, Trash2, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SourceIcon, sourceColorClasses } from '@/components/shared/SourceIcon'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { SavedItem } from '@/types'
import { SOURCE_METADATA } from '@/types'

interface ItemCardProps {
  item: SavedItem
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  onMarkRead: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}

/**
 * ItemCard component - Individual item display with ADHD-optimized design
 * Features:
 * - Color-coded left border by source (instant visual recognition)
 * - Thumbnail preview when available
 * - Title prominently displayed (max 2 lines)
 * - Source icon + status badge
 * - Tags as small badges (max 3 visible)
 * - Relative date for quick scanning
 * - Quick action buttons on hover (one-click actions)
 * - Checkbox for bulk selection
 */
export function ItemCard({
  item,
  isSelected,
  onSelect,
  onMarkRead,
  onArchive,
  onDelete,
}: ItemCardProps) {
  const [showActions, setShowActions] = useState(false)

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation()
      onSelect(item.id, e.target.checked)
    },
    [item.id, onSelect]
  )

  const handleMarkRead = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onMarkRead(item.id)
    },
    [item.id, onMarkRead]
  )

  const handleArchive = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onArchive(item.id)
    },
    [item.id, onArchive]
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onDelete(item.id)
    },
    [item.id, onDelete]
  )

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="group block"
    >
      <Card
        className={cn(
          'overflow-hidden transition-all duration-200',
          'hover:shadow-lg hover:scale-[1.02]',
          sourceColorClasses[item.source],
          isSelected && 'ring-2 ring-primary ring-offset-2'
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Thumbnail Section */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {item.thumbnail_url && !item.thumbnail_url.includes('no_thumbnail') ? (
            <img
              src={item.thumbnail_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                // Hide broken images
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <SourceIcon source={item.source} size="lg" className="text-muted-foreground" />
            </div>
          )}

          {/* Selection Checkbox - Top Left */}
          <div
            className={cn(
              'absolute top-2 left-2 transition-opacity duration-200',
              showActions || isSelected ? 'opacity-100' : 'opacity-0'
            )}
            onClick={handleCheckboxClick}
          >
            <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-background/90 shadow-sm backdrop-blur-sm">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleSelectChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </label>
          </div>

          {/* Source Badge - Top Right */}
          <div className="absolute top-2 right-2">
            <Badge variant={item.source} className="shadow-sm">
              <SourceIcon source={item.source} size="sm" />
              <span className="ml-1 hidden sm:inline">
                {SOURCE_METADATA[item.source].label}
              </span>
            </Badge>
          </div>

          {/* Status Badge - Bottom Left */}
          {!item.processed && (
            <div className="absolute bottom-2 left-2">
              <Badge variant="unprocessed" className="shadow-sm">
                New
              </Badge>
            </div>
          )}

          {/* Quick Actions - Bottom Right (hover only) */}
          <div
            className={cn(
              'absolute bottom-2 right-2 flex gap-1 transition-all duration-200',
              showActions ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            )}
          >
            {!item.processed && (
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 bg-background/90 backdrop-blur-sm hover:bg-green-500 hover:text-white"
                onClick={handleMarkRead}
                title="Mark as Read"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-background/90 backdrop-blur-sm hover:bg-blue-500 hover:text-white"
              onClick={handleArchive}
              title="Archive"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-background/90 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDelete}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content Section */}
        <CardContent className="p-4">
          {/* Title - Most prominent (ADHD: clear hierarchy) */}
          <h3 className="mb-2 font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>

          {/* Description - Secondary */}
          {item.description && (
            <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Meta row: date + external link */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{formatRelativeTime(item.created_at)}</span>
            {item.url && (
              <ExternalLink className="h-3 w-3" />
            )}
          </div>

          {/* Tags - Max 3 visible */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs px-1.5 py-0"
                >
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export default ItemCard
