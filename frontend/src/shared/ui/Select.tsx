import { useState, useRef, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Menu, type MenuItem } from './Menu'

export interface SelectOption {
  value: string | number
  label: string
}

export interface SelectProps {
  value: string | number
  onChange: (value: string | number) => void
  options: SelectOption[]
  className?: string
  placeholder?: string
  icon?: ReactNode
  disabled?: boolean
  hideChevron?: boolean
}

export function Select({
  value,
  onChange,
  options,
  className,
  placeholder,
  icon,
  disabled,
  hideChevron,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selectedOption = options.find((opt) => opt.value === value || String(opt.value) === String(value))
  const displayLabel = selectedOption?.label ?? placeholder ?? ''

  const menuItems: MenuItem[] = options.map((opt) => ({
    id: String(opt.value),
    label: opt.label,
    onSelect: () => onChange(opt.value),
  }))

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 rounded-md border border-transparent bg-surface-hover px-3 py-1.5 text-sm text-content-primary transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:pointer-events-none',
          className
        )}
      >
        {icon}
        <span className="flex-1 text-left truncate">{displayLabel}</span>
        {!hideChevron && <ChevronDown size={16} className="text-content-secondary shrink-0 pointer-events-none" />}
      </button>

      <Menu
        open={open}
        onClose={() => setOpen(false)}
        items={menuItems}
        anchorRef={buttonRef}
        align="left"
        className="min-w-fit"
      />
    </>
  )
}
