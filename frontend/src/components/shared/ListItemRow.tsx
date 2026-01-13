import { useCallback } from 'react'
import { Info, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SourceIcon } from '@/components/shared/SourceIcon'
import { FaviconImage } from '@/components/shared/FaviconImage'
import { SocialBadges } from '@/components/shared/SocialBadges'
import { useSocialMentions } from '@/features/social'
import { cn } from '@/lib/utils'
import type { SavedItem } from '@/types'

export interface ListItemRowProps {
  item: SavedItem
  isSelected: boolean
  onSelect: (id: string, checked: boolean) => void
  onInfoClick?: (item: SavedItem) => void
  formatDate: (date: string) => string
  index: number
}

/**
 * ListItemRow - Compact row component for list views
 * Reusable across ItemListView and GroupedItemsView
 * Features:
 * - Checkbox for selection
 * - Source icon or favicon for raindrop items
 * - Truncated title (click opens URL in new tab)
 * - Unprocessed indicator badge
 * - Info icon button (opens detail modal)
 * - Compact date display
 */
export function ListItemRow({
  item,
  isSelected,
  onSelect,
  onInfoClick,
  formatDate,
  index,
}: ListItemRowProps) {
  const { data: socialData } = useSocialMentions(item.id)

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation()
      onSelect(item.id, e.target.checked)
    },
    [item.id, onSelect]
  )

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const handleRowClick = useCallback(() => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    }
  }, [item.url])

  const handleInfoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onInfoClick) {
      onInfoClick(item)
    }
  }, [item, onInfoClick])

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-md',
        'transition-all duration-150 ease-out',
        'hover:bg-accent/60 hover:shadow-sm',
        'overflow-hidden',
        item.url && 'cursor-pointer',
        isSelected && 'bg-primary/10 ring-1 ring-primary/20'
      )}
      style={{
        animationDelay: `${Math.min(index * 10, 500)}ms`,
      }}
    >
      {/* Checkbox */}
      <div
        onClick={handleCheckboxClick}
        className={cn(
          "relative flex h-3.5 w-3.5 items-center justify-center",
          "rounded border-2 border-muted-foreground/40",
          "transition-all duration-150",
          "hover:border-primary hover:scale-110",
          isSelected && "bg-primary border-primary"
        )}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleSelectChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        {isSelected && (
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        )}
      </div>

      {/* Source Icon or Favicon for raindrop */}
      {item.source === 'raindrop' && item.url ? (
        <FaviconImage
          url={item.url}
          size="sm"
          className={cn(
            "flex-shrink-0",
            "transition-transform duration-150",
            "group-hover:scale-110"
          )}
        />
      ) : (
        <SourceIcon
          source={item.source}
          size="sm"
          className={cn(
            "flex-shrink-0",
            "transition-transform duration-150",
            "group-hover:scale-110"
          )}
        />
      )}

      {/* Title - Click opens URL */}
      <div className="flex-1 min-w-0 max-w-full">
        <span
          className={cn(
            'text-sm truncate block',
            'transition-colors duration-150',
            'group-hover:text-primary',
            !item.processed && 'font-medium'
          )}
          title={item.title}
        >
          {item.title}
        </span>
      </div>

      {/* Unprocessed indicator */}
      {!item.processed && (
        <Badge
          variant="unprocessed"
          className={cn(
            "text-[10px] px-1.5 py-0 h-4 flex-shrink-0",
            "animate-pulse",
            "bg-amber-400/90 text-amber-950",
            "shadow-sm shadow-amber-400/30"
          )}
        >
          New
        </Badge>
      )}

      {/* Social badges */}
      <SocialBadges data={socialData} compact className="ml-1" />

      {/* Info Icon - Opens detail modal */}
      {onInfoClick && (
        <button
          onClick={handleInfoClick}
          className={cn(
            "flex-shrink-0 p-1 rounded",
            "text-muted-foreground",
            "opacity-0 group-hover:opacity-100",
            "transition-all duration-150",
            "hover:text-primary hover:bg-primary/10 hover:scale-110",
            "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
          )}
          title="View details"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Bookmarked Date */}
      <span
        className={cn(
          "text-xs text-muted-foreground w-16 text-right flex-shrink-0",
          "transition-colors duration-150",
          "group-hover:text-foreground/70"
        )}
      >
        {formatDate(item.created_at)}
      </span>
    </div>
  )
}

export default ListItemRow
