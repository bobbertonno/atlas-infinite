'use client'

import { CoreDiagram, InfiniteDiagram } from '@/components/lab/architecture'
import { NewDemoButton } from './new-demo-button'
import { createDefaultConfig } from '@/lib/defaults'

const preview = createDefaultConfig()

export function HomeHero() {
  return (
    <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-5">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Interactive architecture lab</p>
        <h1 className="text-4xl font-semibold leading-tight text-balance md:text-5xl">
          Atlas Core and Atlas Infinite, side by side.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
          Configure, provision and present a guided comparison of a three-node replica set and a disaggregated compute and storage
          deployment, using identical data and identical workloads. Run it fully simulated, or against real Atlas clusters.
        </p>
        <div className="flex flex-wrap gap-3">
          <NewDemoButton />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-core/30 bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Atlas Core Gen1</p>
          <CoreDiagram cluster={preview.core} highlight="write" />
        </div>
        <div className="rounded-xl border border-infinite/30 bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Atlas Infinite</p>
          <InfiniteDiagram cluster={preview.infinite} highlight="write" />
        </div>
      </div>
    </section>
  )
}
