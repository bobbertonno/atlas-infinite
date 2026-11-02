'use client'

import { useId, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export function FieldShell({
  id,
  label,
  help,
  hint,
  error,
  children,
  className,
}: {
  id: string
  label: string
  help?: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {hint ? <span className="font-mono text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{help}</p>
      ) : null}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  help,
  error,
  placeholder,
  type = 'text',
  mono,
  autoComplete = 'off',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  help?: string
  error?: string | null
  placeholder?: string
  type?: string
  mono?: boolean
  autoComplete?: string
}) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error) || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(mono && 'font-mono text-xs')}
      />
    </FieldShell>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  help,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  help?: string
  suffix?: string
}) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} help={help} hint={suffix}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
          onChange(clamped)
        }}
        className="font-mono"
      />
    </FieldShell>
  )
}

export interface Option<T extends string> {
  value: T
  label: string
  disabled?: boolean
  note?: string
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  help,
  error,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
  help?: string
  error?: string | null
}) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <Select
        value={value}
        items={options.map((o) => ({ value: o.value, label: o.label }))}
        onValueChange={(v) => v && onChange(v as T)}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error) || undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              <span className="flex w-full items-center justify-between gap-3">
                <span>{o.label}</span>
                {o.note ? <span className="text-xs text-muted-foreground">{o.note}</span> : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  help,
  format = (v) => String(v),
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  help?: string
  format?: (v: number) => string
}) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} help={help} hint={format(value)}>
      <Slider
        id={id}
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? (v[0] as number) : (v as number))}
        className="py-2"
      />
    </FieldShell>
  )
}

export function SwitchField({
  label,
  checked,
  onChange,
  help,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  help?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {help ? <p className="text-xs leading-relaxed text-muted-foreground">{help}</p> : null}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  )
}

export function HelpCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex gap-3 rounded-lg border border-core/30 bg-core/5 p-4 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-core" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        <div className="leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </aside>
  )
}

export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  badge,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: ReactNode
  icon?: ReactNode
  badge?: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        selected && 'border-primary bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          {icon}
          {title}
        </div>
        {badge}
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
    </button>
  )
}
