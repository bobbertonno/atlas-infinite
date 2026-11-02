'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ClusterKind } from '@/lib/types'
import { KIND_LABEL, useDemo } from '../demo-context'

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-xl border bg-card p-5', className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3">
          {title ? <h3 className="font-semibold">{title}</h3> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function KindPanel({ kind, children, action, subtitle }: { kind: ClusterKind; children: ReactNode; action?: ReactNode; subtitle?: string }) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-xl border bg-card p-5', kind === 'core' ? 'border-core/30' : 'border-infinite/30')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', kind === 'core' ? 'bg-core' : 'bg-infinite')} aria-hidden="true" />
          <h3 className="font-semibold">{KIND_LABEL[kind]}</h3>
          {subtitle ? <span className="font-mono text-xs text-muted-foreground">{subtitle}</span> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Points({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((p) => (
        <li key={p.title} className="rounded-lg border bg-background/40 p-4">
          <p className="text-sm font-medium">{p.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
        </li>
      ))}
    </ul>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

/** Labels any output that is modeled rather than measured. */
export function SimulatedNote({ children }: { children?: ReactNode }) {
  const { live } = useDemo()
  return (
    <p className="rounded-md border border-dashed border-simulated/40 bg-simulated/5 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-semibold text-simulated">{live ? 'Illustrative' : 'Simulated'}: </span>
      {children ?? 'Values are produced by a deterministic model of architectural behavior. They are not measurements.'}
    </p>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}

export function useDetail() {
  const { cfg } = useDemo()
  const level = cfg.guided.detailLevel
  return { level, deep: level === 'deep', standard: level !== 'overview' }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
