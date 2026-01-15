import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { SavedItem, RedditPostDetails, RedditComment } from '@/types'
import { ArrowUpRight, MessageSquare, Users, User, ExternalLink, Quote } from 'lucide-react'

interface StoryCardProps {
  item: SavedItem
  redditDetails?: RedditPostDetails | null
  isLoadingDetails?: boolean
  className?: string
}

/**
 * StoryCard component - Single item display in story view
 *
 * Content displayed:
 * - Large thumbnail (background)
 * - Title (prominent)
 * - Description/selftext (if available)
 * - Subreddit badge
 * - Score (upvotes)
 * - Review count indicator
 * - Top comments (when Reddit details available)
 */
export function StoryCard({ item, redditDetails, isLoadingDetails, className }: StoryCardProps) {
  const subreddit = redditDetails?.subreddit || item.subreddit || extractSubredditFromUrl(item.url)
  const score = redditDetails?.score ?? item.score
  const author = redditDetails?.author
  const selftext = redditDetails?.selftext
  const comments = redditDetails?.comments || []

  // Determine if this is a link post (external URL, not a self-post)
  const isLinkPost = redditDetails?.is_self === false && redditDetails?.url
  const externalUrl = isLinkPost ? redditDetails.url : null

  // Check if external URL is an image
  const isImageUrl = externalUrl ? isImageLink(externalUrl) : false

  return (
    <div
      className={cn(
        'relative flex w-full flex-col overflow-hidden rounded-3xl shadow-2xl',
        'bg-gradient-to-br from-zinc-900 via-zinc-800/95 to-zinc-900',
        'border border-white/[0.08]',
        className
      )}
    >
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

      {/* Background Image with enhanced overlay */}
      {item.thumbnail_url && !item.thumbnail_url.includes('no_thumbnail') ? (
        <>
          <img
            src={item.thumbnail_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm"
            loading="eager"
          />
          {/* Multi-layer gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/80 to-zinc-900/40" />
          <div className="absolute inset-0 bg-gradient-to-br from-source-reddit/10 via-transparent to-transparent" />
        </>
      ) : (
        // Rich gradient fallback
        <div className="absolute inset-0 bg-gradient-to-br from-source-reddit/20 via-zinc-900 to-zinc-800" />
      )}

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* Header section */}
        <div className="flex-shrink-0 space-y-4 p-8 pb-4">
          {/* Meta badges row */}
          <div className="flex flex-wrap items-center gap-2">
            {subreddit && (
              <Badge
                className="bg-source-reddit/90 text-white border-0 font-semibold shadow-lg shadow-source-reddit/20 hover:bg-source-reddit"
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                r/{subreddit}
              </Badge>
            )}
            {author && (
              <Badge
                variant="secondary"
                className="bg-white/10 text-white/90 border border-white/10 backdrop-blur-md"
              >
                <User className="h-3 w-3 mr-1.5" />
                u/{author}
              </Badge>
            )}
            {score != null && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/20"
              >
                <ArrowUpRight className="h-3 w-3 mr-1" />
                {formatScore(score)}
              </Badge>
            )}
            {item.review_count > 0 && (
              <Badge
                variant="secondary"
                className="bg-amber-500/20 text-amber-300 border border-amber-500/20"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Reviewed {item.review_count}x
              </Badge>
            )}
          </div>

          {/* Title */}
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="group flex items-start gap-3 hover:opacity-90 transition-opacity"
            >
              <h2 className="text-3xl font-bold leading-tight text-white line-clamp-3 tracking-tight group-hover:text-source-reddit transition-colors">
                {redditDetails?.title || item.title}
              </h2>
              <ExternalLink className="h-6 w-6 text-white/50 flex-shrink-0 mt-1.5 group-hover:text-source-reddit transition-colors" />
            </a>
          ) : (
            <h2 className="text-3xl font-bold leading-tight text-white line-clamp-3 tracking-tight">
              {redditDetails?.title || item.title}
            </h2>
          )}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-8 pb-6 space-y-5 review-scrollbar">
          {/* Loading skeleton */}
          {isLoadingDetails && (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded-full w-full" />
              <div className="h-4 bg-white/10 rounded-full w-5/6" />
              <div className="h-4 bg-white/10 rounded-full w-4/6" />
              <div className="mt-6 space-y-3">
                <div className="h-3 bg-white/5 rounded-full w-24" />
                <div className="h-20 bg-white/5 rounded-xl" />
              </div>
            </div>
          )}

          {/* Embedded image */}
          {!isLoadingDetails && isImageUrl && externalUrl && (
            <div className="rounded-2xl overflow-hidden bg-black/40 ring-1 ring-white/10">
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block"
              >
                <img
                  src={externalUrl}
                  alt={redditDetails?.title || item.title}
                  className="w-full max-h-[50vh] object-contain hover:scale-[1.02] transition-transform duration-300"
                  loading="eager"
                />
              </a>
            </div>
          )}

          {/* Self-text content */}
          {!isLoadingDetails && selftext && (
            <div className="relative bg-white/[0.04] backdrop-blur-sm rounded-2xl p-5 ring-1 ring-white/10">
              <Quote className="absolute top-4 right-4 h-8 w-8 text-white/10" />
              <p className="text-white/85 text-base leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto pr-8 review-scrollbar">
                {selftext}
              </p>
            </div>
          )}

          {/* Description fallback */}
          {!isLoadingDetails && !selftext && item.description && (
            <p className="text-white/70 line-clamp-4 text-lg leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Comments section */}
          {!isLoadingDetails && comments.length > 0 && (
            <div className="space-y-3 mt-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-white/40" />
                <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest">
                  Top Comments
                </h3>
                <span className="text-white/30 text-xs">
                  ({redditDetails?.num_comments || comments.length})
                </span>
              </div>
              <div className="space-y-3">
                {comments.map((comment, idx) => (
                  <CommentCard key={idx} comment={comment} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tags section */}
        {item.tags.length > 0 && (
          <div className="flex-shrink-0 px-8 pb-6">
            <div className="flex flex-wrap gap-2">
              {item.tags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="bg-white/5 text-white/70 border-white/10 text-xs font-medium px-3"
                >
                  #{tag}
                </Badge>
              ))}
              {item.tags.length > 4 && (
                <Badge
                  variant="outline"
                  className="bg-white/5 text-white/50 border-white/10 text-xs"
                >
                  +{item.tags.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * CommentCard - Displays a Reddit comment with nested replies
 */
interface CommentCardProps {
  comment: RedditComment
}

function CommentCard({ comment }: CommentCardProps) {
  const depth = comment.depth || 0
  // Indent based on depth (max 3 levels of visual indentation)
  const indentLevel = Math.min(depth, 3)

  return (
    <div
      className={cn(
        'space-y-2',
        indentLevel > 0 && 'ml-4 pl-4 border-l-2 border-source-reddit/30'
      )}
    >
      <div className={cn(
        'rounded-xl p-4 space-y-2 transition-colors',
        depth === 0
          ? 'bg-white/[0.06] ring-1 ring-white/[0.08] hover:bg-white/[0.08]'
          : 'bg-white/[0.03] ring-1 ring-white/[0.05]'
      )}>
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-xs font-semibold',
            comment.author ? 'text-source-reddit/80' : 'text-white/30'
          )}>
            {comment.author ? `u/${comment.author}` : '[deleted]'}
          </span>
          <span className="text-emerald-400/80 text-xs font-medium flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" />
            {formatScore(comment.score)}
          </span>
        </div>
        <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply, idx) => (
            <CommentCard key={idx} comment={reply} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Check if URL points to an image file
 */
function isImageLink(url: string): boolean {
  // Common image extensions
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i
  // Reddit image hosting patterns
  const redditImagePatterns = [
    /i\.redd\.it\//,
    /preview\.redd\.it\//,
    /i\.imgur\.com\//,
    /imgur\.com\/[^/]+\.(jpg|jpeg|png|gif|webp)/i,
  ]

  if (imageExtensions.test(url)) return true
  return redditImagePatterns.some(pattern => pattern.test(url))
}

/**
 * Extract subreddit name from Reddit URL
 */
function extractSubredditFromUrl(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/reddit\.com\/r\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Format score with k/m suffix for large numbers
 */
function formatScore(score: number): string {
  if (score >= 1000000) {
    return `${(score / 1000000).toFixed(1)}m`
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`
  }
  return score.toString()
}

export default StoryCard
