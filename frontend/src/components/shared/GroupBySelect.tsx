import { Layers, Calendar, Globe, Tags, Link2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type GroupByOption = 'none' | 'date' | 'source' | 'tags' | 'website'

interface GroupBySelectProps {
  value: GroupByOption
  onValueChange: (value: GroupByOption) => void
  className?: string
}

const groupByOptions = [
  { value: 'none' as const, label: 'None', icon: Layers, description: 'No grouping' },
  { value: 'date' as const, label: 'By Date', icon: Calendar, description: 'Today, This Week, etc.' },
  { value: 'source' as const, label: 'By Source', icon: Globe, description: 'YouTube, Reddit, etc.' },
  { value: 'tags' as const, label: 'By Tags', icon: Tags, description: 'First tag of each item' },
  { value: 'website' as const, label: 'By Website', icon: Link2, description: 'Group by domain' },
]

/**
 * GroupBySelect component - Compact dropdown for grouping options
 * Provides visual grouping controls with icons for better UX
 */
export function GroupBySelect({ value, onValueChange, className }: GroupBySelectProps) {
  const selectedOption = groupByOptions.find((opt) => opt.value === value)
  const SelectedIcon = selectedOption?.icon || Layers

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          'w-[140px] transition-all duration-200 ease-out',
          'hover:shadow-md hover:border-primary/50',
          'focus:ring-2 focus:ring-primary focus:ring-offset-2',
          'data-[state=open]:ring-2 data-[state=open]:ring-primary data-[state=open]:ring-offset-2',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <SelectedIcon className="h-4 w-4 text-muted-foreground" />
          <span>{selectedOption?.label || 'Group'}</span>
        </div>
      </SelectTrigger>
      <SelectContent
        className={cn(
          'animate-in fade-in-0 zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-200'
        )}
      >
        {groupByOptions.map((option) => {
          const Icon = option.icon
          const isSelected = value === option.value
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              className={cn(
                'cursor-pointer transition-colors duration-150',
                'focus:bg-accent focus:text-accent-foreground',
                isSelected && 'bg-accent/50'
              )}
            >
              <div className="flex items-center gap-3 py-0.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md',
                    'bg-muted/80 transition-colors duration-150',
                    isSelected && 'bg-primary/10 text-primary'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export default GroupBySelect
