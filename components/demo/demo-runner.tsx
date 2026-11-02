'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Pause, Play, Settings2, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SiteHeader } from '@/components/lab/site-header'
import { ModeBadge } from '@/components/lab/mode-badge'
import { stageMeta } from '@/lib/catalog'
import { formatDuration } from '@/lib/dataset'
import { configStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { DemoConfig } from '@/lib/types'
import { DemoContext, type DemoResults } from './demo-context'
import { StageView } from './stage-view'

export function DemoRunner({ cfg: initial }: { cfg: DemoConfig }) {
  const [cfg, setCfg] = useState(initial)
  const [results, setResultsState] = useState<DemoResults>({})
  const stages = useMemo(() => cfg.guided.stages.filter((s) => s.enabled).map((s) => stageMeta(s.id)), [cfg.guided.stages])
  const [index, setIndex] = useState(0)
  const [autoPlay, setAutoPlay] = useState(cfg.guided.progression === 'auto')
  const [showNotes, setShowNotes] = useState(cfg.guided.speakerNotes)
  const [elapsed, setElapsed] = useState(0)

  const speed = cfg.guided.animationSpeed
  const current = stages[index]
  const stageSeconds = current ? Math.max(10, cfg.guided.autoAdvanceSec || current.estimatedSec / speed) : 0

  const updateCfg = useCallback((patch: Partial<DemoConfig> | ((c: DemoConfig) => Partial<DemoConfig>)) => {
    setCfg((c) => configStore.upsert({ ...c, ...(typeof patch === 'function' ? patch(c) : patch) }))
  }, [])
  const setResults = useCallback((fn: (r: DemoResults) => DemoResults) => setResultsState(fn), [])

  const go = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(stages.length - 1, i)))
      setElapsed(0)
    },
    [stages.length],
  )

  useEffect(() => {
    if (!autoPlay || !current) return
    const id = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= stageSeconds) {
          if (index < stages.length - 1) {
            setIndex(index + 1)
          } else setAutoPlay(false)
          return 0
        }
        return e + 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [autoPlay, current, stageSeconds, index, stages.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [role="slider"]')) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index])

  const totalSec = stages.reduce((a, s) => a + s.estimatedSec, 0)
  const ctx = useMemo(() => ({ cfg, updateCfg, speed, live: cfg.mode === 'live', results, setResults }), [cfg, updateCfg, speed, results, setResults])

  if (!current) {
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
          <h1 className="text-xl font-semibold">No stages enabled</h1>
          <Button nativeButton={false} render={<Link href={`/wizard/${cfg.id}`} />}>Configure stages</Button>
        </main>
      </div>
    )
  }

  return (
    <DemoContext.Provider value={ctx}>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className="border-b bg-card/50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
            <h1 className="mr-auto truncate font-semibold">{cfg.name}</h1>
            <ModeBadge mode={cfg.mode} />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {stages.length} stages · ~{formatDuration(totalSec)} · {cfg.guided.audience}
            </span>
            <Button variant="outline" size="sm" onClick={() => setShowNotes((v) => !v)} aria-pressed={showNotes}>
              <StickyNote data-icon="inline-start" />
              Notes
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/wizard/${cfg.id}`} />}>
              <Settings2 data-icon="inline-start" />
              Configure
            </Button>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Demo stages" className="lg:sticky lg:top-20 lg:self-start">
            <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {stages.map((s, i) => (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === index ? 'step' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      i === index ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs',
                        i === index ? 'border-primary bg-primary text-primary-foreground' : i < index ? 'border-primary/50 text-primary' : '',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <main className="flex min-w-0 flex-col gap-6">
            <header className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                Stage {index + 1} of {stages.length}
              </p>
              <h2 className="text-2xl font-semibold text-balance md:text-3xl">{current.title}</h2>
              <p className="max-w-3xl text-muted-foreground text-pretty">{current.summary}</p>
            </header>

            {showNotes ? (
              <aside className="rounded-lg border border-primary/30 bg-primary/5 p-4" aria-label="Speaker notes">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Speaker notes · {cfg.guided.audience}</p>
                <p className="text-sm leading-relaxed">{current.notes[cfg.guided.audience]}</p>
              </aside>
            ) : null}

            <StageView key={current.id} id={current.id} />

            <footer className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
              <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
                <ChevronLeft data-icon="inline-start" />
                Previous
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setAutoPlay((v) => !v)} aria-label={autoPlay ? 'Pause auto-advance' : 'Start auto-advance'}>
                {autoPlay ? <Pause /> : <Play />}
              </Button>
              <div className="flex flex-1 flex-col gap-1">
                <Progress value={autoPlay ? (elapsed / stageSeconds) * 100 : ((index + 1) / stages.length) * 100} aria-label="Stage progress" />
                <span className="text-xs text-muted-foreground">
                  {autoPlay ? `Auto-advancing in ${Math.ceil(stageSeconds - elapsed)}s` : 'Manual progression · arrow keys to navigate'}
                </span>
              </div>
              <Button onClick={() => go(index + 1)} disabled={index === stages.length - 1}>
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
            </footer>
          </main>
        </div>
      </div>
    </DemoContext.Provider>
  )
}
