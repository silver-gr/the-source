import * as React from 'react'
import { Search, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface TagsMultiSelectProps {
  selected: string[]
  availableTags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagsMultiSelect({
  selected,
  availableTags,
  onChange,
  placeholder = 'Filter by tags...',
}: TagsMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  const filteredTags = React.useMemo(() => {
    if (!searchQuery.trim()) return availableTags
    const query = searchQuery.toLowerCase()
    return availableTags.filter((tag) => tag.toLowerCase().includes(query))
  }, [availableTags, searchQuery])

  const handleTagToggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag))
    } else {
      onChange([...selected, tag])
    }
  }

  const handleClearAll = () => {
    onChange([])
    setSearchQuery('')
  }

  const getTriggerLabel = () => {
    if (selected.length === 0) return placeholder
    if (selected.length === 1) return selected[0]
    if (selected.length === 2) return selected.join(', ')
    return `${selected.length} tags selected`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            selected.length === 0 && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{getTriggerLabel()}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredTags.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No tags found
            </div>
          ) : (
            filteredTags.map((tag) => {
              const isSelected = selected.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-sm border',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="flex-1 text-left truncate">{tag}</span>
                </button>
              )
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="w-full justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-3 w-3" />
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
