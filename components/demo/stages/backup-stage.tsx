'use client'

import { useEffect, useMemo, useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { estimateDataset, formatBytes } from '@/lib/dataset'
import type { ClusterKind } from '@/lib/types'
import { clusterOf, useDemo } from '../demo-context'
import { KindPanel, SimulatedNote } from './primitives'

const STEPS: Record<ClusterKind, string[]> = {
  core: ['Select nearest snapshot before target', 'Restore snapshot volumes to each member', 'Replay oplog to the exact second', 'Members rejoin and elect primary'],
  infinite: ['Locate log position for target time', 'Materialize pages as of that position', 'Attach compute to restored storage', 'Primary and Standby online'],
}

export function BackupStage() {
  const { cfg, speed } = useDemo()
  const windowHours = 24
  const [hoursAgo, setHoursAgo] = useState(3)
  const [progress, setProgress] = useState<Record<ClusterKind, number> | null>(null)
  const bytes = estimateDataset(cfg.dataset).logicalBytes
  const target = useMemo(() => new Date(Date.now() - hoursAgo * 3600_000), [hoursAgo])

  useEffect(() => {
    if (!progress || (progress.core >= 100 && progress.infinite >= 100)) return
    const id = setTimeout(
      () => setProgress((p) => p && { core: Math.min(100, p.core + 3 * speed), infinite: Math.min(100, p.infinite + 3.4 * speed) }),
      150,
    )
    return () => clearTimeout(id)
  }, [progress, speed])

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold">Point-in-time restore target</h3>
          </div>
          <span className="font-mono text-sm">
            {target.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ({hoursAgo}h ago)
          </span>
        </div>
        <Slider value={[windowHours - hoursAgo]} min={0} max={windowHours} step={1} onValueChange={(v) => setHoursAgo(windowHours - (Array.isArray(v) ? v[0] : v))} aria-label="Restore point" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{windowHours}h ago</span>
          <span>Now</span>
        </div>
        <Button className="self-start" onClick={() => setProgress({ core: 0, infinite: 0 })}>
          <RotateCcw data-icon="inline-start" />
          Restore both to this point
        </Button>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {(['core', 'infinite'] as const).map((k) => {
          const c = clusterOf(cfg, k)
          const p = progress?.[k] ?? 0
          return (
            <KindPanel key={k} kind={k} subtitle={`${c.name}-restore`}>
              <p className="text-xs text-muted-foreground">
                Backup {c.backupEnabled ? 'enabled' : 'disabled'} · PITR {c.pitrEnabled ? 'enabled' : 'disabled'} · {formatBytes(bytes)} logical
              </p>
              <Progress value={p} aria-label={`${k} restore progress`} />
              <ol className="flex flex-col gap-2">
                {STEPS[k].map((s, i) => {
                  const done = p >= ((i + 1) / STEPS[k].length) * 100
                  const active = !done && p >= (i / STEPS[k].length) * 100 && progress
                  return (
                    <li key={s} className="flex gap-3 text-sm">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${done ? 'bg-primary' : active ? 'animate-pulse bg-foreground' : 'bg-muted'}`} aria-hidden="true" />
                      <span className={done || active ? '' : 'text-muted-foreground'}>{s}</span>
                    </li>
                  )
                })}
              </ol>
            </KindPanel>
          )
        })}
      </div>
      <SimulatedNote>
        Restore is animated and runs to a new cluster name so the source is never overwritten. Real restore duration depends on data size,
        tier and region.
      </SimulatedNote>
    </div>
  )
}
