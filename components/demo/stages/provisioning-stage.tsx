'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { CheckCircle2, Circle, Loader2, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PROVISION_STEPS } from '@/lib/simulation'
import type { ClusterKind } from '@/lib/types'
import { clusterOf, postJson, useDemo } from '../demo-context'
import { ErrorNote, KindPanel, SimulatedNote } from './primitives'

const KINDS: ClusterKind[] = ['core', 'infinite']

export function ProvisioningStage() {
  const { live } = useDemo()
  return live ? <LiveProvisioning /> : <SimulatedProvisioning />
}

function SimulatedProvisioning() {
  const { speed, setResults, results } = useDemo()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Record<ClusterKind, number>>(() =>
    results.provisioned?.core ? { core: 999, infinite: 999 } : { core: 0, infinite: 0 },
  )

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setProgress((p) => {
        const next = { core: p.core + 0.25 * speed, infinite: p.infinite + 0.3 * speed }
        const done = KINDS.every((k) => next[k] >= totalWeight(k))
        if (done) {
          setRunning(false)
          setResults((r) => ({ ...r, provisioned: { core: true, infinite: true } }))
        }
        return next
      })
    }, 250)
    return () => clearInterval(id)
  }, [running, speed, setResults])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => { setProgress({ core: 0, infinite: 0 }); setRunning(true) }} disabled={running}>
          <Rocket data-icon="inline-start" />
          {progress.core > 0 ? 'Replay provisioning' : 'Provision both clusters'}
        </Button>
        <SimulatedNote>The lifecycle is animated. No infrastructure is created and step durations are compressed.</SimulatedNote>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {KINDS.map((k) => (
          <StepList key={k} kind={k} progress={progress[k]} />
        ))}
      </div>
    </div>
  )
}

function totalWeight(kind: ClusterKind) {
  return PROVISION_STEPS[kind].reduce((a, s) => a + s.weight, 0)
}

function StepList({ kind, progress }: { kind: ClusterKind; progress: number }) {
  const { cfg } = useDemo()
  const steps = PROVISION_STEPS[kind]
  const total = totalWeight(kind)
  let acc = 0
  return (
    <KindPanel kind={kind} subtitle={clusterOf(cfg, kind).name}>
      <Progress value={Math.min(100, (progress / total) * 100)} aria-label={`${kind} provisioning progress`} />
      <ol className="flex flex-col gap-3">
        {steps.map((s) => {
          const start = acc
          acc += s.weight
          const state = progress >= acc && (s.weight > 0 || progress >= total) ? 'done' : progress >= start && progress > 0 ? 'active' : 'pending'
          return (
            <li key={s.label} className="flex gap-3">
              {state === 'done' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Done" />
              ) : state === 'active' ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-foreground" aria-label="In progress" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Pending" />
              )}
              <div>
                <p className={state === 'pending' ? 'text-sm text-muted-foreground' : 'text-sm font-medium'}>{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </KindPanel>
  )
}

interface PublicCluster {
  name: string
  stateName: string
  mongoDBVersion?: string
  instanceSize?: string
  region?: string
  clusterType?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data.cluster as PublicCluster
}

function LiveProvisioning() {
  const { cfg } = useDemo()
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)

  const create = async () => {
    setError(null)
    try {
      if (cfg.core.source === 'new') await postJson('/api/atlas/clusters', cfg.core)
      setRequested(true)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={create} disabled={requested}>
          <Rocket data-icon="inline-start" />
          {cfg.core.source === 'new' ? 'Provision Atlas Core and attach Infinite' : 'Attach existing clusters'}
        </Button>
        <p className="text-xs text-muted-foreground">Status is polled from the Atlas Admin API every 10 seconds. Provisioning typically takes several minutes.</p>
      </div>
      {error ? <ErrorNote message={error} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {KINDS.map((k) => (
          <LiveStatus key={k} kind={k} active={requested || clusterOf(cfg, k).source === 'existing'} />
        ))}
      </div>
    </div>
  )
}

function LiveStatus({ kind, active }: { kind: ClusterKind; active: boolean }) {
  const { cfg, setResults } = useDemo()
  const cluster = clusterOf(cfg, kind)
  const { data, error } = useSWR(active ? `/api/atlas/clusters?name=${encodeURIComponent(cluster.name)}` : null, fetcher, {
    refreshInterval: (d) => (d?.stateName === 'IDLE' ? 0 : 10000),
    onSuccess: (d) => {
      if (d.stateName === 'IDLE') setResults((r) => ({ ...r, provisioned: { ...r.provisioned, [kind]: true } }))
    },
  })
  return (
    <KindPanel kind={kind} subtitle={cluster.name} action={data ? <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{data.stateName}</span> : null}>
      {!active ? (
        <p className="text-sm text-muted-foreground">Waiting for the provisioning request.</p>
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : !data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Fetching status
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Type', data.clusterType],
            ['Tier', data.instanceSize],
            ['Region', data.region],
            ['Version', data.mongoDBVersion],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-mono">{v ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}
    </KindPanel>
  )
}
