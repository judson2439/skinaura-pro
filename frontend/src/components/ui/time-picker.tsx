import * as React from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  minuteStep?: number
}

export function TimePicker({
  value,
  onChange,
  placeholder = "Pick a time",
  className,
  disabled = false,
  minuteStep = 15,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Generate time options
  const timeOptions = React.useMemo(() => {
    const options: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += minuteStep) {
        const h = String(hour).padStart(2, '0')
        const m = String(minute).padStart(2, '0')
        options.push(`${h}:${m}`)
      }
    }
    return options
  }, [minuteStep])

  const formatTime = (time: string) => {
    if (!time) return placeholder
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const handleSelect = (time: string) => {
    onChange?.(time)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            "border-gray-200 hover:border-[#CFAFA3] hover:bg-transparent",
            "focus:ring-2 focus:ring-[#CFAFA3]/20 focus:border-[#CFAFA3]",
            "transition-all duration-200",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 text-[#CFAFA3]" />
          {value ? formatTime(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0 border-gray-200 shadow-lg" align="start">
        <ScrollArea className="h-64">
          <div className="p-1">
            {timeOptions.map((time) => (
              <button
                key={time}
                onClick={() => handleSelect(time)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left rounded-md transition-colors",
                  "hover:bg-[#CFAFA3]/10 hover:text-[#CFAFA3]",
                  value === time && "bg-[#CFAFA3] text-white hover:bg-[#CFAFA3] hover:text-white"
                )}
              >
                {formatTime(time)}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
