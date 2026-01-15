import { cn } from '@/lib/utils'

interface StoryProgressProps {
  /** Total number of items in the queue */
  total: number
  /** Current item index (0-based) */
  current: number
  /** Progress of current item (0 to 1) */
  currentProgress: number
  className?: string
}

/**
 * StoryProgress component - Instagram-style segmented progress bar
 *
 * Features:
 * - Segmented bar showing all items in queue
 * - Completed segments are fully filled
 * - Current segment shows timer progress
 * - Future segments are empty/dimmed
 */
export function StoryProgress({
  total,
  current,
  currentProgress,
  className,
}: StoryProgressProps) {
  const maxVisible = 10
  const currentPage = Math.floor(current / maxVisible)
  const pageStart = currentPage * maxVisible
  const pageEnd = Math.min(pageStart + maxVisible, total)
  const visibleCount = pageEnd - pageStart
  const segments = Array.from({ length: visibleCount }, (_, i) => pageStart + i)

  return (
    <div className={cn('flex items-center gap-1.5 px-4', className)}>
      {/* Page indicator */}
      {currentPage > 0 && (
        <span className="text-[10px] font-medium text-white/50 tabular-nums mr-1">
          {pageStart}+
        </span>
      )}
      
      {segments.map((itemIndex) => {
        const isCompleted = itemIndex < current
        const isCurrent = itemIndex === current
        const progress = isCompleted ? 1 : isCurrent ? currentProgress : 0

        return (
          <div
            key={itemIndex}
            className={cn(
              'relative h-1.5 flex-1 overflow-hidden rounded-full',
              'bg-white/20 backdrop-blur-sm'
            )}
          >
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-150 ease-out',
                isCompleted && 'bg-white',
                isCurrent && 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]',
                !isCompleted && !isCurrent && 'bg-white/20'
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )
      })}
      
    </div>
  )
}

export default StoryProgress
