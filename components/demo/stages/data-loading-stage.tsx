'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Pause, Play, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { estimateDataset, expectedFingerprint, formatBytes, formatDuration, generateDoc } from '@/lib/dataset'
import type { ClusterKind } from '@/lib/types'
import { clusterOf, postJson, useDemo } from '../demo-context'
import { ErrorNote, KindPanel, SimulatedNote, Stat, sleep } from './primitives'

type Phase = 'idle' | 'preparing' | 'loading' | 'paused' | 'loaded' | 'verifying' | 'verified' | 'error'

interface Verification {
  count: number
  indexes: string[]
  fingerprint: string
  sample: unknown
  storageBytes?: number
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Not started',
  preparing: 'Preparing collection',
  loading: 'Loading',
  paused: 'Paused at checkpoint',
  loaded: 'Ingestion complete',
  verifying: 'Validating',
  verified: 'Validated',
  error: 'Error',
}

function useClusterLoader(kind: ClusterKind) {
  const { cfg, live, speed, updateCfg, setResults } = useDemo()
  const ds = cfg.dataset
  const ld = cfg.loading
  const total = ds.documentCount
  const [phase, setPhase] = useState<Phase>('idle')
  const [loaded, setLoaded] = useState(() => cfg.checkpoint?.[kind] ?? 0)
  const [retries, setRetries] = useState(0)
  const [duplicates, setDuplicates] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [seconds, setSeconds] = useState(0)
  const pausedRef = useRef(false)
  const startedAt = useRef(0)
  const expected = useMemo(() => expectedFingerprint(ds), [ds])

  const saveCheckpoint = useCallback(
    (n: number) =>
      updateCfg((c) => ({
        checkpoint: { core: c.checkpoint?.core ?? 0, infinite: c.checkpoint?.infinite ?? 0, [kind]: n, updatedAt: new Date().toISOString() },
      })),
    [kind, updateCfg],
  )

  const verify = useCallback(async () => {
    setPhase('verifying')
    try {
      if (live) {
        const v = await postJson<{ count: number; indexes: { name: string }[]; fingerprint: string; samples: unknown[]; stats: { storageSize?: number } | null }>(
          '/api/live/data',
          { action: 'verify', clusterName: clusterOf(cfg, kind).name, dataset: ds },
        )
        setVerification({ count: v.count, indexes: v.indexes.map((i) => i.name), fingerprint: v.fingerprint, sample: v.samples[0], storageBytes: v.stats?.storageSize })
      } else {
        await sleep(900 / speed)
        setVerification({
          count: total,
          indexes: ['_id_', ...ds.indexes.map((i) => i.replace(/[:,\s]+/g, '_'))],
          fingerprint: expected,
          sample: generateDoc(ds, 0),
        })
      }
      setPhase('verified')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }, [live, cfg, kind, ds, speed, total, expected])

  const finish = useCallback(async () => {
    const secs = (performance.now() - startedAt.current) / 1000
    setSeconds(secs)
    setPhase('loaded')
    saveCheckpoint(total)
    if (ld.validation !== 'none') await verify()
    setResults((r) => ({ ...r, load: { ...r.load, [kind]: { documents: total, seconds: secs, validated: ld.validation !== 'none' } } }))
  }, [saveCheckpoint, total, ld.validation, verify, setResults, kind])

  const runLive = useCallback(
    async (from: number) => {
      const name = clusterOf(cfg, kind).name
      const call = async (body: Record<string, unknown>) => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await postJson<{ next: number; duplicates: number }>('/api/live/data', { clusterName: name, dataset: ds, ...body })
          } catch (e) {
            if (attempt >= ld.maxRetries) throw e
            setRetries((r) => r + 1)
            await sleep(500 * 2 ** attempt)
          }
        }
      }
      try {
        if (from === 0) {
          setPhase('preparing')
          if (ld.resetBeforeLoad) await call({ action: 'reset' })
          if (ld.indexStrategy === 'before') await call({ action: 'indexes' })
        }
        setPhase('loading')
        let next = from
        while (next < total) {
          if (pausedRef.current) {
            setPhase('paused')
            return
          }
          const starts = Array.from({ length: ld.parallelism }, (_, i) => next + i * ld.batchSize).filter((s) => s < total)
          const res = await Promise.all(starts.map((start) => call({ action: 'load', start, count: ld.batchSize, writeConcern: ld.writeConcern })))
          setDuplicates((d) => d + res.reduce((a, r) => a + r.duplicates, 0))
          next = Math.min(total, next + starts.length * ld.batchSize)
          setLoaded(next)
          saveCheckpoint(next)
        }
        if (ld.indexStrategy === 'after') await call({ action: 'indexes' })
        await finish()
      } catch (e) {
        setError((e as Error).message)
        setPhase('error')
      }
    },
    [cfg, kind, ds, ld, total, saveCheckpoint, finish],
  )

  // Simulated ingestion: advance by modeled batches while in the loading phase.
  useEffect(() => {
    if (live || phase !== 'loading') return
    const perTick = Math.max(ld.batchSize, (total / 40) * (kind === 'core' ? 1 : 1.04)) * speed
    const id = setInterval(() => {
      if (pausedRef.current) {
        setPhase('paused')
        return
      }
      setLoaded((l) => {
        const n = Math.min(total, l + Math.round(perTick))
        if (n >= total) queueMicrotask(finish)
        else if (Math.floor(n / (total / 8)) !== Math.floor(l / (total / 8))) queueMicrotask(() => saveCheckpoint(n))
        return n
      })
    }, 250)
    return () => clearInterval(id)
  }, [live, phase, ld.batchSize, total, kind, speed, finish, saveCheckpoint])

  const start = (fresh: boolean) => {
    pausedRef.current = false
    setError(null)
    setVerification(null)
    const from = fresh ? 0 : loaded
    if (fresh) {
      setLoaded(0)
      setDuplicates(0)
      setRetries(0)
      startedAt.current = performance.now()
    } else if (!startedAt.current) startedAt.current = performance.now()
    if (live) void runLive(from)
    else setPhase('loading')
  }

  return {
    phase,
    loaded,
    total,
    retries,
    duplicates,
    error,
    verification,
    expected,
    seconds,
    start,
    pause: () => (pausedRef.current = true),
    reuse: () => void verify(),
  }
}

type Loader = ReturnType<typeof useClusterLoader>

export function DataLoadingStage() {
  const { cfg } = useDemo()
  const core = useClusterLoader('core')
  const infinite = useClusterLoader('infinite')
  const est = estimateDataset(cfg.dataset)
  const targets: ClusterKind[] = cfg.loading.target === 'both' ? ['core', 'infinite'] : [cfg.loading.target]
  const loaders: Record<ClusterKind, Loader> = { core, infinite }
  const anyRunning = targets.some((k) => ['preparing', 'loading', 'verifying'].includes(loaders[k].phase))
  const canResume = targets.some((k) => loaders[k].loaded > 0 && loaders[k].loaded < loaders[k].total)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-6 rounded-xl border bg-card p-4">
        <Stat label="Documents" value={est.documents.toLocaleString()} />
        <Stat label="Logical size" value={formatBytes(est.logicalBytes)} />
        <Stat label="Batch × parallelism" value={`${cfg.loading.batchSize} × ${cfg.loading.parallelism}`} />
        <Stat label="Est. load time" value={formatDuration(est.loadSeconds)} hint="Estimate" />
        <div className="ml-auto flex flex-wrap gap-2">
          {cfg.loading.reuseExisting ? (
            <Button variant="outline" onClick={() => targets.forEach((k) => loaders[k].reuse())} disabled={anyRunning}>
              Validate existing data
            </Button>
          ) : null}
          {canResume && !anyRunning ? (
            <Button variant="outline" onClick={() => targets.forEach((k) => loaders[k].start(false))}>
              <Play data-icon="inline-start" />
              Resume from checkpoint
            </Button>
          ) : null}
          {anyRunning ? (
            <Button variant="outline" onClick={() => targets.forEach((k) => loaders[k].pause())}>
              <Pause data-icon="inline-start" />
              Pause
            </Button>
          ) : (
            <Button onClick={() => targets.forEach((k) => loaders[k].start(true))}>
              <RotateCcw data-icon="inline-start" />
              {targets.length === 2 ? 'Load both clusters' : 'Load cluster'}
            </Button>
          )}
        </div>
      </div>
      <SimulatedNote>
        In Simulation Mode ingestion is animated, but the dataset, document IDs and fingerprint are computed from the real deterministic generator.
      </SimulatedNote>
      <div className="grid gap-4 md:grid-cols-2">
        {(['core', 'infinite'] as const).map((k) => (
          <LoaderPanel key={k} kind={k} loader={loaders[k]} enabled={targets.includes(k)} />
        ))}
      </div>
    </div>
  )
}

function LoaderPanel({ kind, loader, enabled }: { kind: ClusterKind; loader: Loader; enabled: boolean }) {
  const { cfg } = useDemo()
  const pct = (loader.loaded / loader.total) * 100
  const v = loader.verification
  const fpMatch = v ? v.fingerprint === loader.expected : false
  const countMatch = v ? v.count === loader.total : false

  return (
    <KindPanel
      kind={kind}
      subtitle={`${cfg.dataset.database}.${cfg.dataset.collection}`}
      action={<span className="rounded bg-muted px-2 py-0.5 text-xs">{enabled ? PHASE_LABEL[loader.phase] : 'Not targeted'}</span>}
    >
      <div className="flex flex-col gap-2">
        <Progress value={pct} aria-label={`${kind} ingestion progress`} />
        <div className="flex justify-between font-mono text-xs text-muted-foreground tabular-nums">
          <span>
            {loader.loaded.toLocaleString()} / {loader.total.toLocaleString()}
          </span>
          <span>
            retries {loader.retries} · duplicates skipped {loader.duplicates}
          </span>
        </div>
      </div>
      {loader.error ? <ErrorNote message={loader.error} /> : null}
      {v ? (
        <div className="flex flex-col gap-3 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data validation</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            <Check ok={countMatch} label={`Document count ${v.count.toLocaleString()}`} />
            <Check ok={fpMatch} label={`Fingerprint ${v.fingerprint} (expected ${loader.expected})`} />
            <Check ok={v.indexes.length >= cfg.dataset.indexes.length + 1} label={`${v.indexes.length} indexes: ${v.indexes.join(', ')}`} />
            {v.storageBytes ? <li className="text-xs text-muted-foreground">Storage size {formatBytes(v.storageBytes)}</li> : null}
          </ul>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Representative document</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-background p-3 font-mono">{JSON.stringify(v.sample, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </KindPanel>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Pass" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Fail" />}
      <span className="break-all">{label}</span>
    </li>
  )
}
