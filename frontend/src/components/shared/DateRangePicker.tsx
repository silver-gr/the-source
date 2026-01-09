import { useState } from "react";
import { format, subDays, subYears, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, X, CalendarRange } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRangeValue {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value?: DateRangeValue;
  onChange: (range: DateRangeValue | undefined) => void;
  className?: string;
}

type PresetKey = "24h" | "7d" | "30d" | "90d" | "year" | "custom";

interface Preset {
  label: string;
  shortLabel: string;
  getValue: () => DateRangeValue;
}

const presets: Record<Exclude<PresetKey, "custom">, Preset> = {
  "24h": {
    label: "Last 24h",
    shortLabel: "24h",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(new Date()),
    }),
  },
  "7d": {
    label: "Last 7 days",
    shortLabel: "7d",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 7)),
      to: endOfDay(new Date()),
    }),
  },
  "30d": {
    label: "Last 30 days",
    shortLabel: "30d",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 30)),
      to: endOfDay(new Date()),
    }),
  },
  "90d": {
    label: "Last 90 days",
    shortLabel: "90d",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 90)),
      to: endOfDay(new Date()),
    }),
  },
  year: {
    label: "Last year",
    shortLabel: "1y",
    getValue: () => ({
      from: startOfDay(subYears(new Date(), 1)),
      to: endOfDay(new Date()),
    }),
  },
};

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | null>(null);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined
  );

  const handlePresetClick = (key: PresetKey) => {
    if (key === "custom") {
      setSelectedPreset("custom");
      setOpen(true);
      return;
    }

    const range = presets[key].getValue();
    onChange(range);
    setSelectedPreset(key);
    setCalendarRange({ from: range.from, to: range.to });
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalendarRange(range);

    if (range?.from && range?.to) {
      onChange({
        from: startOfDay(range.from),
        to: endOfDay(range.to),
      });
      setSelectedPreset("custom");
      setOpen(false);
    }
  };

  const handleClear = () => {
    onChange(undefined);
    setSelectedPreset(null);
    setCalendarRange(undefined);
  };

  const formatDateRange = (range: DateRangeValue): string => {
    const fromYear = range.from.getFullYear();
    const toYear = range.to.getFullYear();
    const fromFormatted = format(range.from, "MMM d");
    const toFormatted =
      fromYear === toYear
        ? format(range.to, "MMM d, yyyy")
        : format(range.to, "MMM d, yyyy");

    return fromYear === toYear
      ? `${fromFormatted} - ${toFormatted}`
      : `${fromFormatted}, ${fromYear} - ${toFormatted}`;
  };

  // Shared button styles
  const presetButtonClasses = (isActive: boolean) =>
    cn(
      "transition-all duration-200 ease-out",
      "hover:scale-105 hover:shadow-md",
      "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      "active:scale-95",
      isActive && "shadow-md shadow-primary/20"
    );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Preset Buttons */}
        {(Object.keys(presets) as Array<Exclude<PresetKey, "custom">>).map(
          (key) => {
            const isActive = selectedPreset === key;
            return (
              <Button
                key={key}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetClick(key)}
                className={presetButtonClasses(isActive)}
              >
                <span className="hidden sm:inline">{presets[key].label}</span>
                <span className="sm:hidden">{presets[key].shortLabel}</span>
              </Button>
            );
          }
        )}

        {/* Custom Date Range Popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={selectedPreset === "custom" ? "default" : "outline"}
              size="sm"
              className={cn(
                "gap-2",
                presetButtonClasses(selectedPreset === "custom")
              )}
            >
              <CalendarIcon
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  open && "scale-110"
                )}
              />
              <span className="hidden sm:inline">Custom</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn(
              "w-auto p-0",
              "animate-in fade-in-0 zoom-in-95 duration-200",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            )}
            align="start"
          >
            <Calendar
              mode="range"
              selected={calendarRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              initialFocus
              className="rounded-md border-0"
            />
          </PopoverContent>
        </Popover>

        {/* Clear Button */}
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className={cn(
              "gap-1 text-muted-foreground",
              "hover:text-destructive hover:bg-destructive/10",
              "transition-all duration-200",
              "active:scale-95"
            )}
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
      </div>

      {/* Selected Range Display */}
      {value && (
        <div
          className={cn(
            "mt-2 flex items-center gap-2 text-sm",
            "text-muted-foreground",
            "animate-in fade-in-50 slide-in-from-top-1 duration-200"
          )}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          <span>{formatDateRange(value)}</span>
        </div>
      )}
    </div>
  );
}
