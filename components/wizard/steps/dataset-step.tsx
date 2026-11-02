'use client'

import { useMemo, useState } from 'react'
import { Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceCard, HelpCallout, NumberField, SelectField, SliderField, TextField } from '@/components/lab/fields'
import { DATASET_TEMPLATES } from '@/lib/catalog'
import { estimateDataset, expectedFingerprint, formatBytes, formatDuration, generateDoc, parseIndexSpec } from '@/lib/dataset'
import type { DatasetConfig, DatasetTemplate } from '@/lib/types'
import type { StepProps } from '../wizard'

export function DatasetStep({ cfg, update }: StepProps) {
  const d = cfg.dataset
  const set = <K extends keyof DatasetConfig>(k: K, v: DatasetConfig[K]) => update('dataset', (p) => ({ ...p, [k]: v }))
  const [newIndex, setNewIndex] = useState('')
  const [previewStart, setPreviewStart] = useState(0)

  const est = useMemo(() => estimateDataset(d), [d])
  const preview = useMemo(() => {
    try {
      return [0, 1].map((i) => generateDoc(d, Math.min(d.documentCount - 1, previewStart + i)))
    } catch {
      return []
    }
  }, [d, previewStart])
  const fingerprint = useMemo(() => {
    try {
      return expectedFingerprint(d)
    } catch {
      return 'n/a'
    }
  }, [d])

  const chooseTemplate = (t: DatasetTemplate) => {
    const meta = DATASET_TEMPLATES[t]
    const collection = { financial: 'transactions', customers: 'customers', audit: 'audit_events', iot: 'telemetry', docmeta: 'documents', custom: 'records' }[t]
    update('dataset', (p) => ({ ...p, template: t, name: meta.label, collection, avgDocBytes: meta.avgDocBytes, indexes: [...meta.indexes] }))
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Template</h2>
        <div role="radiogroup" aria-label="Dataset template" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(DATASET_TEMPLATES) as DatasetTemplate[]).map((t) => (
            <ChoiceCard
              key={t}
              selected={d.template === t}
              onSelect={() => chooseTemplate(t)}
              title={DATASET_TEMPLATES[t].label}
              description={DATASET_TEMPLATES[t].description}
            />
          ))}
        </div>
      </section>

      {d.template === 'custom' ? (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5">
          <label htmlFor="schema" className="text-sm font-medium">
            Custom JSON schema
          </label>
          <Textarea id="schema" value={d.customSchema} onChange={(e) => set('customSchema', e.target.value)} rows={9} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">
            Map field names to types: string, int, float, bool, date or enum:A|B|C. Every document also gets a deterministic _id.
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-3">
        <TextField label="Dataset name" value={d.name} onChange={(v) => set('name', v)} />
        <TextField label="Database" value={d.database} onChange={(v) => set('database', v.trim())} mono />
        <TextField label="Collection" value={d.collection} onChange={(v) => set('collection', v.trim())} mono />
        <NumberField label="Documents per collection" value={d.documentCount} onChange={(v) => set('documentCount', Math.round(v))} min={1} max={1_000_000_000} step={10000} />
        <NumberField label="Approx. document size" value={d.avgDocBytes} onChange={(v) => set('avgDocBytes', v)} min={128} max={16384} step={64} suffix="bytes" />
        <NumberField label="Collections" value={d.collections} onChange={(v) => set('collections', v)} min={1} max={20} />
        <div className="flex flex-col gap-1.5">
          <NumberField label="Random seed" value={d.seed} onChange={(v) => set('seed', Math.round(v))} min={0} max={2 ** 31 - 1} />
          <Button size="sm" variant="ghost" className="self-start" onClick={() => set('seed', Math.floor(Math.random() * 1_000_000))}>
            <RefreshCw data-icon="inline-start" />
            New seed
          </Button>
        </div>
        <NumberField label="Generator batch size" value={d.batchSize} onChange={(v) => set('batchSize', v)} min={100} max={5000} step={100} />
        <NumberField label="Parallel ingestion workers" value={d.workers} onChange={(v) => set('workers', v)} min={1} max={16} />
        <SelectField<DatasetConfig['distribution']>
          label="Value distribution"
          value={d.distribution}
          onChange={(v) => set('distribution', v)}
          options={[
            { value: 'uniform', label: 'Uniform' },
            { value: 'skewed', label: 'Skewed (Zipf-like)' },
            { value: 'normal', label: 'Normal' },
          ]}
        />
        <NumberField label="Updates / minute" value={d.updatesPerMin} onChange={(v) => set('updatesPerMin', v)} min={0} max={1_000_000} />
        <NumberField label="Deletes / minute" value={d.deletesPerMin} onChange={(v) => set('deletesPerMin', v)} min={0} max={1_000_000} />
        <div className="md:col-span-3">
          <SliderField
            label="Historical vs recent data"
            value={d.historicalRatio}
            onChange={(v) => set('historicalRatio', v)}
            min={0}
            max={100}
            format={(v) => `${v}% historical · ${100 - v}% last 30 days`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Indexes</h2>
        <ul className="flex flex-wrap gap-2">
          <li className="rounded-md border bg-muted px-2 py-1 font-mono text-xs">_id:1</li>
          {d.indexes.map((idx) => (
            <li key={idx} className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 font-mono text-xs">
              {idx}
              <button type="button" aria-label={`Remove index ${idx}`} onClick={() => set('indexes', d.indexes.filter((i) => i !== idx))}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = newIndex.trim()
            if (v && parseIndexSpec(v) && !d.indexes.includes(v)) {
              set('indexes', [...d.indexes, v])
              setNewIndex('')
            }
          }}
        >
          <label htmlFor="new-index" className="sr-only">
            New index specification
          </label>
          <Input id="new-index" value={newIndex} onChange={(e) => setNewIndex(e.target.value)} placeholder="field:1,other:-1" className="font-mono text-xs" />
          <Button type="submit" variant="outline" disabled={!parseIndexSpec(newIndex.trim() || '!')}>
            <Plus data-icon="inline-start" />
            Add
          </Button>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Estimates</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Documents" value={est.documents.toLocaleString()} />
            <Stat label="Logical data" value={formatBytes(est.logicalBytes)} />
            <Stat label="Index size (est.)" value={formatBytes(est.indexBytes)} />
            <Stat label="Load time (est.)" value={formatDuration(est.loadSeconds)} />
            <Stat label="Generator memory" value={formatBytes(est.generatorMemoryBytes)} />
            <Stat label="Core storage (3 copies)" value={formatBytes((est.logicalBytes + est.indexBytes) * 3 * 0.45)} />
          </dl>
          <p className="text-xs text-muted-foreground">
            All values are estimates. Storage assumes ~55% WiredTiger compression. Documents are generated in bounded batches, so memory stays
            proportional to batch size, not dataset size.
          </p>
          <div className="rounded-lg bg-muted/50 p-3 text-xs">
            <span className="text-muted-foreground">Expected fingerprint (first 500 by _id): </span>
            <span className="font-mono text-primary">{fingerprint}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Sample documents</h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">#{previewStart}</span>
              <Button size="sm" variant="outline" onClick={() => setPreviewStart(Math.floor(Math.random() * Math.max(1, d.documentCount - 2)))}>
                Shuffle
              </Button>
            </div>
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg bg-background p-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      </section>

      <HelpCallout title="Deterministic generation">
        Each document is a pure function of the seed and its index, so both clusters receive identical _id values, identical contents and
        identical indexes, without holding the dataset in memory. Re-running a load with the same seed is idempotent: existing _id values are
        skipped as duplicates.
      </HelpCallout>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium">{value}</dd>
    </div>
  )
}
