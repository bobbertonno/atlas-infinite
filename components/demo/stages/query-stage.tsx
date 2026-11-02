'use client'

import { useState } from 'react'
import { CheckCircle2, Play, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateDoc, groupFieldFor } from '@/lib/dataset'
import type { ClusterKind, DatasetConfig } from '@/lib/types'
import { clusterOf, postJson, useDemo } from '../demo-context'
import { ErrorNote, KindPanel, SimulatedNote } from './primitives'

interface QueryResult {
  result: unknown
  ms: number
}

function queryLabels(ds: DatasetConfig) {
  const field = groupFieldFor(ds)
  return [
    { title: 'Count', code: `db.${ds.collection}.countDocuments()` },
    { title: 'Sorted find', code: `db.${ds.collection}.find({}, { payload: 0 }).sort({ _id: 1 }).limit(3)` },
    { title: 'Point lookup', code: `db.${ds.collection}.findOne({ _id: "${generateDoc(ds, Math.floor(ds.documentCount / 2))._id}" })` },
    { title: 'Aggregation', code: `db.${ds.collection}.aggregate([{ $group: { _id: "$${field}", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }])` },
  ]
}

/** Computes the same four queries in the browser over the deterministic dataset (bounded sample). */
function simulateQueries(ds: DatasetConfig): QueryResult[] {
  const n = Math.min(ds.documentCount, 5000)
  const docs = Array.from({ length: n }, (_, i) => generateDoc(ds, i))
  const strip = (d: Record<string, unknown>) => {
    const { payload: _p, ...rest } = d
    return rest
  }
  const field = groupFieldFor(ds)
  const groups = new Map<string, number>()
  for (const d of docs) {
    const key = String(d[field])
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  const sorted = [...docs].sort((a, b) => (a._id < b._id ? -1 : 1))
  return [
    { result: ds.documentCount, ms: 0 },
    { result: sorted.slice(0, 3).map(strip), ms: 0 },
    { result: strip(generateDoc(ds, Math.floor(ds.documentCount / 2))), ms: 0 },
    {
      result: [...groups.entries()]
        .map(([_id, count]) => ({ _id, count }))
        .sort((a, b) => b.count - a.count || (a._id < b._id ? -1 : 1))
        .slice(0, 5),
      ms: 0,
    },
  ]
}

export function QueryCompatStage() {
  const { cfg, live, setResults } = useDemo()
  const [results, setRes] = useState<Partial<Record<ClusterKind, QueryResult[]>>>({})
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const labels = queryLabels(cfg.dataset)

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      let next: Record<ClusterKind, QueryResult[]>
      if (live) {
        const [core, infinite] = await Promise.all(
          (['core', 'infinite'] as const).map((k) =>
            postJson<{ results: QueryResult[] }>('/api/live/data', { action: 'queries', clusterName: clusterOf(cfg, k).name, dataset: cfg.dataset }).then((r) => r.results),
          ),
        )
        next = { core, infinite }
      } else {
        const sim = simulateQueries(cfg.dataset)
        next = { core: sim, infinite: sim }
      }
      setRes(next)
      const matched = next.core.every((r, i) => JSON.stringify(r.result) === JSON.stringify(next.infinite[i].result))
      setResults((r) => ({ ...r, queriesMatched: matched }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={running}>
          <Play data-icon="inline-start" />
          Run identical queries on both clusters
        </Button>
        {!live ? <SimulatedNote>Results are computed in the browser from the deterministic generator (aggregation over the first 5,000 documents).</SimulatedNote> : null}
      </div>
      {error ? <ErrorNote message={error} /> : null}
      <ol className="flex flex-col gap-4">
        {labels.map((q, i) => {
          const c = results.core?.[i]
          const inf = results.infinite?.[i]
          const same = c && inf ? JSON.stringify(c.result) === JSON.stringify(inf.result) : null
          return (
            <li key={q.title} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{q.title}</p>
                {same === null ? null : same ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <CheckCircle2 className="size-4" aria-hidden="true" /> Identical results
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                    <XCircle className="size-4" aria-hidden="true" /> Results differ
                  </span>
                )}
              </div>
              <code className="block overflow-x-auto rounded-md bg-background px-3 py-2 font-mono text-xs">{q.code}</code>
              {c && inf ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {(['core', 'infinite'] as const).map((k) => {
                    const r = k === 'core' ? c : inf
                    return (
                      <KindPanel key={k} kind={k} action={live ? <span className="font-mono text-xs text-muted-foreground">{r.ms} ms server-side</span> : null}>
                        <pre className="max-h-40 overflow-auto font-mono text-xs">{JSON.stringify(r.result, null, 2)}</pre>
                      </KindPanel>
                    )
                  })}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
