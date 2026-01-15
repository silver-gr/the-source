// frontend/src/components/shared/SocialMentionCard.tsx
import { ExternalLink, ArrowUp, MessageSquare, User, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type { SocialMention } from '@/types'

interface SocialMentionCardProps {
  mention: SocialMention
  className?: string
}

/**
 * SocialMentionCard - Display a single social mention with details
 */
export function SocialMentionCard({ mention, className }: SocialMentionCardProps) {
  const isHN = mention.platform === 'hackernews'

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        isHN
          ? "bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40"
          : "bg-orange-600/5 border-orange-600/20 hover:border-orange-600/40",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <a
            href={mention.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "font-medium hover:underline line-clamp-2",
              isHN ? "text-orange-600 dark:text-orange-400" : "text-orange-500 dark:text-orange-300"
            )}
          >
            {mention.title || 'Untitled'}
            <ExternalLink className="inline-block w-3 h-3 ml-1 opacity-60" />
          </a>

          {/* Subreddit badge (Reddit only) */}
          {mention.subreddit && (
            <Badge variant="outline" className="mt-1 text-xs">
              r/{mention.subreddit}
            </Badge>
          )}
        </div>

        {/* Score */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
          isHN ? "bg-orange-500/20 text-orange-600" : "bg-orange-600/20 text-orange-500"
        )}>
          <ArrowUp className="w-3.5 h-3.5" />
          {mention.score}
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {mention.comment_count} comments
        </span>
        {mention.author && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {mention.author}
          </span>
        )}
        {mention.posted_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(mention.posted_at)}
          </span>
        )}
      </div>

      {/* Top comment preview */}
      {mention.top_comment && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-sm text-muted-foreground overflow-hidden">
          <span className="font-medium text-xs uppercase tracking-wide opacity-60 block mb-1">
            Top Comment
          </span>
          <p className="line-clamp-3 whitespace-pre-wrap break-words overflow-hidden">
            {mention.top_comment}
          </p>
        </div>
      )}
    </div>
  )
}

export default SocialMentionCard
