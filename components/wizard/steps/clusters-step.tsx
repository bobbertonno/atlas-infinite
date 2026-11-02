'use client'

import { Database } from 'lucide-react'
import { CoreDiagram, InfiniteDiagram } from '@/components/lab/architecture'
import { HelpCallout, NumberField, SelectField, SliderField, SwitchField, TextField } from '@/components/lab/fields'
import { AWS_REGIONS, TIERS, tierIndex } from '@/lib/catalog'
import type { ClusterConfig } from '@/lib/types'
import type { StepProps } from '../wizard'

function ClusterForm({
  cluster,
  onChange,
  live,
}: {
  cluster: ClusterConfig
  onChange: (next: ClusterConfig) => void
  live: boolean
}) {
  const isCore = cluster.kind === 'core'
  const set = <K extends keyof ClusterConfig>(k: K, v: ClusterConfig[K]) => onChange({ ...cluster, [k]: v })
  const tiers = TIERS.filter((t) => (isCore ? t.core : t.infinite))
  const tierOptions = tiers.map((t) => ({ value: t.id, label: t.id, note: `${t.vcpu} vCPU · ${t.ramGB} GB` }))
  const regionOptions = AWS_REGIONS.map((r) => ({
    value: r.id,
    label: r.label,
    disabled: !isCore && !r.infinite,
    note: !isCore && !r.infinite ? 'not available' : `${r.azs} AZs`,
  }))
  const sourceLocked = live && !isCore

  return (
    <section
      className={`flex flex-col gap-4 rounded-xl border bg-card p-5 ${isCore ? 'border-core/30' : 'border-infinite/30'}`}
      aria-labelledby={`${cluster.kind}-heading`}
    >
      <header className="flex items-center gap-2">
        <Database className={`size-4 ${isCore ? 'text-core' : 'text-infinite'}`} aria-hidden="true" />
        <h2 id={`${cluster.kind}-heading`} className="font-semibold">
          {isCore ? 'Atlas Core Gen1' : 'Atlas Infinite'}
        </h2>
        <span className="ml-auto rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{isCore ? 'Replica set · Gen1' : 'Infinite · Gen2'}</span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Cluster name" value={cluster.name} onChange={(v) => set('name', v.trim())} mono />
        <SelectField<'new' | 'existing'>
          label="Source"
          value={sourceLocked ? 'existing' : cluster.source}
          onChange={(v) => set('source', v)}
          options={[
            { value: 'new', label: 'Provision new cluster', disabled: sourceLocked },
            { value: 'existing', label: 'Attach existing cluster' },
          ]}
          help={sourceLocked ? 'Create the Infinite deployment in Atlas, then attach it here by name.' : undefined}
        />
        <SelectField label="Region" value={cluster.region} onChange={(v) => set('region', v)} options={regionOptions} />
        <SelectField
          label="Instance tier"
          value={cluster.tier}
          onChange={(v) => {
            const idx = tierIndex(v)
            onChange({
              ...cluster,
              tier: v,
              autoScaleMinTier: tierIndex(cluster.autoScaleMinTier) > idx ? v : cluster.autoScaleMinTier,
              autoScaleMaxTier: tierIndex(cluster.autoScaleMaxTier) < idx ? v : cluster.autoScaleMaxTier,
            })
          }}
          options={tierOptions}
        />
      </div>

      {isCore ? (
        <NumberField
          label="Storage per member"
          value={cluster.diskSizeGB}
          onChange={(v) => set('diskSizeGB', v)}
          min={10}
          max={4096}
          suffix="GB × 3 members"
          help="Each of the three members provisions its own volume with this capacity."
        />
      ) : (
        <div className="rounded-lg border border-infinite/30 bg-infinite/5 p-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Shared disaggregated storage.</span> Capacity grows elastically with the data and is
          independent of the compute tier, so there is no per-node volume to size.
        </div>
      )}

      {!isCore ? (
        <SliderField
          label="Read-only nodes"
          value={cluster.readOnlyNodes}
          onChange={(v) => set('readOnlyNodes', v)}
          min={0}
          max={5}
          help="Additional read capacity that attaches to shared storage without copying data. Start at zero and add nodes during the demo."
        />
      ) : null}

      <div className="grid gap-2">
        <SwitchField
          label="Cloud backup"
          checked={cluster.backupEnabled}
          onChange={(v) => onChange({ ...cluster, backupEnabled: v, pitrEnabled: v ? cluster.pitrEnabled : false })}
        />
        <SwitchField
          label="Continuous backup (PITR)"
          checked={cluster.pitrEnabled}
          disabled={!cluster.backupEnabled}
          onChange={(v) => set('pitrEnabled', v)}
          help={isCore ? 'Snapshots plus oplog replay to any second in the restore window.' : 'Point-in-time restore from the shared log and storage layer.'}
        />
        <SwitchField
          label={isCore ? 'Storage auto-scaling' : 'Elastic storage'}
          checked={isCore ? cluster.autoScaleDisk : true}
          disabled={!isCore}
          onChange={(v) => set('autoScaleDisk', v)}
          help={isCore ? 'Grow member volumes automatically when 90% full.' : 'Always on: storage scales with the data independent of compute.'}
        />
        <SwitchField label="Compute auto-scaling" checked={cluster.autoScaleCompute} onChange={(v) => set('autoScaleCompute', v)} />
        {cluster.autoScaleCompute ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Minimum tier" value={cluster.autoScaleMinTier} onChange={(v) => set('autoScaleMinTier', v)} options={tierOptions} />
            <SelectField label="Maximum tier" value={cluster.autoScaleMaxTier} onChange={(v) => set('autoScaleMaxTier', v)} options={tierOptions} />
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-background/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Architecture preview</p>
        {isCore ? <CoreDiagram cluster={cluster} /> : <InfiniteDiagram cluster={cluster} />}
      </div>
    </section>
  )
}

export function ClustersStep({ cfg, update }: StepProps) {
  const live = cfg.mode === 'live'
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ClusterForm cluster={cfg.core} onChange={(c) => update('core', c)} live={live} />
        <ClusterForm cluster={live ? { ...cfg.infinite, source: 'existing' } : cfg.infinite} onChange={(c) => update('infinite', c)} live={live} />
      </div>
      <HelpCallout title="Two architectures, one API">
        Atlas Core runs three electable members that each hold a complete copy of the data on their own volume. Atlas Infinite runs exactly
        two base compute nodes, a Primary and a Standby, over shared storage that keeps one logical copy durable across availability zones.
        The two are distinct deployment types: the lab never assumes an in-place conversion between them. Only combinations available in
        the offline catalog are selectable; in Live mode, region and tier support is re-checked against the Atlas Admin API.
      </HelpCallout>
    </div>
  )
}
