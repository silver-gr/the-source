import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type SortField = 'saved_at' | 'synced_at' | 'created_at' | 'title' | 'priority'
type SortOrder = 'asc' | 'desc'

interface SortSelectProps {
  sortBy: SortField
  sortOrder: SortOrder
  onChange: (sortBy: string, sortOrder: SortOrder) => void
}

const sortOptions: { value: SortField; label: string; description: string }[] = [
  { value: 'saved_at', label: 'Date Saved', description: 'When you saved it' },
  { value: 'synced_at', label: 'Date Synced', description: 'Last sync time' },
  { value: 'created_at', label: 'Created', description: 'Original date' },
  { value: 'title', label: 'Title', description: 'Alphabetical' },
  { value: 'priority', label: 'Priority', description: 'By importance' },
]

export function SortSelect({ sortBy, sortOrder, onChange }: SortSelectProps) {
  const handleSortByChange = (value: string) => {
    onChange(value, sortOrder)
  }

  const handleToggleOrder = () => {
    onChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')
  }

  const currentLabel =
    sortOptions.find((opt) => opt.value === sortBy)?.label ?? 'Sort'

  return (
    <div className="flex items-center gap-1">
      <Select value={sortBy} onValueChange={handleSortByChange}>
        <SelectTrigger
          className={cn(
            'w-[140px]',
            'transition-all duration-200 ease-out',
            'hover:shadow-md hover:border-primary/50',
            'focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'data-[state=open]:ring-2 data-[state=open]:ring-primary data-[state=open]:ring-offset-2'
          )}
        >
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span>{currentLabel}</span>
              <span className="text-muted-foreground text-xs">
                {sortOrder === 'asc' ? '(A-Z)' : '(Z-A)'}
              </span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          className={cn(
            'animate-in fade-in-0 zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'duration-200'
          )}
        >
          {sortOptions.map((option) => {
            const isSelected = sortBy === option.value
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
                <div className="flex flex-col py-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={handleToggleOrder}
        className={cn(
          'h-9 w-9 shrink-0',
          'transition-all duration-200 ease-out',
          'hover:scale-105 hover:shadow-md hover:bg-accent',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'active:scale-95'
        )}
        aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
      >
        <ArrowUpDown
          className={cn(
            'h-4 w-4 transition-transform duration-300 ease-out',
            sortOrder === 'desc' && 'rotate-180'
          )}
        />
      </Button>
    </div>
  )
}
