import { FlaskConical, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DemoMode } from '@/lib/types'

export function ModeBadge({ mode, className }: { mode: DemoMode; className?: string }) {
  const live = mode === 'live'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        live ? 'border-live/50 bg-live/10 text-live' : 'border-simulated/50 bg-simulated/10 text-simulated',
        className,
      )}
    >
      {live ? <Radio className="size-3" aria-hidden="true" /> : <FlaskConical className="size-3" aria-hidden="true" />}
      {live ? 'Live Atlas' : 'Simulated'}
    </span>
  )
}

export function KindDot({ kind }: { kind: 'core' | 'infinite' }) {
  return <span className={cn('inline-block size-2.5 rounded-full', kind === 'core' ? 'bg-core' : 'bg-infinite')} aria-hidden="true" />
}

export function MongoLeaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 48" className={cn('h-6 w-3', className)} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.7 1.2 11.9 0c-.2.4-.4.7-.7 1.1C9.3 3.8 1.4 10.5.4 22.4c-.8 9.6 4.4 16.7 9 20.9l1.2.9.3 3.8h1.6l.4-3.8 1.1-.9c4.6-4.2 9.6-11.6 9.3-20.9-.5-11.6-8.6-18.6-10.6-21.2Zm-.3 40.2s-.2-15.7.4-15.7c.4 0 .9 20.3.9 20.3-.3 0-1.3-4.6-1.3-4.6Z"
      />
    </svg>
  )
}
