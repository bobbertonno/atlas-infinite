'use client'

import { CheckCircle2, CircleAlert, Pencil, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ArchitecturePair } from '@/components/lab/architecture'
import { ModeBadge } from '@/components/lab/mode-badge'
import { DATASET_TEMPLATES, WORKLOAD_TEMPLATES, regionInfo, stageMeta } from '@/lib/catalog'
import { estimateDataset, formatBytes } from '@/lib/dataset'
import { hasErrors, WIZARD_STEPS, type Issue } from '@/lib/validation'
import { IssueList, type StepProps } from '../wizard'

export function ReviewStep({
  cfg,
  stepIssues,
  onEdit,
  onLaunch,
}: StepProps & { stepIssues: Issue[][]; onEdit: (i: number) => void; onLaunch: () => void }) {
  const est = estimateDataset(cfg.dataset)
  const allIssues = stepIssues.flat()
  const blocked = hasErrors(allIssues)

  const sections: { step: number; title: string; rows: [string, string][] }[] = [
    { step: 0, title: 'Mode', rows: [['Execution', cfg.mode === 'live' ? 'Live Atlas' : 'Simulation']] },
    {
      step: 1,
      title: 'Connection',
      rows:
        cfg.mode === 'live'
          ? [
              ['Project', cfg.connection.projectId || 'not set'],
              ['Region', regionInfo(cfg.connection.region)?.label ?? cfg.connection.region],
              ['DB user', cfg.connection.dbUsername],
              ['Network', cfg.connection.networkMode],
            ]
          : [['Credentials', 'Not required']],
    },
    {
      step: 2,
      title: 'Clusters',
      rows: [
        ['Core', `${cfg.core.name} · ${cfg.core.tier} · 3 nodes · ${cfg.core.diskSizeGB} GB/node · ${cfg.core.source}`],
        ['Infinite', `${cfg.infinite.name} · ${cfg.infinite.tier} · 2 base + ${cfg.infinite.readOnlyNodes} RO · ${cfg.mode === 'live' ? 'existing' : cfg.infinite.source}`],
      ],
    },
    {
      step: 3,
      title: 'Dataset',
      rows: [
        ['Template', DATASET_TEMPLATES[cfg.dataset.template].label],
        ['Namespace', `${cfg.dataset.database}.${cfg.dataset.collection}`],
        ['Size', `${est.documents.toLocaleString()} docs · ~${formatBytes(est.logicalBytes)}`],
        ['Seed', String(cfg.dataset.seed)],
      ],
    },
    {
      step: 4,
      title: 'Loading',
      rows: [
        ['Target', cfg.loading.target],
        ['Batch', `${cfg.loading.batchSize} × ${cfg.loading.parallelism} parallel · w:${cfg.loading.writeConcern}`],
        ['Validation', cfg.loading.validation],
      ],
    },
    {
      step: 5,
      title: 'Workload',
      rows: [
        ['Template', WORKLOAD_TEMPLATES[cfg.workload.template].label],
        ['Mix', `${cfg.workload.readRatio}% read · ${cfg.workload.insertRate}/${cfg.workload.updateRate}/${cfg.workload.deleteRate} ins/upd/del`],
        ['Load', `${cfg.workload.concurrency} users · ${cfg.workload.targetOps} ops/s · ${cfg.workload.durationSec}s`],
      ],
    },
    {
      step: 6,
      title: 'Guided demo',
      rows: [
        ['Stages', cfg.guided.stages.filter((s) => s.enabled).map((s) => stageMeta(s.id).title).join(' → ')],
        ['Audience', `${cfg.guided.audience} · ${cfg.guided.detailLevel} · ${cfg.guided.progression}`],
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
        <ModeBadge mode={cfg.mode} />
        <p className="flex items-center gap-2 text-sm">
          {blocked ? (
            <>
              <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
              Resolve the errors below before launching.
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              Configuration is valid and ready to launch.
            </>
          )}
        </p>
        <Button className="ml-auto" onClick={onLaunch} disabled={blocked}>
          <Play data-icon="inline-start" />
          {cfg.mode === 'live' ? 'Provision & launch' : 'Launch demo'}
        </Button>
      </div>

      <ArchitecturePair core={cfg.core} infinite={cfg.infinite} />

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <header className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {s.title}
                {hasErrors(stepIssues[s.step]) ? <CircleAlert className="size-3.5 text-destructive" aria-label="has errors" /> : null}
              </h2>
              <Button size="sm" variant="ghost" onClick={() => onEdit(s.step)} aria-label={`Edit ${s.title}`}>
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
            </header>
            <dl className="flex flex-col gap-1.5 text-sm">
              {s.rows.map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 break-words font-mono text-xs leading-5">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {allIssues.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Issues</h2>
          {WIZARD_STEPS.map((s, i) =>
            stepIssues[i].length ? (
              <div key={s.id} className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">{s.title}</p>
                <IssueList issues={stepIssues[i]} />
              </div>
            ) : null,
          )}
        </section>
      ) : null}
    </div>
  )
}
