import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Calendar, CalendarDays, Archive, ExternalLink, Loader2 } from 'lucide-react'

interface StoryActionsProps {
  /** Handler for Tomorrow (+1 day) action */
  onTomorrow: () => void
  /** Handler for 7 Days (+7 days) action */
  onWeek: () => void
  /** Handler for Archive (+30 days) action */
  onArchive: () => void
  /** Handler for Read Now action */
  onReadNow: () => void
  /** Whether any action is in progress */
  isLoading?: boolean
  className?: string
}

/**
 * StoryActions component - Action buttons row at bottom
 *
 * Actions:
 * - Tomorrow: Schedule for tomorrow (+1 day)
 * - 7 Days: Schedule for next week (+7 days)
 * - Archive: Archive and hide for 30 days
 * - Read Now: Open link and pause timer
 */
export function StoryActions({
  onTomorrow,
  onWeek,
  onArchive,
  onReadNow,
  isLoading = false,
  className,
}: StoryActionsProps) {
  return (
    <div className={cn(
      'flex items-center justify-center gap-2 px-6',
      className
    )}>
      {/* Secondary Actions Group */}
      <div className="flex items-center gap-2 p-1.5 bg-white/[0.06] backdrop-blur-xl rounded-2xl ring-1 ring-white/10">
        {/* Tomorrow Button */}
        <Button
          variant="ghost"
          size="lg"
          onClick={onTomorrow}
          disabled={isLoading}
          className={cn(
            'text-white/80 hover:text-white hover:bg-white/10 rounded-xl px-5',
            'transition-all duration-200 hover:scale-[1.02]',
            'disabled:opacity-40'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calendar className="h-4 w-4 mr-2" />
          )}
          Tomorrow
        </Button>

        <div className="w-px h-6 bg-white/10" />

        {/* 7 Days Button */}
        <Button
          variant="ghost"
          size="lg"
          onClick={onWeek}
          disabled={isLoading}
          className={cn(
            'text-white/80 hover:text-white hover:bg-white/10 rounded-xl px-5',
            'transition-all duration-200 hover:scale-[1.02]',
            'disabled:opacity-40'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarDays className="h-4 w-4 mr-2" />
          )}
          7 Days
        </Button>

        <div className="w-px h-6 bg-white/10" />

        {/* Archive Button */}
        <Button
          variant="ghost"
          size="lg"
          onClick={onArchive}
          disabled={isLoading}
          className={cn(
            'text-white/80 hover:text-white hover:bg-white/10 rounded-xl px-5',
            'transition-all duration-200 hover:scale-[1.02]',
            'disabled:opacity-40'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4 mr-2" />
          )}
          Archive
        </Button>
      </div>

      {/* Primary Action - Read Now */}
      <Button
        size="lg"
        onClick={onReadNow}
        disabled={isLoading}
        className={cn(
          'bg-source-reddit text-white font-semibold rounded-2xl px-8',
          'shadow-lg shadow-source-reddit/30',
          'hover:bg-source-reddit/90 hover:shadow-xl hover:shadow-source-reddit/40',
          'transition-all duration-200 hover:scale-[1.03]',
          'disabled:opacity-40 disabled:shadow-none'
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4 mr-2" />
        )}
        Read Now
      </Button>
    </div>
  )
}

export default StoryActions
