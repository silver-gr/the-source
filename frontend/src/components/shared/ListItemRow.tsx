import { useCallback } from 'react'
import { Info, Check, Link2Off, EyeOff } from 'lucide-react'
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
        'group flex items-center gap-3 px-3 py-2 rounded-lg',
        'transition-all duration-200 ease-out',
        'hover:bg-accent/70 hover:shadow-sm',
        'border border-transparent',
        item.url && 'cursor-pointer',
        isSelected && 'bg-primary/8 border-primary/20 shadow-sm'
      )}
      style={{
        animationDelay: `${Math.min(index * 10, 500)}ms`,
      }}
    >
      {/* Checkbox */}
      <div
        onClick={handleCheckboxClick}
        className={cn(
          "relative flex h-4 w-4 items-center justify-center flex-shrink-0",
          "rounded border-2",
          "transition-all duration-200",
          "hover:scale-110",
          isSelected
            ? "bg-primary border-primary"
            : "border-muted-foreground/30 hover:border-primary/60"
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
            "transition-transform duration-200",
            "group-hover:scale-110"
          )}
        />
      ) : (
        <SourceIcon
          source={item.source}
          size="sm"
          className={cn(
            "flex-shrink-0",
            "transition-transform duration-200",
            "group-hover:scale-110"
          )}
        />
      )}

      {/* Title - Click opens URL */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-sm truncate block leading-snug',
            'transition-colors duration-200',
            'group-hover:text-primary',
            !item.processed && 'font-medium'
          )}
          title={item.title}
        >
          {item.title}
        </span>
      </div>

      {/* Badges container */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Unprocessed indicator */}
        {!item.processed && (
          <Badge
            variant="unprocessed"
            className={cn(
              "text-[10px] px-1.5 py-0 h-5",
              "bg-amber-500/90 text-white font-semibold",
              "shadow-sm shadow-amber-500/20",
              "animate-subtle-pulse"
            )}
          >
            New
          </Badge>
        )}

        {/* Dead link indicator */}
        {item.link_status === 'broken' && (
          <Badge
            variant="destructive"
            className={cn(
              "text-[10px] px-1.5 py-0 h-5",
              "bg-red-500/90 text-white",
              "shadow-sm shadow-red-500/20",
              "flex items-center gap-0.5"
            )}
          >
            <Link2Off className="h-2.5 w-2.5" />
            Dead
          </Badge>
        )}

        {/* NSFW indicator */}
        {(item.nsfw_status === 'nsfw' || item.nsfw_status === 'explicit') && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-5",
              "bg-pink-500/90 text-white border-pink-600",
              "shadow-sm shadow-pink-500/20",
              "flex items-center gap-0.5"
            )}
          >
            <EyeOff className="h-2.5 w-2.5" />
            {item.nsfw_status === 'explicit' ? '18+' : 'NSFW'}
          </Badge>
        )}

        {/* Social badges */}
        <SocialBadges data={socialData} compact className="ml-0.5" />
      </div>

      {/* Info Icon - Opens detail modal */}
      {onInfoClick && (
        <button
          onClick={handleInfoClick}
          className={cn(
            "flex-shrink-0 p-1.5 rounded-md",
            "text-muted-foreground",
            "opacity-0 group-hover:opacity-100",
            "transition-all duration-200",
            "hover:text-primary hover:bg-primary/10 hover:scale-110",
            "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
          )}
          title="View details"
        >
          <Info className="h-4 w-4" />
        </button>
      )}

      {/* Bookmarked Date */}
      <span
        className={cn(
          "text-xs text-muted-foreground w-16 text-right flex-shrink-0 font-mono",
          "transition-colors duration-200",
          "group-hover:text-foreground/70"
        )}
      >
        {formatDate(item.created_at)}
      </span>
    </div>
  )
}

export default ListItemRow
