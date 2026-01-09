import { Youtube, MessageSquare, Instagram, Droplet, Facebook, Send, Plus } from 'lucide-react'
import type { Source } from '@/types'
import { cn } from '@/lib/utils'

interface SourceIconProps {
  source: Source
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

/**
 * SourceIcon component - Returns appropriate Lucide icon for each source
 * Provides consistent icon rendering across the application
 */
export function SourceIcon({ source, className, size = 'md' }: SourceIconProps) {
  const iconClass = cn(sizeClasses[size], className)

  switch (source) {
    case 'youtube':
      return <Youtube className={iconClass} />
    case 'reddit':
      return <MessageSquare className={iconClass} />
    case 'instagram':
      return <Instagram className={iconClass} />
    case 'raindrop':
      return <Droplet className={iconClass} />
    case 'facebook':
      return <Facebook className={iconClass} />
    case 'telegram':
      return <Send className={iconClass} />
    case 'manual':
      return <Plus className={iconClass} />
    default:
      return null
  }
}

/**
 * Source color classes for left border styling
 * ADHD-optimized: instant visual recognition by source
 */
export const sourceColorClasses: Record<Source, string> = {
  youtube: 'border-l-4 border-l-[#ff0000]',
  reddit: 'border-l-4 border-l-[#ff4500]',
  instagram: 'border-l-4 border-l-[#e1306c]',
  raindrop: 'border-l-4 border-l-[#0093e0]',
  facebook: 'border-l-4 border-l-[#1877f2]',
  telegram: 'border-l-4 border-l-[#26a5e4]',
  manual: 'border-l-4 border-l-[#6366f1]',
}

/**
 * Source background color classes for hover states
 */
export const sourceBgClasses: Record<Source, string> = {
  youtube: 'bg-[#ff0000]/10',
  reddit: 'bg-[#ff4500]/10',
  instagram: 'bg-[#e1306c]/10',
  raindrop: 'bg-[#0093e0]/10',
  facebook: 'bg-[#1877f2]/10',
  telegram: 'bg-[#26a5e4]/10',
  manual: 'bg-[#6366f1]/10',
}

export default SourceIcon
