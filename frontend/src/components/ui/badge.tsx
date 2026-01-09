import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        // Source-specific variants for ADHD-optimized color coding
        youtube:
          'border-transparent bg-[#ff0000] text-white hover:bg-[#cc0000]',
        reddit:
          'border-transparent bg-[#ff4500] text-white hover:bg-[#cc3700]',
        instagram:
          'border-transparent bg-[#e1306c] text-white hover:bg-[#b52657]',
        raindrop:
          'border-transparent bg-[#0093e0] text-white hover:bg-[#0076b3]',
        facebook:
          'border-transparent bg-[#1877f2] text-white hover:bg-[#1466d2]',
        telegram:
          'border-transparent bg-[#26a5e4] text-white hover:bg-[#1e8fc7]',
        manual:
          'border-transparent bg-[#6366f1] text-white hover:bg-[#4f52c4]',
        // Status variants
        unprocessed:
          'border-transparent bg-amber-400 text-black hover:bg-amber-500',
        read: 'border-transparent bg-green-500 text-white hover:bg-green-600',
        archived:
          'border-transparent bg-slate-400 text-white hover:bg-slate-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
