import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagGroupSelectorProps {
  tags: Array<{ tag: string; count: number }> // Sorted by count desc
  selectedTag: string | null
  onTagSelect: (tag: string | null) => void
  totalItems: number // Total items count for "All" pill
  className?: string
}

const INITIAL_VISIBLE = 12

export function TagGroupSelector({
  tags,
  selectedTag,
  onTagSelect,
  totalItems,
  className,
}: TagGroupSelectorProps) {
  const [expanded, setExpanded] = useState(false)

  const visibleTags = expanded ? tags : tags.slice(0, INITIAL_VISIBLE)
  const hiddenCount = tags.length - INITIAL_VISIBLE
  const hasMoreTags = hiddenCount > 0

  const pillBaseStyles = cn(
    'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium',
    'transition-all duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'hover:scale-105 active:scale-95'
  )

  const selectedStyles = 'bg-primary text-primary-foreground shadow-sm'
  const unselectedStyles =
    'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {/* All pill */}
      <button
        onClick={() => onTagSelect(null)}
        className={cn(
          pillBaseStyles,
          selectedTag === null ? selectedStyles : unselectedStyles
        )}
        aria-pressed={selectedTag === null}
      >
        All ({totalItems.toLocaleString()})
      </button>

      {/* Tag pills */}
      {visibleTags.map(({ tag, count }) => (
        <button
          key={tag}
          onClick={() => onTagSelect(selectedTag === tag ? null : tag)}
          className={cn(
            pillBaseStyles,
            selectedTag === tag ? selectedStyles : unselectedStyles
          )}
          aria-pressed={selectedTag === tag}
        >
          {tag} ({count.toLocaleString()})
        </button>
      ))}

      {/* Expand/collapse button */}
      {hasMoreTags && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm',
            'text-muted-foreground hover:text-foreground',
            'transition-all duration-150 ease-out',
            'hover:bg-muted/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
          )}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />+ {hiddenCount} more...
            </>
          )}
        </button>
      )}
    </div>
  )
}
