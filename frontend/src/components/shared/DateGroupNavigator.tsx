import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

interface DateGroupNavigatorProps {
  selectedYear: number
  selectedMonth: number | null // null = show all months for the year
  availableYears: number[] // [2026, 2025, 2024, ...] sorted desc
  availableMonths: number[] // Months with items for selected year [1, 2, 3, 6, 12]
  onYearChange: (year: number) => void
  onMonthChange: (month: number | null) => void
  className?: string
}

export function DateGroupNavigator({
  selectedYear,
  selectedMonth,
  availableYears,
  availableMonths,
  onYearChange,
  onMonthChange,
  className,
}: DateGroupNavigatorProps) {
  // Year navigation logic
  const yearIndex = availableYears.indexOf(selectedYear)
  const canGoPrevYear = yearIndex < availableYears.length - 1
  const canGoNextYear = yearIndex > 0

  // Month navigation logic
  const monthIndex =
    selectedMonth !== null ? availableMonths.indexOf(selectedMonth) : -1
  const canGoPrevMonth =
    selectedMonth === null
      ? canGoPrevYear // If "All Months", can go to prev year
      : monthIndex < availableMonths.length - 1 || canGoPrevYear
  const canGoNextMonth =
    selectedMonth === null
      ? false // At "All Months", there's nothing "next"
      : monthIndex > 0 || (monthIndex === 0 && selectedMonth !== null)

  const handlePrevYear = () => {
    if (canGoPrevYear) {
      onYearChange(availableYears[yearIndex + 1])
      onMonthChange(null) // Reset to "All Months" when changing year
    }
  }

  const handleNextYear = () => {
    if (canGoNextYear) {
      onYearChange(availableYears[yearIndex - 1])
      onMonthChange(null) // Reset to "All Months" when changing year
    }
  }

  const handlePrevMonth = () => {
    if (selectedMonth === null) {
      // At "All Months", go to last available month (oldest)
      if (availableMonths.length > 0) {
        onMonthChange(availableMonths[availableMonths.length - 1])
      }
      return
    }

    if (monthIndex < availableMonths.length - 1) {
      // Go to previous available month in current year
      onMonthChange(availableMonths[monthIndex + 1])
    } else {
      // At oldest month, wrap back to "All Months"
      onMonthChange(null)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === null) {
      // At "All Months", go to first specific month
      if (availableMonths.length > 0) {
        onMonthChange(availableMonths[0])
      }
      return
    }

    if (monthIndex > 0) {
      // Go to next available month in current year
      onMonthChange(availableMonths[monthIndex - 1])
    } else {
      // At newest month, go to "All Months" view
      onMonthChange(null)
    }
  }

  const handleYearChange = (value: string) => {
    onYearChange(Number(value))
    onMonthChange(null) // Reset to "All Months" when changing year
  }

  const handleMonthChange = (value: string) => {
    if (value === 'all') {
      onMonthChange(null)
    } else {
      onMonthChange(Number(value))
    }
  }

  // Get display label for selected month
  const getMonthLabel = () => {
    if (selectedMonth === null) return 'All Months'
    return MONTH_NAMES[selectedMonth - 1]
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Year navigation section */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevYear}
          disabled={!canGoPrevYear}
          className={cn(
            'h-8 w-8 shrink-0',
            'transition-all duration-200 ease-out',
            'hover:scale-105 hover:bg-accent',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'active:scale-95',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
          )}
          aria-label="Previous year"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Select value={String(selectedYear)} onValueChange={handleYearChange}>
          <SelectTrigger
            className={cn(
              'w-[100px]',
              'transition-all duration-200 ease-out',
              'hover:shadow-md hover:border-primary/50',
              'focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'data-[state=open]:ring-2 data-[state=open]:ring-primary data-[state=open]:ring-offset-2'
            )}
          >
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{selectedYear}</span>
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
            {availableYears.map((year) => (
              <SelectItem
                key={year}
                value={String(year)}
                className={cn(
                  'cursor-pointer transition-colors duration-150',
                  'focus:bg-accent focus:text-accent-foreground',
                  year === selectedYear && 'bg-accent/50'
                )}
              >
                <span className="font-medium">{year}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextYear}
          disabled={!canGoNextYear}
          className={cn(
            'h-8 w-8 shrink-0',
            'transition-all duration-200 ease-out',
            'hover:scale-105 hover:bg-accent',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'active:scale-95',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
          )}
          aria-label="Next year"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Month navigation section */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          disabled={!canGoPrevMonth}
          className={cn(
            'h-8 w-8 shrink-0',
            'transition-all duration-200 ease-out',
            'hover:scale-105 hover:bg-accent',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'active:scale-95',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
          )}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Select
          value={selectedMonth === null ? 'all' : String(selectedMonth)}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger
            className={cn(
              'w-[130px]',
              'transition-all duration-200 ease-out',
              'hover:shadow-md hover:border-primary/50',
              'focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'data-[state=open]:ring-2 data-[state=open]:ring-primary data-[state=open]:ring-offset-2'
            )}
          >
            <SelectValue>
              <span className="font-medium">{getMonthLabel()}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            className={cn(
              'animate-in fade-in-0 zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              'duration-200'
            )}
          >
            {/* "All Months" option */}
            <SelectItem
              value="all"
              className={cn(
                'cursor-pointer transition-colors duration-150',
                'focus:bg-accent focus:text-accent-foreground',
                selectedMonth === null && 'bg-accent/50'
              )}
            >
              <span className="font-medium">All Months</span>
            </SelectItem>

            {/* Available months for the selected year */}
            {availableMonths.map((month) => (
              <SelectItem
                key={month}
                value={String(month)}
                className={cn(
                  'cursor-pointer transition-colors duration-150',
                  'focus:bg-accent focus:text-accent-foreground',
                  month === selectedMonth && 'bg-accent/50'
                )}
              >
                <span className="font-medium">{MONTH_NAMES[month - 1]}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          disabled={!canGoNextMonth}
          className={cn(
            'h-8 w-8 shrink-0',
            'transition-all duration-200 ease-out',
            'hover:scale-105 hover:bg-accent',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'active:scale-95',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
          )}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
