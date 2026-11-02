'use client'

import { FlaskConical, Radio } from 'lucide-react'
import { ChoiceCard, HelpCallout } from '@/components/lab/fields'
import { ModeBadge } from '@/components/lab/mode-badge'
import type { StepProps } from '../wizard'

const SIM = [
  'No Atlas credentials required',
  'Predefined, deterministic cluster lifecycle',
  'Synthetic data generated in the browser',
  'Animated architecture walkthrough',
  'Simulated scaling and restore',
  'Every metric labeled as simulated',
]
const LIVE = [
  'Requires an Atlas service account',
  'Provisions or attaches real clusters',
  'Loads the deterministic dataset with real bulk writes',
  'Executes real MongoDB queries',
  'Polls real Atlas cluster status',
  'Displays client-measured latencies',
]

export function ModeStep({ cfg, update }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Demo mode" className="grid gap-4 md:grid-cols-2">
        <ChoiceCard
          selected={cfg.mode === 'simulation'}
          onSelect={() => update('mode', 'simulation')}
          icon={<FlaskConical className="size-4 text-simulated" aria-hidden="true" />}
          title="Simulation Mode"
          badge={<ModeBadge mode="simulation" />}
          description={
            <ul className="mt-1 flex flex-col gap-1">
              {SIM.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-simulated" aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          }
        />
        <ChoiceCard
          selected={cfg.mode === 'live'}
          onSelect={() => update('mode', 'live')}
          icon={<Radio className="size-4 text-live" aria-hidden="true" />}
          title="Live Atlas Mode"
          badge={<ModeBadge mode="live" />}
          description={
            <ul className="mt-1 flex flex-col gap-1">
              {LIVE.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-live" aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          }
        />
      </div>
      <HelpCallout title="How the two modes differ">
        Both modes run the same guided storyline, the same deterministic dataset and the same workload definitions. Simulation uses an
        illustrative model that encodes architectural tendencies; it is never presented as measured performance. Live mode talks to the
        Atlas Admin API and your clusters through server-side routes only, so credentials never reach the browser. Every screen in the
        demo carries a persistent badge showing which mode produced the data.
      </HelpCallout>
    </div>
  )
}
