'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { HelpCallout, NumberField, SelectField, SliderField, SwitchField } from '@/components/lab/fields'
import { stageMeta } from '@/lib/catalog'
import { formatDuration } from '@/lib/dataset'
import type { GuidedConfig } from '@/lib/types'
import type { StepProps } from '../wizard'

export function GuidedStep({ cfg, update }: StepProps) {
  const g = cfg.guided
  const set = <K extends keyof GuidedConfig>(k: K, v: GuidedConfig[K]) => update('guided', (p) => ({ ...p, [k]: v }))
  const enabled = g.stages.filter((s) => s.enabled)
  const totalSec = enabled.reduce((a, s) => a + stageMeta(s.id).estimatedSec, 0) / Math.max(0.25, g.animationSpeed ** 0.3)

  const move = (i: number, dir: -1 | 1) => {
    const next = [...g.stages]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set('stages', next)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Stages</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {enabled.length} enabled · ~{formatDuration(totalSec)}
          </span>
        </div>
        <ol className="flex flex-col gap-1.5">
          {g.stages.map((s, i) => {
            const meta = stageMeta(s.id)
            return (
              <li key={s.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${s.enabled ? 'bg-muted/40' : 'opacity-60'}`}>
                <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{meta.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{meta.summary}</span>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Move ${meta.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Move ${meta.title} down`} disabled={i === g.stages.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Switch
                  aria-label={`Include ${meta.title}`}
                  checked={s.enabled}
                  onCheckedChange={(v) => set('stages', g.stages.map((x) => (x.id === s.id ? { ...x, enabled: Boolean(v) } : x)))}
                />
              </li>
            )
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Presentation</h2>
        <SelectField<GuidedConfig['audience']>
          label="Audience"
          value={g.audience}
          onChange={(v) => set('audience', v)}
          options={[
            { value: 'executive', label: 'Executive' },
            { value: 'developer', label: 'Developer' },
            { value: 'architect', label: 'Architect' },
          ]}
          help="Tailors speaker notes and talking points for each stage."
        />
        <SelectField<GuidedConfig['detailLevel']>
          label="Technical detail"
          value={g.detailLevel}
          onChange={(v) => set('detailLevel', v)}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'standard', label: 'Standard' },
            { value: 'deep', label: 'Deep dive' },
          ]}
        />
        <SelectField<GuidedConfig['progression']>
          label="Progression"
          value={g.progression}
          onChange={(v) => set('progression', v)}
          options={[
            { value: 'manual', label: 'Manual (presenter advances)' },
            { value: 'auto', label: 'Automatic' },
          ]}
        />
        {g.progression === 'auto' ? (
          <NumberField label="Auto-advance after" value={g.autoAdvanceSec} onChange={(v) => set('autoAdvanceSec', v)} min={10} max={600} suffix="seconds" />
        ) : null}
        <SliderField label="Animation speed" value={g.animationSpeed} onChange={(v) => set('animationSpeed', v)} min={0.5} max={4} step={0.5} format={(v) => `${v}×`} />
        <SwitchField label="Show speaker notes" checked={g.speakerNotes} onChange={(v) => set('speakerNotes', v)} />
      </section>

      <div className="lg:col-span-2">
        <HelpCallout title="Designing the storyline">
          A typical executive run covers architectures, read scaling, independent scaling and recommendations. Architects usually add read and
          write paths, encryption and backup. The estimated duration updates as you enable stages and change the animation speed.
        </HelpCallout>
      </div>
    </div>
  )
}
