'use client'

import { HelpCallout, NumberField, SelectField, SwitchField } from '@/components/lab/fields'
import type { LoadingConfig } from '@/lib/types'
import type { StepProps } from '../wizard'

export function LoadingStep({ cfg, update }: StepProps) {
  const l = cfg.loading
  const set = <K extends keyof LoadingConfig>(k: K, v: LoadingConfig[K]) => update('loading', (p) => ({ ...p, [k]: v }))
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2">
        <SelectField<LoadingConfig['target']>
          label="Load target"
          value={l.target}
          onChange={(v) => set('target', v)}
          options={[
            { value: 'both', label: 'Both clusters' },
            { value: 'core', label: 'Atlas Core only' },
            { value: 'infinite', label: 'Atlas Infinite only' },
          ]}
        />
        <SelectField<LoadingConfig['writeConcern']>
          label="Write concern"
          value={l.writeConcern}
          onChange={(v) => set('writeConcern', v)}
          options={[
            { value: 'majority', label: 'w: majority (durable)' },
            { value: '1', label: 'w: 1 (faster)' },
          ]}
        />
        <NumberField label="Bulk insert batch size" value={l.batchSize} onChange={(v) => set('batchSize', v)} min={100} max={5000} step={100} />
        <NumberField label="Parallelism" value={l.parallelism} onChange={(v) => set('parallelism', v)} min={1} max={8} help="Concurrent batches in flight per cluster." />
        <NumberField label="Max retries per batch" value={l.maxRetries} onChange={(v) => set('maxRetries', v)} min={0} max={10} help="Exponential backoff between attempts." />
        <SelectField<LoadingConfig['indexStrategy']>
          label="Index creation"
          value={l.indexStrategy}
          onChange={(v) => set('indexStrategy', v)}
          options={[
            { value: 'after', label: 'After load (faster ingestion)' },
            { value: 'before', label: 'Before load (maintained during writes)' },
          ]}
        />
        <SelectField<LoadingConfig['validation']>
          label="Validation strategy"
          value={l.validation}
          onChange={(v) => set('validation', v)}
          options={[
            { value: 'full', label: 'Counts, indexes, stats, fingerprint and samples' },
            { value: 'sample', label: 'Counts, indexes and fingerprint' },
            { value: 'none', label: 'Skip validation' },
          ]}
        />
        <div className="flex flex-col gap-2 md:col-span-2">
          <SwitchField
            label="Reset demo collections before loading"
            checked={l.resetBeforeLoad}
            onChange={(v) => update('loading', (p) => ({ ...p, resetBeforeLoad: v, reuseExisting: v ? false : p.reuseExisting }))}
            help="Drops the target collection on each cluster first. Only the configured demo collection is affected."
          />
          <SwitchField
            label="Reuse existing dataset"
            checked={l.reuseExisting}
            onChange={(v) => update('loading', (p) => ({ ...p, reuseExisting: v, resetBeforeLoad: v ? false : p.resetBeforeLoad }))}
            help="Skip ingestion and go straight to validation when the data is already present."
          />
        </div>
      </section>
      <HelpCallout title="Resilient, idempotent ingestion">
        Batches are inserted with unordered bulk writes and deterministic _id values, so retries and resumed runs never create duplicates.
        A checkpoint per cluster is saved after every acknowledged batch, letting you pause, close the browser and resume later. Ingestion
        success and data validation are reported separately.
      </HelpCallout>
    </div>
  )
}
