import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface CustomSelectProps {
  value?: string
  onChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
  triggerClassName?: string
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className,
  disabled = false,
  triggerClassName,
}: CustomSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find(opt => opt.value === value)

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal h-10",
            "border-gray-200 hover:border-[#CFAFA3] hover:bg-transparent",
            "focus:ring-2 focus:ring-[#CFAFA3]/20 focus:border-[#CFAFA3]",
            "transition-all duration-200",
            !value && "text-muted-foreground",
            triggerClassName,
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={cn(
            "ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200",
            open && "rotate-180"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 border-gray-200 shadow-lg" 
        align="start"
      >
        <ScrollArea className={cn(options.length > 8 ? "h-64" : "h-auto")}>
          <div className="p-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => !option.disabled && handleSelect(option.value)}
                disabled={option.disabled}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left rounded-md transition-colors flex items-center justify-between",
                  "hover:bg-[#CFAFA3]/10 hover:text-[#CFAFA3]",
                  value === option.value && "bg-[#CFAFA3]/10 text-[#CFAFA3]",
                  option.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-inherit"
                )}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value && (
                  <Check className="h-4 w-4 text-[#CFAFA3] shrink-0" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// Helper function to convert simple string array to options
export function createOptions(items: string[]): SelectOption[] {
  return items.map(item => ({ value: item, label: item }))
}
