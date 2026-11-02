'use client'

import { ChoiceCard, HelpCallout, NumberField, SelectField, SliderField } from '@/components/lab/fields'
import { WORKLOAD_TEMPLATES } from '@/lib/catalog'
import type { WorkloadConfig, WorkloadTemplate } from '@/lib/types'
import type { StepProps } from '../wizard'

export function WorkloadStep({ cfg, update }: StepProps) {
  const w = cfg.workload
  const set = (patch: Partial<WorkloadConfig>) => update('workload', (p) => ({ ...p, ...patch, template: patch.template ?? 'custom' }))

  const setReadRatio = (r: number) => {
    const writes = 100 - r
    const total = w.insertRate + w.updateRate + w.deleteRate || 1
    const ins = Math.round((w.insertRate / total) * writes)
    const upd = Math.round((w.updateRate / total) * writes)
    set({ readRatio: r, insertRate: ins, updateRate: upd, deleteRate: Math.max(0, writes - ins - upd) })
  }
  const setWrite = (key: 'insertRate' | 'updateRate' | 'deleteRate', v: number) => {
    const others = (['insertRate', 'updateRate', 'deleteRate'] as const).filter((k) => k !== key)
    const otherSum = others.reduce((a, k) => a + w[k], 0)
    set({ [key]: v, readRatio: Math.max(0, 100 - v - otherSum) })
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Workload template" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(WORKLOAD_TEMPLATES) as WorkloadTemplate[]).map((t) => (
          <ChoiceCard
            key={t}
            selected={w.template === t}
            onSelect={() => update('workload', (p) => ({ ...p, ...WORKLOAD_TEMPLATES[t].preset, template: t }))}
            title={WORKLOAD_TEMPLATES[t].label}
            description={WORKLOAD_TEMPLATES[t].description}
          />
        ))}
      </div>

      <section className="grid gap-5 rounded-xl border bg-card p-5 md:grid-cols-2">
        <h2 className="text-sm font-semibold md:col-span-2">Operation mix</h2>
        <SliderField label="Reads" value={w.readRatio} onChange={setReadRatio} min={0} max={100} format={(v) => `${v}%`} />
        <SliderField label="Inserts" value={w.insertRate} onChange={(v) => setWrite('insertRate', v)} min={0} max={100} format={(v) => `${v}%`} />
        <SliderField label="Updates" value={w.updateRate} onChange={(v) => setWrite('updateRate', v)} min={0} max={100} format={(v) => `${v}%`} />
        <SliderField label="Deletes" value={w.deleteRate} onChange={(v) => setWrite('deleteRate', v)} min={0} max={100} format={(v) => `${v}%`} />
        <div className="flex h-3 overflow-hidden rounded-full md:col-span-2" aria-hidden="true">
          <div className="bg-core" style={{ width: `${w.readRatio}%` }} />
          <div className="bg-infinite" style={{ width: `${w.insertRate}%` }} />
          <div className="bg-simulated" style={{ width: `${w.updateRate}%` }} />
          <div className="bg-chart-4" style={{ width: `${w.deleteRate}%` }} />
        </div>
      </section>

      <section className="grid gap-5 rounded-xl border bg-card p-5 md:grid-cols-3">
        <h2 className="text-sm font-semibold md:col-span-3">Load shape</h2>
        <NumberField label="Concurrent users" value={w.concurrency} onChange={(v) => set({ concurrency: v })} min={1} max={256} />
        <NumberField label="Target ops / second" value={w.targetOps} onChange={(v) => set({ targetOps: v })} min={1} max={100000} step={100} />
        <NumberField label="Duration" value={w.durationSec} onChange={(v) => set({ durationSec: v })} min={10} max={600} step={10} suffix="seconds" />
        <SelectField<WorkloadConfig['accessPattern']>
          label="Access pattern"
          value={w.accessPattern}
          onChange={(v) => set({ accessPattern: v })}
          options={[
            { value: 'random', label: 'Random' },
            { value: 'sequential', label: 'Sequential' },
          ]}
        />
        <SelectField<WorkloadConfig['aggregationComplexity']>
          label="Aggregation complexity"
          value={w.aggregationComplexity}
          onChange={(v) => set({ aggregationComplexity: v })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
        <NumberField label="Query selectivity" value={w.selectivity} onChange={(v) => set({ selectivity: v })} min={0.0001} max={1} step={0.0005} help="Fraction of documents matched per query." />
        <div className="md:col-span-3">
          <SliderField
            label="Hot data access"
            value={w.hotDataRatio}
            onChange={(v) => set({ hotDataRatio: v })}
            min={0}
            max={100}
            format={(v) => `${v}% of reads hit the hottest 10%`}
            help="Lower values push reads beyond the cache and exercise the storage path."
          />
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-3">
        <h2 className="text-sm font-semibold md:col-span-3">Consistency</h2>
        <SelectField<WorkloadConfig['readPreference']>
          label="Read preference"
          value={w.readPreference}
          onChange={(v) => set({ readPreference: v })}
          options={['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest'].map((v) => ({ value: v as WorkloadConfig['readPreference'], label: v }))}
        />
        <SelectField<WorkloadConfig['readConcern']>
          label="Read concern"
          value={w.readConcern}
          onChange={(v) => set({ readConcern: v })}
          options={['local', 'majority', 'available'].map((v) => ({ value: v as WorkloadConfig['readConcern'], label: v }))}
        />
        <SelectField<WorkloadConfig['writeConcern']>
          label="Write concern"
          value={w.writeConcern}
          onChange={(v) => set({ writeConcern: v })}
          options={[
            { value: 'majority', label: 'majority' },
            { value: '1', label: '1' },
          ]}
        />
      </section>

      <HelpCallout title="Fair comparisons">
        The identical logical workload runs against both clusters. Results report p50, p95 and p99 latency, throughput, errors and
        per-operation counts, together with the context that shapes them: compute generation (Gen1 vs Gen2), instance resources, cache
        warmth and client location. Results are not hardware-normalized.
      </HelpCallout>
    </div>
  )
}
