'use client'

import { useEffect, useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { CoreDiagram, InfiniteDiagram } from '@/components/lab/architecture'
import { TIERS, tierInfo } from '@/lib/catalog'
import { estimateDataset, formatBytes, formatDuration } from '@/lib/dataset'
import { initialSyncSeconds, readCapacityMultiplier, READ_ONLY_ATTACH_SECONDS } from '@/lib/simulation'
import { useDemo } from '../demo-context'
import { KindPanel, Points, SimulatedNote, Stat } from './primitives'

export function ReadScalingStage() {
  const { cfg, speed } = useDemo()
  const [ro, setRo] = useState(cfg.infinite.readOnlyNodes)
  const [extraCore, setExtraCore] = useState(0)
  const [sync, setSync] = useState<number | undefined>(undefined)
  const bytes = estimateDataset(cfg.dataset).logicalBytes
  const readW = { ...cfg.workload, readPreference: 'secondaryPreferred' as const }

  useEffect(() => {
    if (sync === undefined || sync >= 1) return
    const id = setTimeout(() => setSync((s) => Math.min(1, (s ?? 0) + 0.05 * speed)), 150)
    return () => clearTimeout(id)
  }, [sync, speed])

  const sizes = [10, 100, 1000, 5000].map((gb) => gb * 1024 ** 3)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <KindPanel
          kind="core"
          action={
            <Button size="sm" variant="outline" onClick={() => { setExtraCore(1); setSync(0) }} disabled={extraCore > 0 && (sync ?? 0) < 1}>
              <Plus data-icon="inline-start" />
              Add secondary
            </Button>
          }
        >
          <CoreDiagram cluster={cfg.core} highlight="scale-read" extraMembers={extraCore} syncProgress={sync} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Read capacity" value={`${(readCapacityMultiplier(cfg.core, readW) * (1 + extraCore * 0.3)).toFixed(2)}×`} />
            <Stat label="Initial sync (this dataset)" value={formatDuration(initialSyncSeconds(bytes))} hint="Copies the full dataset" />
          </div>
        </KindPanel>
        <KindPanel
          kind="infinite"
          action={
            <div className="flex gap-1">
              <Button size="icon-sm" variant="outline" onClick={() => setRo((n) => Math.max(0, n - 1))} aria-label="Remove read-only node">
                <Minus />
              </Button>
              <Button size="icon-sm" variant="outline" onClick={() => setRo((n) => Math.min(5, n + 1))} aria-label="Add read-only node">
                <Plus />
              </Button>
            </div>
          }
        >
          <InfiniteDiagram cluster={cfg.infinite} highlight="scale-read" readOnlyNodes={ro} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Read capacity" value={`${readCapacityMultiplier({ ...cfg.infinite, readOnlyNodes: ro }, readW).toFixed(2)}×`} />
            <Stat label="Attach time" value={formatDuration(READ_ONLY_ATTACH_SECONDS)} hint="Independent of data size" />
          </div>
        </KindPanel>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 font-semibold">Time to add read capacity by data size</h3>
        <div className="flex flex-col gap-3">
          {sizes.map((b) => {
            const core = initialSyncSeconds(b)
            const max = initialSyncSeconds(sizes[sizes.length - 1])
            return (
              <div key={b} className="grid grid-cols-[64px_1fr] items-center gap-3 text-xs">
                <span className="font-mono">{formatBytes(b)}</span>
                <div className="flex flex-col gap-1">
                  <Bar pct={(core / max) * 100} className="bg-core" label={`Core ${formatDuration(core)}`} />
                  <Bar pct={(READ_ONLY_ATTACH_SECONDS / max) * 100} className="bg-infinite" label={`Infinite ${formatDuration(READ_ONLY_ATTACH_SECONDS)}`} />
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <SimulatedNote>Times are illustrative. Core initial sync is modeled at ~120 MB/s; Infinite read-only nodes attach to shared storage without copying data.</SimulatedNote>
    </div>
  )
}

function Bar({ pct, className, label }: { pct: number; className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${Math.max(1.5, pct)}%` }} />
      </div>
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
    </div>
  )
}

/** Illustrative per-member storage ceiling, roughly 50:1 disk-to-RAM capped at 4 TB. */
function maxDiskGb(ramGB: number) {
  return Math.min(4096, Math.max(128, ramGB * 50))
}

export function IndependentScalingStage() {
  const { cfg } = useDemo()
  const tierIds = TIERS.map((t) => t.id)
  const [tierIdx, setTierIdx] = useState(Math.max(0, tierIds.indexOf(cfg.core.tier)))
  const [dataGb, setDataGb] = useState(Math.max(50, cfg.core.diskSizeGB))
  const tier = tierInfo(tierIds[tierIdx])
  const coreProvisioned = Math.max(dataGb * 1.25, cfg.core.diskSizeGB) * 3
  const coreFits = dataGb * 1.25 <= maxDiskGb(tier.ramGB)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 rounded-xl border bg-card p-5 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Compute tier</span>
            <span className="font-mono">
              {tier.id} · {tier.vcpu} vCPU · {tier.ramGB} GB
            </span>
          </div>
          <Slider value={[tierIdx]} min={0} max={tierIds.length - 1} step={1} onValueChange={(v) => setTierIdx(Array.isArray(v) ? v[0] : v)} aria-label="Compute tier" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Data volume</span>
            <span className="font-mono">{dataGb.toLocaleString()} GB</span>
          </div>
          <Slider value={[dataGb]} min={10} max={8000} step={10} onValueChange={(v) => setDataGb(Array.isArray(v) ? v[0] : v)} aria-label="Data volume" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <KindPanel kind="core" subtitle={tier.id}>
          <CoreDiagram cluster={{ ...cfg.core, tier: tier.id, diskSizeGB: Math.round(dataGb * 1.25) }} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Provisioned storage" value={`${Math.round(coreProvisioned).toLocaleString()} GB`} hint="Per-member volume × 3" />
            <Stat label="Fits tier limit" value={coreFits ? 'Yes' : 'Larger tier needed'} hint={`Max ${maxDiskGb(tier.ramGB).toLocaleString()} GB per member`} />
          </div>
        </KindPanel>
        <KindPanel kind="infinite" subtitle={tier.id}>
          <InfiniteDiagram cluster={{ ...cfg.infinite, tier: tier.id }} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Logical storage" value={`${dataGb.toLocaleString()} GB`} hint="Single shared copy, grows on demand" />
            <Stat label="Compute change" value="Tier only" hint="Storage unaffected" />
          </div>
        </KindPanel>
      </div>
      <Points
        items={[
          { title: 'Core: coupled, predictable', body: 'Storage and compute scale together per member, which keeps performance characteristics simple to reason about.' },
          { title: 'Infinite: decoupled, elastic', body: 'Choose compute for the workload and let storage follow the data, without resizing volumes.' },
        ]}
      />
      <SimulatedNote>Storage math is illustrative (25% headroom per Core member). Consult Atlas pricing and tier limits for exact values.</SimulatedNote>
    </div>
  )
}
