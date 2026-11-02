'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/dataset'
import { useDemo } from '../demo-context'
import { Panel } from './primitives'

const RECS = [
  {
    fit: 'Atlas Core Gen1',
    color: 'bg-core',
    items: [
      'Steady, well-sized working sets that fit in cache',
      'Workloads needing the broadest feature and tooling coverage',
      'Teams that prefer fixed, per-node resource planning',
      'Lowest-latency writes with a classic replica-set topology',
    ],
  },
  {
    fit: 'Atlas Infinite',
    color: 'bg-infinite',
    items: [
      'Large or fast-growing data where storage should scale on its own',
      'Spiky read demand served by quickly attached read-only nodes',
      'Right-sizing compute without migrating or copying data',
      'Consolidating storage into a single durable shared copy',
    ],
  },
]

export function ResultsStage() {
  const { cfg, results, live } = useDemo()
  const w = results.workload
  const rows: [string, string, string][] = [
    ['Compute', `${cfg.core.tier} Gen1 × 3 electable`, `${cfg.infinite.tier} Gen2 Primary + Standby (+${cfg.infinite.readOnlyNodes} read-only)`],
    ['Storage', `${cfg.core.diskSizeGB} GB per member`, 'Shared, elastic'],
    [
      'Load time',
      results.load?.core ? formatDuration(results.load.core.seconds) : 'Not run',
      results.load?.infinite ? formatDuration(results.load.infinite.seconds) : 'Not run',
    ],
    ['Query results', results.queriesMatched === undefined ? 'Not run' : results.queriesMatched ? 'Identical' : 'Differ', results.queriesMatched === undefined ? 'Not run' : results.queriesMatched ? 'Identical' : 'Differ'],
    ['p50 / p95 / p99', w?.core ? `${w.core.p50} / ${w.core.p95} / ${w.core.p99} ms` : 'Not run', w?.infinite ? `${w.infinite.p50} / ${w.infinite.p95} / ${w.infinite.p99} ms` : 'Not run'],
    ['Throughput', w?.core ? `${w.core.throughput.toLocaleString()} ops/s` : 'Not run', w?.infinite ? `${w.infinite.throughput.toLocaleString()} ops/s` : 'Not run'],
  ]

  const exportReport = () => {
    const report = { name: cfg.name, mode: cfg.mode, generatedAt: new Date().toISOString(), clusters: { core: cfg.core, infinite: cfg.infinite }, workload: cfg.workload, results }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${cfg.name.replace(/\W+/g, '-').toLowerCase()}-results.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title={`Session summary · ${live ? 'measured' : 'simulated'}`}
        action={
          <Button variant="outline" size="sm" onClick={exportReport}>
            <Download data-icon="inline-start" />
            Export report
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Dimension</th>
                <th scope="col" className="py-2 pr-4 font-medium text-core">Atlas Core Gen1</th>
                <th scope="col" className="py-2 font-medium text-infinite">Atlas Infinite</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([d, c, i]) => (
                <tr key={d} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">{d}</th>
                  <td className="py-2 pr-4 font-mono text-xs">{c}</td>
                  <td className="py-2 font-mono text-xs">{i}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Compute generation, instance resources and cache state differ between clusters. Results are not hardware-normalized.
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {RECS.map((r) => (
          <section key={r.fit} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <span className={`size-2.5 rounded-full ${r.color}`} aria-hidden="true" />
              Choose {r.fit} for
            </h3>
            <ul className="flex flex-col gap-2 text-sm">
              {r.items.map((i) => (
                <li key={i} className="leading-relaxed text-muted-foreground">{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
