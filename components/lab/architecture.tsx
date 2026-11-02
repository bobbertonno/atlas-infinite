'use client'

import { Cpu, Database, HardDrive, Layers, ScrollText, Archive, Eye } from 'lucide-react'
import { tierInfo } from '@/lib/catalog'
import { cn } from '@/lib/utils'
import type { ClusterConfig } from '@/lib/types'

type Highlight = 'none' | 'write' | 'read' | 'cold-read' | 'scale-read' | 'encrypt'

function NodeBox({
  title,
  subtitle,
  tone,
  dashed,
  active,
  icon: Icon = Cpu,
}: {
  title: string
  subtitle?: string
  tone: 'core' | 'infinite' | 'muted'
  dashed?: boolean
  active?: boolean
  icon?: typeof Cpu
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border bg-background/60 px-2 py-2.5 text-center transition-all',
        tone === 'core' && 'border-core/50',
        tone === 'infinite' && 'border-infinite/50',
        dashed && 'border-dashed',
        active && tone === 'core' && 'bg-core/15 ring-2 ring-core/60',
        active && tone === 'infinite' && 'bg-infinite/15 ring-2 ring-infinite/60',
      )}
    >
      <Icon className={cn('size-4', tone === 'core' ? 'text-core' : tone === 'infinite' ? 'text-infinite' : 'text-muted-foreground')} aria-hidden="true" />
      <span className="truncate text-xs font-semibold">{title}</span>
      {subtitle ? <span className="truncate font-mono text-[10px] text-muted-foreground">{subtitle}</span> : null}
    </div>
  )
}

function Connector({ active, tone, vertical = true }: { active?: boolean; tone: 'core' | 'infinite'; vertical?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        vertical ? 'mx-auto h-5 w-0.5' : 'my-auto h-0.5 w-6',
        tone === 'core' ? 'text-core' : 'text-infinite',
        active ? (vertical ? 'flow-line-y' : 'flow-line') : 'bg-border',
      )}
    />
  )
}

export function CoreDiagram({ cluster, highlight = 'none', extraMembers = 0, syncProgress }: {
  cluster: ClusterConfig
  highlight?: Highlight
  extraMembers?: number
  syncProgress?: number
}) {
  const tier = tierInfo(cluster.tier)
  const writing = highlight === 'write'
  const reading = highlight === 'read' || highlight === 'cold-read'
  const members = ['Primary', 'Secondary', 'Secondary']
  return (
    <figure className="flex flex-col gap-3" aria-label="Atlas Core replica set architecture">
      <div className="flex items-center justify-center">
        <span className="rounded-md border bg-muted px-3 py-1 text-xs font-medium">Application / Driver</span>
      </div>
      <Connector tone="core" active={writing || reading} />
      <div className="flex gap-2">
        {members.map((role, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <NodeBox
              title={role}
              subtitle={`${tier.id} · AZ${i + 1}`}
              tone="core"
              active={(writing && (i === 0 || i === 1)) || (reading && i === 0) || highlight === 'encrypt'}
            />
            <Connector tone="core" active={writing || (highlight === 'cold-read' && i === 0)} />
            <NodeBox
              title="Local volume"
              subtitle={cluster.diskSizeGB ? `${cluster.diskSizeGB} GB` : undefined}
              tone="muted"
              icon={HardDrive}
              active={highlight === 'encrypt'}
            />
          </div>
        ))}
        {Array.from({ length: extraMembers }).map((_, i) => (
          <div key={`x${i}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <NodeBox title="New member" subtitle={tier.id} tone="core" dashed active={highlight === 'scale-read'} />
            <Connector tone="core" active={syncProgress !== undefined && syncProgress < 100} />
            <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-2 py-2.5 text-center">
              <span className="text-[10px] font-medium text-muted-foreground">Initial sync</span>
              <span className="font-mono text-xs">{Math.round(syncProgress ?? 0)}%</span>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        {3 + extraMembers} members · {3 + extraMembers} full copies of data · oplog replication
      </figcaption>
    </figure>
  )
}

export function InfiniteDiagram({
  cluster,
  highlight = 'none',
  readOnlyNodes,
}: {
  cluster: ClusterConfig
  highlight?: Highlight
  readOnlyNodes?: number
}) {
  const tier = tierInfo(cluster.tier)
  const ro = readOnlyNodes ?? cluster.readOnlyNodes
  const writing = highlight === 'write'
  const reading = highlight === 'read'
  const cold = highlight === 'cold-read'
  const enc = highlight === 'encrypt'
  return (
    <figure className="flex flex-col gap-3" aria-label="Atlas Infinite disaggregated architecture">
      <div className="flex items-center justify-center">
        <span className="rounded-md border bg-muted px-3 py-1 text-xs font-medium">Application / Driver</span>
      </div>
      <Connector tone="infinite" active={writing || reading || cold || highlight === 'scale-read'} />
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-[2] gap-2 rounded-xl border border-infinite/30 p-2">
          <NodeBox title="Primary" subtitle={`${tier.id} · compute`} tone="infinite" active={writing || reading || cold || enc} />
          <NodeBox title="Standby" subtitle={`${tier.id} · compute`} tone="infinite" active={enc} />
        </div>
        {ro > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap gap-2 rounded-xl border border-dashed border-infinite/30 p-2">
            {Array.from({ length: ro }).map((_, i) => (
              <NodeBox key={i} title={`Read-only ${i + 1}`} subtitle="attached" tone="infinite" dashed icon={Eye} active={highlight === 'scale-read' || enc} />
            ))}
          </div>
        ) : null}
      </div>
      <Connector tone="infinite" active={writing || cold || highlight === 'scale-read'} />
      <div className="flex flex-col gap-2 rounded-xl border border-infinite/40 bg-infinite/5 p-2">
        <span className="text-center text-[11px] font-semibold uppercase tracking-wider text-infinite">Shared disaggregated storage</span>
        <div className="flex gap-2">
          <NodeBox title="Log service" subtitle="write consensus" tone="infinite" icon={ScrollText} active={writing || enc} />
          <NodeBox title="Page service" subtitle="page reads" tone="infinite" icon={Layers} active={cold || highlight === 'scale-read' || enc} />
          <NodeBox title="Object store" subtitle="durability" tone="infinite" icon={Archive} active={enc} />
        </div>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        2 base compute nodes{ro > 0 ? ` + ${ro} read-only` : ''} · 1 logical copy in shared storage
      </figcaption>
    </figure>
  )
}

export function ArchitecturePair({
  core,
  infinite,
  highlight,
  className,
}: {
  core: ClusterConfig
  infinite: ClusterConfig
  highlight?: Highlight
  className?: string
}) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      <div className="flex flex-col gap-3 rounded-xl border border-core/30 bg-card p-4">
        <header className="flex items-center gap-2">
          <Database className="size-4 text-core" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Atlas Core Gen1</h3>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{core.name}</span>
        </header>
        <CoreDiagram cluster={core} highlight={highlight} />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-infinite/30 bg-card p-4">
        <header className="flex items-center gap-2">
          <Database className="size-4 text-infinite" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Atlas Infinite</h3>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{infinite.name}</span>
        </header>
        <InfiniteDiagram cluster={infinite} highlight={highlight} />
      </div>
    </div>
  )
}
