import { MessageSquare } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface SubredditGroupSidebarProps {
  subreddits: Array<{ subreddit: string; count: number }> // Sorted by count desc
  selectedSubreddit: string | null
  onSubredditSelect: (subreddit: string | null) => void
  className?: string
}

export function SubredditGroupSidebar({
  subreddits,
  selectedSubreddit,
  onSubredditSelect,
  className,
}: SubredditGroupSidebarProps) {
  const totalCount = subreddits.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className={cn('w-64 border-r bg-card flex flex-col', className)}>
      {/* Header */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <MessageSquare className="h-5 w-5 text-source-reddit" />
          Subreddits
        </div>
      </div>

      {/* All option */}
      <button
        onClick={() => onSubredditSelect(null)}
        className={cn(
          'w-full px-4 py-2 flex justify-between items-center shrink-0',
          'hover:bg-accent transition-colors duration-150',
          selectedSubreddit === null && 'bg-accent'
        )}
      >
        <span>All</span>
        <span className="text-muted-foreground">{totalCount.toLocaleString()}</span>
      </button>

      <Separator className="shrink-0" />

      {/* Subreddit list - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="py-2">
          {subreddits.map(({ subreddit, count }) => (
            <button
              key={subreddit}
              onClick={() => onSubredditSelect(selectedSubreddit === subreddit ? null : subreddit)}
              className={cn(
                'w-full px-4 py-2 flex items-center gap-3',
                'hover:bg-accent transition-colors duration-150',
                selectedSubreddit === subreddit && 'bg-accent'
              )}
            >
              <span className="text-source-reddit font-medium">r/</span>
              <span className="flex-1 text-left truncate">{subreddit}</span>
              <span className="text-muted-foreground text-sm shrink-0">
                {count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SubredditGroupSidebar
