'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Progress } from '@/components/ui/progress'
import { tierInfo } from '@/lib/catalog'
import { simulateTick, summarize, type LatencyStats } from '@/lib/simulation'
import type { ClusterKind } from '@/lib/types'
import { clusterOf, postJson, useDemo } from '../demo-context'
import { ErrorNote, KindPanel, SimulatedNote, Stat } from './primitives'

interface Point {
  t: number
  coreP95?: number
  infiniteP95?: number
  coreOps?: number
  infiniteOps?: number
}

const chartConfig = {
  coreP95: { label: 'Core p95 (ms)', color: 'var(--core)' },
  infiniteP95: { label: 'Infinite p95 (ms)', color: 'var(--infinite)' },
} satisfies ChartConfig

const KINDS: ClusterKind[] = ['core', 'infinite']

export function WorkloadStage() {
  const { cfg, live, speed, setResults } = useDemo()
  const [running, setRunning] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [ticks, setTicks] = useState<Record<ClusterKind, LatencyStats[]>>({ core: [], infinite: [] })
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)
  const duration = cfg.workload.durationSec
  const elapsed = points.length

  useEffect(() => {
    if (!running || live) return
    let t = 0
    const id = setInterval(() => {
      if (stopRef.current || t >= duration) {
        clearInterval(id)
        setRunning(false)
        return
      }
      const c = simulateTick(cfg, 'core', t)
      const i = simulateTick(cfg, 'infinite', t)
      setTicks((s) => ({ core: [...s.core, c], infinite: [...s.infinite, i] }))
      setPoints((p) => [...p, { t, coreP95: c.p95, infiniteP95: i.p95, coreOps: c.throughput, infiniteOps: i.throughput }])
      t++
    }, 1000 / Math.max(1, speed * 4))
    return () => clearInterval(id)
  }, [running, live, cfg, duration, speed])

  const runLive = async () => {
    const burstSec = 4
    try {
      for (let t = 0; t * burstSec < duration; t++) {
        if (stopRef.current) break
        const [c, i] = await Promise.all(
          KINDS.map((k) =>
            postJson<LatencyStats>('/api/live/workload', {
              clusterName: clusterOf(cfg, k).name,
              dataset: cfg.dataset,
              workload: cfg.workload,
              burstMs: burstSec * 1000,
              tick: t,
            }),
          ),
        )
        setTicks((s) => ({ core: [...s.core, c], infinite: [...s.infinite, i] }))
        setPoints((p) => [...p, ...Array.from({ length: burstSec }, (_, j) => ({ t: t * burstSec + j, coreP95: c.p95, infiniteP95: i.p95, coreOps: c.throughput, infiniteOps: i.throughput }))])
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const start = () => {
    stopRef.current = false
    setError(null)
    setPoints([])
    setTicks({ core: [], infinite: [] })
    setRunning(true)
    if (live) void runLive()
  }

  useEffect(() => {
    if (running || ticks.core.length === 0) return
    setResults((r) => ({ ...r, workload: { core: summarize(ticks.core), infinite: summarize(ticks.infinite) } }))
  }, [running, ticks, setResults])

  const w = cfg.workload
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-6 rounded-xl border bg-card p-4">
        <Stat label="Template" value={w.template} />
        <Stat label="Read / write" value={`${w.readRatio} / ${100 - w.readRatio}`} />
        <Stat label="Target ops/s" value={w.targetOps.toLocaleString()} />
        <Stat label="Concurrency" value={w.concurrency} />
        <Stat label="Hot data" value={`${w.hotDataRatio}%`} />
        <div className="ml-auto">
          {running ? (
            <Button variant="outline" onClick={() => (stopRef.current = true)}>
              <Square data-icon="inline-start" />
              Stop
            </Button>
          ) : (
            <Button onClick={start}>
              <Play data-icon="inline-start" />
              Run identical workload
            </Button>
          )}
        </div>
      </div>
      {running || elapsed > 0 ? <Progress value={Math.min(100, (elapsed / duration) * 100)} aria-label="Workload progress" /> : null}
      {error ? <ErrorNote message={error} /> : null}

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 font-semibold">p95 latency over time</h3>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <LineChart data={points} margin={{ left: 0, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="t" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}s`} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line dataKey="coreP95" stroke="var(--color-coreP95)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="infiniteP95" stroke="var(--color-infiniteP95)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {KINDS.map((k) => {
          const s = summarize(ticks[k])
          const cluster = clusterOf(cfg, k)
          const tier = tierInfo(cluster.tier)
          return (
            <KindPanel key={k} kind={k} subtitle={`${cluster.tier} · ${tier.vcpu} vCPU · ${tier.ramGB} GB`}>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="p50" value={`${s.p50} ms`} />
                <Stat label="p95" value={`${s.p95} ms`} />
                <Stat label="p99" value={`${s.p99} ms`} />
                <Stat label="Throughput" value={`${s.throughput.toLocaleString()}/s`} />
                <Stat label="Operations" value={s.ops.toLocaleString()} />
                <Stat label="Errors" value={s.errors} />
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {Object.entries(s.byType)
                  .map(([t, n]) => `${t} ${n.toLocaleString()}`)
                  .join(' · ') || 'No operations yet'}
              </p>
            </KindPanel>
          )
        })}
      </div>

      {live ? (
        <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          Measured client-side from the application server in bounded bursts. Results reflect network distance, cache state and
          compute generation (Gen1 vs Gen2); they are not hardware-normalized.
        </p>
      ) : (
        <SimulatedNote>
          Latencies come from an illustrative model of cache-hit, cache-miss and write-acknowledgement paths. They are not measurements and
          are not hardware-normalized.
        </SimulatedNote>
      )}
    </div>
  )
}
