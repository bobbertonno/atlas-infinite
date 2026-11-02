'use client'

import { useState } from 'react'
import { Lock, KeyRound, ShieldCheck, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ArchitecturePair, CoreDiagram, InfiniteDiagram } from '@/components/lab/architecture'
import { tierInfo } from '@/lib/catalog'
import { useDemo } from '../demo-context'
import { KindPanel, Panel, Points, useDetail } from './primitives'

export function CoreArchitectureStage() {
  const { cfg } = useDemo()
  const { deep } = useDetail()
  const tier = tierInfo(cfg.core.tier)
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <KindPanel kind="core" subtitle={`${cfg.core.name} · ${cfg.core.tier}`}>
        <CoreDiagram cluster={cfg.core} highlight="write" />
      </KindPanel>
      <div className="flex flex-col gap-4">
        <Points
          items={[
            { title: 'Three full copies', body: 'Each electable member stores the complete dataset on its own volume, spread across availability zones.' },
            { title: 'Automatic failover', body: 'If the primary becomes unavailable, the remaining members elect a new primary in seconds.' },
            { title: 'Predictable resources', body: `Each ${tier.id} member provides ${tier.vcpu} vCPU and ${tier.ramGB} GB RAM with locally attached storage.` },
            { title: 'Mature ecosystem', body: 'The most widely deployed Atlas architecture, supported by every tool, driver and feature.' },
          ]}
        />
        {deep ? (
          <Panel title="Architect detail">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Durability is achieved through replication: a write acknowledged with majority write concern is persisted on two of three
              members. Storage capacity is provisioned per member, so a {cfg.core.diskSizeGB} GB setting means {cfg.core.diskSizeGB * 3} GB of
              provisioned volume across the replica set.
            </p>
          </Panel>
        ) : null}
      </div>
    </div>
  )
}

export function InfiniteArchitectureStage() {
  const { cfg } = useDemo()
  const { deep } = useDetail()
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <KindPanel kind="infinite" subtitle={`${cfg.infinite.name} · ${cfg.infinite.tier}`}>
        <InfiniteDiagram cluster={cfg.infinite} highlight="write" />
      </KindPanel>
      <div className="flex flex-col gap-4">
        <Points
          items={[
            { title: 'Primary and Standby', body: 'Two base compute nodes. The Standby takes over if the Primary fails, without copying data.' },
            { title: 'Shared storage', body: 'A disaggregated storage layer holds one logical copy of the data with its own durability guarantees.' },
            { title: 'Elastic storage', body: 'Storage grows with your data. There is no per-node volume to size in advance.' },
            { title: 'Same developer experience', body: 'Drivers, query language, indexes and connection strings are the same as Atlas Core.' },
          ]}
        />
        {deep ? (
          <Panel title="Architect detail">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writes are made durable by a log service that reaches consensus across availability zones. A page service materializes pages from
              the log and serves them to compute nodes on cache misses, and an object store provides long-term durability. Compute nodes hold
              cache, not the system of record.
            </p>
          </Panel>
        ) : null}
      </div>
    </div>
  )
}

const PATHS = {
  write: {
    label: 'Write path',
    core: ['Driver sends the write to the primary', 'Primary applies it and writes the oplog entry', 'Secondaries replicate the oplog entry', 'Majority acknowledges, the client receives success'],
    infinite: ['Driver sends the write to the Primary compute node', 'Primary appends the change to the log service', 'Log service reaches consensus across zones', 'Acknowledged; pages are materialized asynchronously'],
  },
  read: {
    label: 'Cached read',
    core: ['Driver routes by read preference', 'Member serves the document from WiredTiger cache', 'No disk access needed'],
    infinite: ['Driver routes by read preference', 'Compute node serves the document from its local cache', 'No storage access needed'],
  },
  'cold-read': {
    label: 'Cache-miss read',
    core: ['Member misses in cache', 'Page is read from its local volume', 'Page enters cache for future reads'],
    infinite: ['Compute node misses in cache', 'Page is fetched from the page service', 'Page enters cache; any node can fetch the same page'],
  },
} as const

type PathId = keyof typeof PATHS

export function ReadWritePathsStage() {
  const { cfg } = useDemo()
  const [path, setPath] = useState<PathId>('write')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Select path">
        {(Object.keys(PATHS) as PathId[]).map((p) => (
          <Button key={p} variant={p === path ? 'default' : 'outline'} size="sm" onClick={() => setPath(p)} aria-pressed={p === path}>
            {PATHS[p].label}
          </Button>
        ))}
      </div>
      <ArchitecturePair core={cfg.core} infinite={cfg.infinite} highlight={path} />
      <div className="grid gap-4 md:grid-cols-2">
        {(['core', 'infinite'] as const).map((kind) => (
          <KindPanel key={kind} kind={kind}>
            <ol className="flex flex-col gap-2">
              {PATHS[path][kind].map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs">{i + 1}</span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </KindPanel>
        ))}
      </div>
    </div>
  )
}

const LAYERS = [
  { icon: Network, title: 'In transit', body: 'TLS 1.2+ is enforced between drivers and nodes, and between internal components on both architectures.' },
  { icon: Lock, title: 'At rest', body: 'Core encrypts each member volume. Infinite encrypts log segments, pages and objects in shared storage.' },
  { icon: KeyRound, title: 'Customer-managed keys', body: 'Bring your own key through AWS KMS on both architectures, with rotation controlled by your organization.' },
  { icon: ShieldCheck, title: 'In use', body: 'Queryable Encryption and Client-Side Field Level Encryption work identically: data is encrypted before it leaves the application.' },
]

export function EncryptionStage() {
  const { cfg } = useDemo()
  return (
    <div className="flex flex-col gap-6">
      <ArchitecturePair core={cfg.core} infinite={cfg.infinite} highlight="encrypt" />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LAYERS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
