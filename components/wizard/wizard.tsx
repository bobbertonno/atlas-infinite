'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CircleAlert, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SiteHeader } from '@/components/lab/site-header'
import { ModeBadge } from '@/components/lab/mode-badge'
import { configStore } from '@/lib/store'
import { hasErrors, validateStep, WIZARD_STEPS, type Issue } from '@/lib/validation'
import { cn } from '@/lib/utils'
import type { DemoConfig } from '@/lib/types'
import { ModeStep } from './steps/mode-step'
import { ConnectionStep } from './steps/connection-step'
import { ClustersStep } from './steps/clusters-step'
import { DatasetStep } from './steps/dataset-step'
import { LoadingStep } from './steps/loading-step'
import { WorkloadStep } from './steps/workload-step'
import { GuidedStep } from './steps/guided-step'
import { ReviewStep } from './steps/review-step'

export type Update = <K extends keyof DemoConfig>(key: K, value: DemoConfig[K] | ((prev: DemoConfig[K]) => DemoConfig[K])) => void

export interface StepProps {
  cfg: DemoConfig
  update: Update
}

export function Wizard({ initial }: { initial: DemoConfig }) {
  const router = useRouter()
  const [cfg, setCfg] = useState(initial)
  const [step, setStep] = useState(Math.min(initial.lastStep, WIZARD_STEPS.length - 1))

  useEffect(() => {
    const t = setTimeout(() => configStore.upsert(cfg), 400)
    return () => clearTimeout(t)
  }, [cfg])

  const update: Update = useCallback((key, value) => {
    setCfg((prev) => ({
      ...prev,
      [key]: typeof value === 'function' ? (value as (p: unknown) => unknown)(prev[key]) : value,
    }))
  }, [])

  const goTo = (i: number) => {
    setStep(i)
    setCfg((prev) => ({ ...prev, lastStep: Math.max(prev.lastStep, i) }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stepIssues = useMemo(() => WIZARD_STEPS.map((s) => validateStep(cfg, s.id)), [cfg])
  const current = WIZARD_STEPS[step]
  const issues = stepIssues[step]

  const launch = () => {
    const blocking = stepIssues.findIndex((i) => hasErrors(i))
    if (blocking !== -1) {
      toast.error(`Resolve issues in "${WIZARD_STEPS[blocking].title}" before launching.`)
      goTo(blocking)
      return
    }
    configStore.upsert({ ...cfg, status: 'ready' })
    router.push(`/demo/${cfg.id}`)
  }

  const props: StepProps = { cfg, update }

  return (
    <div className="min-h-dvh">
      <SiteHeader>
        <ModeBadge mode={cfg.mode} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            configStore.upsert(cfg)
            toast.success('Configuration saved')
          }}
        >
          <Save data-icon="inline-start" />
          Save
        </Button>
      </SiteHeader>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:px-6 md:py-8">
        <aside className="md:sticky md:top-20 md:h-fit md:w-60 md:shrink-0">
          <label className="sr-only" htmlFor="cfg-name">
            Configuration name
          </label>
          <Input
            id="cfg-name"
            value={cfg.name}
            onChange={(e) => update('name', e.target.value)}
            className="mb-4 font-medium"
          />
          <nav aria-label="Wizard steps">
            <ol className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
              {WIZARD_STEPS.map((s, i) => {
                const errs = hasErrors(stepIssues[i])
                const visited = i <= cfg.lastStep
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={i === step ? 'step' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                        i === step && 'bg-muted font-medium text-foreground',
                        i !== step && 'text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs',
                          i === step && 'border-primary text-primary',
                          visited && !errs && i !== step && 'border-primary/40 bg-primary/10 text-primary',
                          visited && errs && 'border-destructive/60 text-destructive',
                        )}
                      >
                        {visited && errs ? <CircleAlert className="size-3.5" aria-hidden="true" /> : visited && i !== step ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                      </span>
                      <span className="whitespace-nowrap">{s.short}</span>
                      {visited && errs ? <span className="sr-only">(has errors)</span> : null}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
          <div className="mt-4 hidden md:block">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Step {step + 1} of {WIZARD_STEPS.length} · autosaved
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="flex flex-col gap-1">
            <p className="font-mono text-xs uppercase tracking-wider text-primary">Step {step + 1}</p>
            <h1 className="text-2xl font-semibold text-balance">{current.title}</h1>
          </header>

          {current.id === 'mode' && <ModeStep {...props} />}
          {current.id === 'connection' && <ConnectionStep {...props} />}
          {current.id === 'clusters' && <ClustersStep {...props} />}
          {current.id === 'dataset' && <DatasetStep {...props} />}
          {current.id === 'loading' && <LoadingStep {...props} />}
          {current.id === 'workload' && <WorkloadStep {...props} />}
          {current.id === 'guided' && <GuidedStep {...props} />}
          {current.id === 'review' && <ReviewStep {...props} stepIssues={stepIssues} onEdit={goTo} onLaunch={launch} />}

          {current.id !== 'review' ? <IssueList issues={issues} /> : null}

          <footer className="flex items-center justify-between gap-3 border-t pt-4">
            {step > 0 ? (
              <Button variant="outline" onClick={() => goTo(step - 1)}>
                <ChevronLeft data-icon="inline-start" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>
                <ChevronLeft data-icon="inline-start" />
                Library
              </Button>
            )}
            {step < WIZARD_STEPS.length - 1 ? (
              <Button onClick={() => goTo(step + 1)}>
                Continue
                <ChevronRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button onClick={launch}>Launch demo</Button>
            )}
          </footer>
        </main>
      </div>
    </div>
  )
}

export function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null
  return (
    <ul className="flex flex-col gap-2" aria-label="Validation issues">
      {issues.map((i, idx) => (
        <li
          key={idx}
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
            i.level === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-simulated/40 bg-simulated/10 text-simulated',
          )}
        >
          {i.level === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <span>{i.message}</span>
        </li>
      ))}
    </ul>
  )
}
