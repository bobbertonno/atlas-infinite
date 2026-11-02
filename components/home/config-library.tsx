'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Download, FileUp, LayoutTemplate, Pencil, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ModeBadge } from '@/components/lab/mode-badge'
import { NewDemoButton } from './new-demo-button'
import { DATASET_TEMPLATES, WORKLOAD_TEMPLATES } from '@/lib/catalog'
import { toExportProfile } from '@/lib/defaults'
import { configStore, useConfigs } from '@/lib/store'
import { useHydrated } from '@/lib/use-hydrated'
import { WIZARD_STEPS } from '@/lib/validation'
import type { DemoConfig } from '@/lib/types'

export function ConfigLibrary() {
  const hydrated = useHydrated()
  const configs = useConfigs()
  const fileRef = useRef<HTMLInputElement>(null)
  const templates = configs.filter((c) => c.isTemplate)
  const demos = configs.filter((c) => !c.isTemplate)

  const onImport = async (file: File) => {
    try {
      const cfg = configStore.importProfile(JSON.parse(await file.text()))
      toast.success(`Imported "${cfg.name}"`)
    } catch (e) {
      toast.error((e as Error).message || 'Import failed')
    }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="library-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="library-heading" className="text-xl font-semibold">
            Demo configurations
          </h2>
          <p className="text-sm text-muted-foreground">Resume drafts, launch ready demos, or start from a saved template.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="sr-only"
            aria-label="Import profile file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = ''
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp data-icon="inline-start" />
            Import profile
          </Button>
        </div>
      </div>

      {!hydrated ? (
        <div className="h-32 animate-pulse rounded-xl border bg-card" />
      ) : demos.length === 0 && templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No configurations yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            The wizard walks you through mode, Atlas connection, clusters, dataset, loading, workload and the guided storyline.
          </p>
          <NewDemoButton size="default" />
        </div>
      ) : (
        <>
          {demos.length ? (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {demos.map((c) => (
                <ConfigCard key={c.id} cfg={c} />
              ))}
            </ul>
          ) : null}
          {templates.length ? (
            <div className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <LayoutTemplate className="size-4" aria-hidden="true" />
                Templates
              </h3>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {templates.map((c) => (
                  <ConfigCard key={c.id} cfg={c} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function ConfigCard({ cfg }: { cfg: DemoConfig }) {
  const router = useRouter()
  const exportProfile = () => {
    const blob = new Blob([JSON.stringify(toExportProfile(cfg), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${cfg.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.atlas-lab.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const enabledStages = cfg.guided.stages.filter((s) => s.enabled).length

  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{cfg.name}</h3>
          <p className="text-xs text-muted-foreground">Updated {new Date(cfg.updatedAt).toLocaleString()}</p>
        </div>
        <ModeBadge mode={cfg.mode} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Dataset</dt>
          <dd className="font-medium">
            {DATASET_TEMPLATES[cfg.dataset.template].label} · {cfg.dataset.documentCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Workload</dt>
          <dd className="font-medium">{WORKLOAD_TEMPLATES[cfg.workload.template].label}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Clusters</dt>
          <dd className="font-mono">
            {cfg.core.tier} / {cfg.infinite.tier}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">
            {cfg.isTemplate ? 'Template' : cfg.status === 'ready' ? `Ready · ${enabledStages} stages` : `Draft · ${WIZARD_STEPS[cfg.lastStep]?.short}`}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2">
        {cfg.isTemplate ? (
          <Button
            size="sm"
            onClick={() => {
              const copy = configStore.duplicate(cfg.id)
              if (copy) {
                configStore.upsert({ ...copy, name: cfg.name.replace(' (template)', ''), status: 'draft', lastStep: 0 })
                router.push(`/wizard/${copy.id}`)
              }
            }}
          >
            Use template
          </Button>
        ) : cfg.status === 'ready' ? (
          <Button size="sm" nativeButton={false} render={<Link href={`/demo/${cfg.id}`} />}>
            <Play data-icon="inline-start" />
            Launch
          </Button>
        ) : (
          <Button size="sm" nativeButton={false} render={<Link href={`/wizard/${cfg.id}`} />}>
            Resume
          </Button>
        )}
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/wizard/${cfg.id}`} />} aria-label={`Edit ${cfg.name}`}>
          <Pencil />
        </Button>
        <Button size="sm" variant="outline" aria-label={`Duplicate ${cfg.name}`} onClick={() => configStore.duplicate(cfg.id) && toast.success('Duplicated')}>
          <Copy />
        </Button>
        {!cfg.isTemplate ? (
          <Button size="sm" variant="outline" aria-label={`Save ${cfg.name} as template`} onClick={() => configStore.duplicate(cfg.id, true) && toast.success('Saved as template')}>
            <LayoutTemplate />
          </Button>
        ) : null}
        <Button size="sm" variant="outline" aria-label={`Export ${cfg.name}`} onClick={exportProfile}>
          <Download />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Delete ${cfg.name}`}
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (window.confirm(`Delete "${cfg.name}"?`)) configStore.remove(cfg.id)
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
